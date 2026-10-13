// Personal autenticado por cookie de sesión. Todas las operaciones que modifican datos exigen CSRF.
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { ah, HttpError, normTel } from '../util'
import { requireStaff, requireRol, csrf } from '../middleware/auth'
import { crearReservacion, validarSlot, getConfig, hayConflicto, bloquean, validarMusica } from '../disponibilidad'
import { armarItems } from '../pedidos'
import { MIN, inicioDiaLocal, rangoMesLocal, ventanaQueContiene } from '../tiempo'
import { crearPdf, datosReporte, etiquetaPeriodo, generarReporte, semanaQueTermina, ultimoCorte, variacion, type DatosReporte } from '../reportes'

const r = Router()
r.use(requireStaff, csrf)

const D = (n: Prisma.Decimal.Value = 0) => new Prisma.Decimal(n)
const idP = (req: Request) => z.coerce.number().int().positive().parse(req.params.id)
const yo = (req: Request) => req.auth!.usuario!
const RECEP = requireRol('RECEPCION', 'OPERACIONES') // ADMIN siempre puede
const metodoZ = z.enum(['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO']) // en el establecimiento
const codigoZ = z.string().trim().toUpperCase().regex(/^ML[0-9A-F]{8}$/, 'Código inválido')
/** Lo que falta por cobrar de la sala (en línea solo se paga el anticipo; el resto, al llegar). */
const saldoSala = (rv: { subtotalSala: Prisma.Decimal; pagos: { tipo: string; estado: string; monto: Prisma.Decimal }[] }) =>
  rv.subtotalSala.sub(rv.pagos.filter((p) => (p.tipo === 'SALA' || p.tipo === 'SALDO_SALA') && p.estado === 'PAGADO').reduce((a, p) => a.add(p.monto), D()))
const itemsZ = z.array(z.object({ productoId: z.number().int().positive(), cantidad: z.number().int().min(1).max(20) })).min(1).max(15)

// ───────────── RESERVACIONES ─────────────
r.get('/reservaciones', requireRol('RECEPCION', 'OPERACIONES', 'FINANZAS'), ah(async (req, res) => {
  const q = z.object({ desde: z.coerce.date().optional(), hasta: z.coerce.date().optional() }).parse(req.query)
  const desde = q.desde ?? inicioDiaLocal(), hasta = q.hasta ?? new Date(desde.getTime() + 30 * 36e5) // incluye la madrugada
  res.json(await prisma.reservacion.findMany({
    where: { inicio: { gte: desde, lt: hasta } }, orderBy: { inicio: 'asc' }, take: 200,
    include: { cliente: { select: { nombre: true, telefono: true } }, sala: { select: { numero: true, estado: true } }, tematica: { select: { nombre: true } } },
  }))
}))

// Recepción busca por el NÚMERO DE RESERVACIÓN que da el cliente al llegar.
r.get('/reservaciones/buscar/:codigo', RECEP, ah(async (req, res) => {
  const rv = await prisma.reservacion.findUnique({
    where: { codigo: codigoZ.parse(req.params.codigo) },
    include: {
      cliente: { select: { nombre: true, telefono: true } }, sala: { select: { numero: true, estado: true, tipoSalaId: true, tipoSala: { select: { nombre: true } } } }, tematica: { select: { nombre: true } },
      pagos: true, extensiones: true, pedidos: { include: { items: { include: { producto: { select: { nombre: true } } } } } },
    },
  })
  if (!rv) throw new HttpError(404, 'Reservación no encontrada')
  res.json({ ...rv, saldoSala: saldoSala(rv) })
}))

// Reservar en el establecimiento SIN registro del cliente (solo nombre; teléfono opcional).
r.post('/reservaciones/mostrador', RECEP, ah(async (req, res) => {
  const b = z.object({
    nombre: z.string().trim().min(2).max(120),
    telefono: z.string().transform(normTel).refine((t) => t === '' || t.length === 10, 'Teléfono de 10 dígitos').optional(),
    personas: z.number().int().min(1).max(16), tipoSalaId: z.number().int().positive().optional(), salaNumero: z.number().int().optional(),
    tematicaId: z.number().int().positive().optional(), artistas: z.array(z.string().trim().max(80)).max(10).optional(),
    canciones: z.array(z.string().trim().max(120)).max(20).optional(),
    duracionMin: z.number().int().min(60).max(240), inicio: z.coerce.date().optional(), metodo: metodoZ,
    cortesiaProductoId: z.number().int().positive().optional(),
  }).parse(req.body)
  const ahoraMin = new Date(Math.floor(Date.now() / MIN) * MIN)
  const iniciarAhora = !b.inicio
  const inicio = b.inicio ?? ahoraMin
  if (inicio < ahoraMin) throw new HttpError(400, 'La hora de inicio ya pasó')
  const fin = new Date(inicio.getTime() + b.duracionMin * MIN)
  await validarSlot(prisma, inicio, fin, { mostrador: true })
  const musica = await validarMusica(prisma, b, { obligatoria: false }) // en mostrador la música puede definirse después
  const tel = b.telefono || null
  const cliente = (tel && (await prisma.cliente.findUnique({ where: { telefono: tel } }))) || (await prisma.cliente.create({ data: { nombre: b.nombre, telefono: tel } }))
  const x = await crearReservacion({ clienteId: cliente.id, personas: b.personas, tipoSalaId: b.tipoSalaId, salaNumero: b.salaNumero, inicio, fin, canal: 'MOSTRADOR', creadaPorId: yo(req).id, mostrador: { metodo: b.metodo, iniciarAhora }, cortesiaProductoId: b.cortesiaProductoId, musica })
  res.status(201).json({ codigo: x.reservacion.codigo, sala: x.sala.numero, estado: x.reservacion.estado, cobrado: x.subtotalSala, inicio, fin })
}))

// Ingreso: el cliente da su número de reservación. Si llegó tarde se le recorre el tiempo solo
// si no hay otra reservación después (considerando la limpieza); si no, ese tiempo se pierde.
r.post('/reservaciones/:id/check-in', RECEP, ah(async (req, res) => {
  const rid = idP(req)
  const { metodo } = z.object({ metodo: metodoZ.optional() }).parse(req.body)
  const [cfg, hs] = await Promise.all([getConfig(prisma), prisma.horarioOperacion.findMany({ where: { activo: true } })])
  const rv = await prisma.reservacion.findUnique({ where: { id: rid }, include: { sala: true, pagos: true } })
  if (!rv || rv.estado !== 'CONFIRMADA') throw new HttpError(409, 'La reservación no está confirmada')
  const saldo = saldoSala(rv)
  if (saldo.gt(0) && !metodo) throw new HttpError(400, `Falta cobrar ${saldo.toFixed(2)} de la sala: indica el método de pago`)
  const ahora = new Date()
  const falta = Math.ceil((rv.inicio.getTime() - ahora.getTime()) / MIN)
  if (falta > cfg.ingresoAnticipadoMin) throw new HttpError(409, `Su horario inicia en ${falta} min (puede ingresar ${cfg.ingresoAnticipadoMin} min antes)`)
  const retraso = Math.max(0, Math.floor((ahora.getTime() - rv.inicio.getTime()) / MIN))
  if (retraso > cfg.toleranciaMin) throw new HttpError(409, `Pasaron más de ${cfg.toleranciaMin} min de tolerancia: corresponde no-show`)
  if (rv.sala.estado !== 'ACTIVA') throw new HttpError(409, 'La sala aún no está lista (limpieza o mantenimiento)')
  // Ingreso anticipado: solo si la sala ya quedó libre (el fin no cambia: los minutos de antes son cortesía)
  if (falta > 0 && (await prisma.reservacion.count({ where: { salaId: rv.salaId, estado: 'EN_CURSO', id: { not: rv.id } } })))
    throw new HttpError(409, 'La sala sigue ocupada por la reservación anterior')

  let finNuevo = rv.fin, perdidoMin = 0
  if (retraso > 0) {
    const B = cfg.limpiezaMin * MIN
    const sig = await prisma.reservacion.findFirst({ where: { salaId: rv.salaId, id: { not: rv.id }, ...bloquean(), inicio: { gte: rv.fin } }, orderBy: { inicio: 'asc' } })
    const v = ventanaQueContiene(rv.inicio, hs)
    let tope = rv.fin.getTime() + retraso * MIN
    if (sig) tope = Math.min(tope, sig.inicio.getTime() - B)
    if (v) tope = Math.min(tope, v.cierra.getTime())
    const ganado = Math.max(0, tope - rv.fin.getTime())
    finNuevo = new Date(rv.fin.getTime() + ganado)
    perdidoMin = retraso - Math.round(ganado / MIN)
  }
  await prisma.$transaction(async (tx) => {
    const x = await tx.reservacion.updateMany({
      where: { id: rv.id, estado: 'CONFIRMADA' },
      data: { estado: 'EN_CURSO', checkInEn: ahora, retrasoMin: retraso, tiempoPerdidoMin: perdidoMin, fin: finNuevo, finOriginal: finNuevo.getTime() !== rv.fin.getTime() ? rv.fin : null },
    })
    if (!x.count) throw new HttpError(409, 'La reservación ya fue procesada')
    // el resto de la sala (lo que no se pagó en línea) se cobra al ingresar
    if (saldo.gt(0)) await tx.pago.create({ data: { reservacionId: rv.id, tipo: 'SALDO_SALA', metodo: metodo!, monto: saldo, registradoPorId: yo(req).id } })
  })
  res.json({ ok: true, retrasoMin: retraso, tiempoPerdidoMin: perdidoMin, fin: finNuevo, cobradoSala: saldo })
}))

// No-show manual (el sistema también los marca solo). El pago de la sala y el anticipo se conservan.
r.post('/reservaciones/:id/no-show', RECEP, ah(async (req, res) => {
  const rid = idP(req)
  const cfg = await getConfig(prisma)
  const rv = await prisma.reservacion.findUnique({ where: { id: rid } })
  if (!rv || rv.estado !== 'CONFIRMADA') throw new HttpError(409, 'La reservación no está confirmada')
  if (Date.now() < rv.inicio.getTime() + cfg.toleranciaMin * MIN) throw new HttpError(409, `Aún no pasan los ${cfg.toleranciaMin} min de tolerancia`)
  await prisma.$transaction(async (tx) => {
    const x = await tx.reservacion.updateMany({ where: { id: rid, estado: 'CONFIRMADA' }, data: { estado: 'NO_SHOW' } }) // atómico: falla si ya hubo check-in
    if (!x.count) throw new HttpError(409, 'La reservación ya fue procesada')
    await tx.pedido.updateMany({ where: { reservacionId: rid, estado: 'EN_ESPERA' }, data: { estado: 'CANCELADO' } })
  })
  res.json({ ok: true })
}))

// Tiempo extra: solo si no hay otra reservación después (limpieza incluida) y se paga en el establecimiento.
r.post('/reservaciones/:id/extender', RECEP, ah(async (req, res) => {
  const rid = idP(req)
  const b = z.object({ minutos: z.number().int().min(30).max(120).refine((m) => m % 30 === 0, 'En bloques de 30 min'), metodo: metodoZ }).parse(req.body)
  const [cfg, hs] = await Promise.all([getConfig(prisma), prisma.horarioOperacion.findMany({ where: { activo: true } })])
  const out = await prisma.$transaction(async (tx) => {
    const rv = await tx.reservacion.findUnique({ where: { id: rid }, include: { sala: { include: { tipoSala: true } } } })
    if (!rv || rv.estado !== 'EN_CURSO') throw new HttpError(409, 'La visita no está en curso')
    const nuevoFin = new Date(rv.fin.getTime() + b.minutos * MIN)
    const v = ventanaQueContiene(rv.inicio, hs)
    if (!v || nuevoFin > v.cierra) throw new HttpError(409, 'El tiempo extra rebasa el horario de cierre')
    if (await hayConflicto(tx, rv.salaId, rv.inicio, nuevoFin, rv.id, cfg.limpiezaMin)) throw new HttpError(409, 'Hay otra reservación después: no se puede ampliar')
    const monto = rv.sala.tipoSala.precioHora.mul(b.minutos).div(60).toDecimalPlaces(2)
    await tx.extension.create({ data: { reservacionId: rv.id, minutos: b.minutos, monto, creadaPorId: yo(req).id } })
    await tx.pago.create({ data: { reservacionId: rv.id, tipo: 'TIEMPO_EXTRA', metodo: b.metodo, monto, registradoPorId: yo(req).id } })
    await tx.reservacion.update({ where: { id: rv.id }, data: { fin: nuevoFin, finOriginal: rv.finOriginal ?? rv.fin } })
    return { monto, fin: nuevoFin }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  res.json({ ok: true, ...out })
}))

// Pedido tomado por el personal (cobra al cerrar la cuenta).
r.post('/reservaciones/:id/pedido', requireRol('RECEPCION', 'BARRA'), ah(async (req, res) => {
  const rid = idP(req)
  const { items } = z.object({ items: itemsZ }).parse(req.body)
  const rv = await prisma.reservacion.findUnique({ where: { id: rid } })
  if (!rv || rv.estado !== 'EN_CURSO') throw new HttpError(409, 'La visita no está en curso')
  const { lineas, total } = await armarItems(prisma, items)
  const p = await prisma.pedido.create({ data: { reservacionId: rid, origen: 'MOSTRADOR', total, atendidoPorId: yo(req).id, items: { create: lineas } } })
  res.status(201).json({ pedidoId: p.id })
}))

// Cierre de cuenta: suma sala + extras + pedidos, aplica la promo de la 4ª visita y cobra lo que falta.
// Deja la sala en LIMPIEZA y crea la tarea para el personal de limpieza.
r.post('/reservaciones/:id/cerrar-cuenta', RECEP, ah(async (req, res) => {
  const rid = idP(req)
  const { metodo } = z.object({ metodo: metodoZ.optional() }).parse(req.body)
  const cuenta = await prisma.$transaction(async (tx) => {
    const rv = await tx.reservacion.findUnique({
      where: { id: rid },
      include: { pedidos: { where: { estado: { not: 'CANCELADO' } }, include: { items: { include: { producto: true } } } }, pagos: { where: { estado: 'PAGADO' } }, extensiones: true },
    })
    if (!rv || rv.estado !== 'EN_CURSO') throw new HttpError(409, 'La reservación no está en curso')
    if (rv.pedidos.some((p) => p.origen === 'PREORDEN' && p.estado === 'EN_ESPERA')) throw new HttpError(409, 'Hay un pedido anticipado sin cobrar: cóbralo o cancélalo antes de cerrar')
    if (rv.pedidos.some((p) => p.estado === 'NUEVO' || p.estado === 'PREPARANDO')) throw new HttpError(409, 'Hay pedidos sin entregar: entrégalos o cancélalos antes de cerrar')

    let preorden = D(), consumo = D(), alimentos = D()
    for (const p of rv.pedidos) {
      if (p.origen === 'PREORDEN') { preorden = preorden.add(p.total); continue }
      for (const i of p.items) {
        const m = i.precioUnitario.mul(i.cantidad); consumo = consumo.add(m)
        if (i.producto.categoria === 'ALIMENTO') alimentos = alimentos.add(m)
      }
    }
    const extras = rv.extensiones.reduce((a, e) => a.add(e.monto), D())

    // Promo: 50% en alimentos del consumo en la 4ª visita del mes (visitas finalizadas previas + esta).
    let descuento = D(), promocionId: number | undefined
    const promo = await tx.promocion.findFirst({ where: { tipo: 'DESCUENTO_ALIMENTOS', activa: true, visitasRequeridas: { not: null } } })
    if (promo) {
      const { desde, hasta } = rangoMesLocal(rv.inicio)
      const previas = await tx.reservacion.count({ where: { clienteId: rv.clienteId, estado: 'FINALIZADA', inicio: { gte: desde, lt: hasta } } })
      if (previas + 1 === promo.visitasRequeridas) { descuento = alimentos.mul(promo.porcentaje).div(100).toDecimalPlaces(2); promocionId = promo.id }
    }

    const total = rv.subtotalSala.add(extras).add(preorden).add(consumo).sub(descuento)
    const pagadoPrevio = rv.pagos.reduce((a, p) => a.add(p.monto), D())
    const saldo = total.sub(pagadoPrevio)
    if (saldo.lt(0)) throw new HttpError(409, 'El total es menor a lo ya pagado: revisa la cuenta con administración')
    if (saldo.gt(0) && !metodo) throw new HttpError(400, 'Indica el método de pago (efectivo, débito o crédito) para el saldo')

    const c = await tx.cuenta.create({ data: { reservacionId: rv.id, subtotalSala: rv.subtotalSala, subtotalExtras: extras, subtotalPedidosAnticipados: preorden, subtotalConsumo: consumo, descuento, total, pagadoPrevio, saldo, cerradaPorId: yo(req).id } })
    if (saldo.gt(0)) await tx.pago.create({ data: { reservacionId: rv.id, tipo: 'CONSUMO', metodo: metodo!, monto: saldo, registradoPorId: yo(req).id } })
    await tx.reservacion.update({ where: { id: rv.id }, data: { estado: 'FINALIZADA', checkOutEn: new Date(), promocionId } })
    await tx.sala.updateMany({ where: { id: rv.salaId, estado: 'ACTIVA' }, data: { estado: 'LIMPIEZA' } })
    await tx.limpieza.create({ data: { salaId: rv.salaId, reservacionId: rv.id } })
    return c
  })
  res.json(cuenta)
}))

// ───────────── ALIMENTOS Y BEBIDAS ─────────────
r.get('/pedidos', requireRol('BARRA', 'RECEPCION'), ah(async (_req, res) => {
  res.json(await prisma.pedido.findMany({
    where: { estado: { in: ['NUEVO', 'PREPARANDO'] } }, orderBy: { creadoEn: 'asc' }, take: 100,
    include: { items: { include: { producto: { select: { nombre: true } } } }, reservacion: { select: { codigo: true, sala: { select: { numero: true } } } } },
  }))
}))

// Pedidos anticipados esperando que recepción cobre el 70% restante.
r.get('/pedidos/por-cobrar', RECEP, ah(async (_req, res) => {
  const ps = await prisma.pedido.findMany({
    where: { origen: 'PREORDEN', estado: 'EN_ESPERA', reservacion: { estado: { in: ['CONFIRMADA', 'EN_CURSO'] } } }, orderBy: { creadoEn: 'asc' }, take: 100,
    include: { items: { include: { producto: { select: { nombre: true } } } }, reservacion: { select: { codigo: true, estado: true, sala: { select: { numero: true } } } } },
  })
  res.json(ps.map((p) => ({ ...p, restante: p.total.sub(p.anticipo) })))
}))

// Registra el resto del pedido anticipado y lo pasa a PREPARANDO (el cliente ya debe estar dentro).
r.post('/pedidos/:id/cobrar-saldo', RECEP, ah(async (req, res) => {
  const pid = idP(req)
  const { metodo } = z.object({ metodo: metodoZ }).parse(req.body)
  const out = await prisma.$transaction(async (tx) => {
    const p = await tx.pedido.findUnique({ where: { id: pid }, include: { reservacion: true } })
    if (!p || p.origen !== 'PREORDEN' || p.estado !== 'EN_ESPERA') throw new HttpError(409, 'El pedido no está esperando cobro')
    if (p.reservacion.estado !== 'EN_CURSO') throw new HttpError(409, 'El cliente aún no ingresa (haz el check-in primero)')
    const restante = p.total.sub(p.anticipo)
    const x = await tx.pedido.updateMany({ where: { id: pid, estado: 'EN_ESPERA' }, data: { estado: 'PREPARANDO', saldoCobrado: true, atendidoPorId: yo(req).id } })
    if (!x.count) throw new HttpError(409, 'El pedido ya fue procesado')
    if (restante.gt(0)) await tx.pago.create({ data: { reservacionId: p.reservacionId, pedidoId: p.id, tipo: 'SALDO_PEDIDO', metodo, monto: restante, registradoPorId: yo(req).id } })
    return { restante }
  })
  res.json({ ok: true, estado: 'PREPARANDO', cobrado: out.restante })
}))

r.patch('/pedidos/:id', requireRol('BARRA', 'RECEPCION'), ah(async (req, res) => {
  const { estado } = z.object({ estado: z.enum(['PREPARANDO', 'ENTREGADO', 'CANCELADO']) }).parse(req.body)
  const desde = estado === 'PREPARANDO' ? ['NUEVO' as const] : ['NUEVO' as const, 'PREPARANDO' as const] // transiciones válidas
  const x = await prisma.pedido.updateMany({
    where: { id: idP(req), estado: { in: desde } },
    data: { estado, atendidoPorId: yo(req).id, entregadoEn: estado === 'ENTREGADO' ? new Date() : undefined },
  })
  if (!x.count) throw new HttpError(409, 'Transición de estado no válida')
  res.json({ ok: true })
}))

// ───────────── SALAS Y LIMPIEZA ─────────────
r.get('/salas', requireRol('OPERACIONES', 'RECEPCION', 'LIMPIEZA'), ah(async (_req, res) => {
  const ahora = new Date()
  res.json(await prisma.sala.findMany({
    orderBy: { numero: 'asc' },
    include: {
      tipoSala: true,
      reservaciones: { where: { estado: { in: ['CONFIRMADA', 'EN_CURSO'] }, fin: { gt: ahora }, inicio: { lt: new Date(ahora.getTime() + 24 * 36e5) } }, orderBy: { inicio: 'asc' }, take: 2, select: { codigo: true, estado: true, inicio: true, fin: true, artistas: true, tematica: { select: { nombre: true } } } },
    },
  }))
}))

r.post('/salas/:numero/mantenimiento', requireRol('OPERACIONES'), ah(async (req, res) => {
  const numero = z.coerce.number().int().positive().parse(req.params.numero)
  const { activo } = z.object({ activo: z.boolean() }).parse(req.body)
  const sala = await prisma.sala.findUnique({ where: { numero } })
  if (!sala) throw new HttpError(404, 'Sala no encontrada')
  if (activo) {
    if (sala.estado === 'MANTENIMIENTO') throw new HttpError(409, 'La sala ya está en mantenimiento')
    await prisma.sala.update({ where: { numero }, data: { estado: 'MANTENIMIENTO' } })
    return void res.json({ ok: true, estado: 'MANTENIMIENTO' })
  }
  // Al terminar el mantenimiento la sala no queda lista de inmediato: pasa a Limpieza y se crea la tarea.
  // Vuelve a ACTIVA (y a poder reservarse) cuando el personal de limpieza la termina.
  await prisma.$transaction(async (tx) => {
    const x = await tx.sala.updateMany({ where: { numero, estado: 'MANTENIMIENTO' }, data: { estado: 'LIMPIEZA' } })
    if (!x.count) throw new HttpError(409, 'La sala no está en mantenimiento')
    await tx.limpieza.create({ data: { salaId: sala.id } })
  })
  res.json({ ok: true, estado: 'LIMPIEZA' })
}))

const LIMP = requireRol('LIMPIEZA', 'OPERACIONES')
r.get('/limpieza', LIMP, ah(async (_req, res) => {
  res.json(await prisma.limpieza.findMany({ where: { estado: { in: ['PENDIENTE', 'EN_PROCESO'] } }, orderBy: { creadaEn: 'asc' }, include: { sala: { select: { numero: true } } } }))
}))
r.post('/limpieza/:id/iniciar', LIMP, ah(async (req, res) => {
  const x = await prisma.limpieza.updateMany({ where: { id: idP(req), estado: 'PENDIENTE' }, data: { estado: 'EN_PROCESO', iniciadaEn: new Date(), realizadaPorId: yo(req).id } })
  if (!x.count) throw new HttpError(409, 'La tarea no está pendiente')
  res.json({ ok: true })
}))
// Al terminar, la sala vuelve a ACTIVA y ya puede recibir el siguiente ingreso.
r.post('/limpieza/:id/terminar', LIMP, ah(async (req, res) => {
  const id = idP(req)
  await prisma.$transaction(async (tx) => {
    const l = await tx.limpieza.findUnique({ where: { id } })
    if (!l || l.estado === 'LISTA') throw new HttpError(409, 'La tarea ya está terminada')
    await tx.limpieza.update({ where: { id }, data: { estado: 'LISTA', terminadaEn: new Date(), realizadaPorId: yo(req).id } })
    await tx.sala.updateMany({ where: { id: l.salaId, estado: 'LIMPIEZA' }, data: { estado: 'ACTIVA' } })
  })
  res.json({ ok: true })
}))

// ───────────── FINANZAS ─────────────
r.get('/kpis', requireRol('FINANZAS'), ah(async (_req, res) => {
  const [filas, porEstado] = await Promise.all([
    prisma.pago.groupBy({ by: ['tipo', 'metodo', 'estado'], _sum: { monto: true } }),
    prisma.reservacion.groupBy({ by: ['estado'], _count: true }),
  ])
  let ingresosNetos = D()
  for (const f of filas) {
    const m = D(f._sum.monto ?? 0)
    if (f.estado === 'PAGADO') ingresosNetos = ingresosNetos.add(m)
    if (f.estado === 'REEMBOLSADO') ingresosNetos = ingresosNetos.sub(m)
  }
  res.json({
    ingresosNetos,
    pagos: filas.map((f) => ({ tipo: f.tipo, metodo: f.metodo, estado: f.estado, monto: f._sum.monto })),
    reservacionesPorEstado: Object.fromEntries(porEstado.map((g) => [g.estado, g._count])),
  })
}))

// ───────────── REPORTES SEMANALES (solo Administración) ─────────────
const ADMIN = requireRol() // sin roles: solo ADMIN
const enviarPdf = (res: Response, pdf: Uint8Array, nombre: string) => {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nombre}.pdf"` })
  res.send(Buffer.from(pdf))
}

r.get('/reportes', ADMIN, ah(async (_req, res) => {
  const lista = await prisma.reporteSemanal.findMany({
    orderBy: { desde: 'desc' }, take: 52, select: { id: true, desde: true, hasta: true, automatico: true, generadoEn: true, datos: true },
  })
  res.json(lista.map(({ datos, ...x }) => {
    const { actual: s, anterior: p } = datos as unknown as DatosReporte
    return {
      ...x, periodo: etiquetaPeriodo(s.desde, s.hasta),
      ingresos: s.ingresos, ingresosAnterior: p.ingresos.total, variacion: variacion(s.ingresos.total, p.ingresos.total),
      cobrado: s.cobros.neto, visitas: s.visitas, pendiente: s.pendientes.total,
      cancelaciones: s.cancelaciones.porCliente + s.cancelaciones.vencidas + s.cancelaciones.noShow,
    }
  }))
}))

// Semana en curso hasta este momento (no se guarda): se compara con el mismo tramo de la semana anterior.
r.get('/reportes/en-curso/pdf', ADMIN, ah(async (_req, res) => {
  const desde = ultimoCorte(), hasta = new Date()
  const pdf = await crearPdf(await datosReporte(desde, hasta), { automatico: false, preliminar: true })
  enviarPdf(res, pdf, `moonlight-semana-en-curso-${hasta.toISOString().slice(0, 10)}`)
}))

r.get('/reportes/:id/pdf', ADMIN, ah(async (req, res) => {
  const rep = await prisma.reporteSemanal.findUnique({ where: { id: idP(req) }, select: { pdf: true, desde: true } })
  if (!rep) throw new HttpError(404, 'Reporte no encontrado')
  enviarPdf(res, rep.pdf, `moonlight-reporte-semanal-${rep.desde.toISOString().slice(0, 10)}`)
}))

// Vuelve a generar el reporte de la última semana cerrada (p. ej. tras corregir un cobro).
r.post('/reportes/generar', ADMIN, ah(async (req, res) => {
  const { desde, hasta } = semanaQueTermina(ultimoCorte())
  const rep = await generarReporte(desde, hasta, { automatico: false, usuarioId: yo(req).id })
  res.status(201).json(rep)
}))

export default r
