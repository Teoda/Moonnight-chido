// Clientes con cuenta: registro, login y todo lo relacionado con SUS reservaciones.
import { Router, type Request } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { config } from '../config'
import { ah, HttpError, normTel } from '../util'
import { crearSesion, cerrarSesion, revocarActual, csrfDe } from '../security/session'
import { requireCliente, csrf } from '../middleware/auth'
import { loginLimiter, limiterRegistro, limiterEscritura } from '../middleware/limiters'
import { crearReservacion, validarSlot, getConfig, salasLibres, validarMusica } from '../disponibilidad'
import { armarItems } from '../pedidos'

const r = Router()
const DUMMY = bcrypt.hashSync('hash-de-relleno', 10)
const pw = z.string().min(10, 'Mínimo 10 caracteres').max(200).regex(/[A-Za-z]/, 'Incluye letras').regex(/\d/, 'Incluye números')
const salida = (c: { id: number; nombre: string; email: string | null }) => ({ id: c.id, nombre: c.nombre, email: c.email })
const codigoZ = z.string().trim().toUpperCase().regex(/^ML[0-9A-F]{8}$/, 'Código inválido')
// Música: un género (tematicaId) o "mi propia lista" de artistas (mínimo 3) y canciones
const musicaZ = {
  tematicaId: z.number().int().positive().optional(),
  artistas: z.array(z.string().trim().max(80)).max(10).optional(),
  canciones: z.array(z.string().trim().max(120)).max(20).optional(),
}
const itemsZ = z.array(z.object({ productoId: z.number().int().positive(), cantidad: z.number().int().min(1).max(20) })).min(1).max(15)
const D0 = () => new Prisma.Decimal(0)

r.post('/registro', limiterRegistro, ah(async (req, res) => {
  const b = z.object({
    nombre: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(150), password: pw,
    telefono: z.string().transform(normTel).refine((t) => t === '' || t.length === 10, 'Teléfono de 10 dígitos').optional(),
    aceptaPromos: z.boolean().optional(),
  }).parse(req.body)
  const tel = b.telefono || null
  if (await prisma.cliente.findUnique({ where: { email: b.email } })) throw new HttpError(409, 'Ese correo ya está registrado')
  if (tel && (await prisma.cliente.findUnique({ where: { telefono: tel } }))) throw new HttpError(409, 'Ese teléfono ya está registrado')
  const c = await prisma.cliente.create({ data: { nombre: b.nombre, email: b.email, telefono: tel, aceptaPromos: b.aceptaPromos ?? false, passwordHash: await bcrypt.hash(b.password, 12) } })
  await revocarActual(req)
  const token = await crearSesion(req, res, { clienteId: c.id })
  res.status(201).json({ cliente: salida(c), csrfToken: csrfDe(token) })
}))

r.post('/login', loginLimiter, ah(async (req, res) => {
  const { email, password } = z.object({ email: z.string().trim().toLowerCase().email().max(150), password: z.string().min(1).max(200) }).parse(req.body)
  const c = await prisma.cliente.findUnique({ where: { email } })
  const bloqueado = !!c?.bloqueadoHasta && c.bloqueadoHasta > new Date()
  const ok = await bcrypt.compare(password, c?.passwordHash && !bloqueado ? c.passwordHash : DUMMY)
  if (!c || !c.passwordHash || bloqueado || !ok) {
    if (c && !bloqueado && !ok) {
      const n = await prisma.cliente.update({ where: { id: c.id }, data: { intentosFallidos: { increment: 1 } } })
      if (n.intentosFallidos >= 5) await prisma.cliente.update({ where: { id: c.id }, data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + 15 * 60_000) } })
    }
    return void res.status(401).json({ error: 'Credenciales inválidas o cuenta bloqueada temporalmente' })
  }
  await prisma.cliente.update({ where: { id: c.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
  await revocarActual(req)
  const token = await crearSesion(req, res, { clienteId: c.id })
  res.json({ cliente: salida(c), csrfToken: csrfDe(token) })
}))

// ── a partir de aquí se requiere sesión de cliente ──
r.use(requireCliente, csrf)
const yo = (req: Request) => req.auth!.cliente!

r.get('/me', (req, res) => void res.json({ cliente: salida(yo(req)), csrfToken: csrfDe(req.auth!.token) }))
r.post('/logout', ah(async (req, res) => { await cerrarSesion(req, res); res.json({ ok: true }) }))
r.post('/cambiar-password', ah(async (req, res) => {
  const { actual, nueva } = z.object({ actual: z.string().max(200), nueva: pw }).parse(req.body)
  const c = yo(req)
  if (!c.passwordHash || !(await bcrypt.compare(actual, c.passwordHash))) return void res.status(401).json({ error: 'Contraseña actual incorrecta' })
  await prisma.cliente.update({ where: { id: c.id }, data: { passwordHash: await bcrypt.hash(nueva, 12) } })
  await prisma.sesion.deleteMany({ where: { clienteId: c.id, id: { not: req.auth!.sesion.id } } }) // cierra las demás sesiones
  res.json({ ok: true })
}))

const mia = async (req: Request, cod: string) => {
  const rv = await prisma.reservacion.findFirst({
    where: { codigo: codigoZ.parse(cod), clienteId: yo(req).id }, include: { sala: { include: { tipoSala: true } } },
  })
  if (!rv) throw new HttpError(404, 'Reservación no encontrada') // también si es de otro cliente
  return rv
}

r.get('/reservaciones', ah(async (req, res) => {
  res.json(await prisma.reservacion.findMany({
    where: { clienteId: yo(req).id }, orderBy: { inicio: 'desc' }, take: 50,
    include: { sala: { select: { numero: true, tipoSalaId: true, tipoSala: { select: { nombre: true } } } }, tematica: { select: { id: true, nombre: true } }, pedidos: { include: { items: { include: { producto: { select: { nombre: true } } } } } } },
  }))
}))

r.post('/reservaciones', limiterEscritura, ah(async (req, res) => {
  const b = z.object({
    personas: z.number().int().min(1).max(16), tipoSalaId: z.number().int().positive(), salaNumero: z.number().int().optional(),
    inicio: z.coerce.date(), fin: z.coerce.date(), items: itemsZ.optional(), cortesiaProductoId: z.number().int().positive().optional(),
    ...musicaZ,
  }).parse(req.body)
  await validarSlot(prisma, b.inicio, b.fin)
  const musica = await validarMusica(prisma, b, { obligatoria: true })
  const x = await crearReservacion({ clienteId: yo(req).id, personas: b.personas, tipoSalaId: b.tipoSalaId, salaNumero: b.salaNumero, inicio: b.inicio, fin: b.fin, canal: 'WEB', items: b.items, cortesiaProductoId: b.cortesiaProductoId, musica })
  res.status(201).json({
    codigo: x.reservacion.codigo, sala: x.sala.numero, totalSala: x.subtotalSala, anticipoPedido: x.anticipoPedido,
    aPagarEnLinea: x.aPagarEnLinea, expiraEn: x.reservacion.expiraEn,
  })
}))

// Pago en línea: sala completa + 30% del pedido anticipado. SIMULADO (con pasarela real lo confirma su webhook firmado).
r.post('/reservaciones/:codigo/pagar', ah(async (req, res) => {
  if (!config.pagosSimulados) throw new HttpError(501, 'Pasarela de pagos no configurada')
  const rv = await mia(req, req.params.codigo)
  if (rv.estado !== 'PENDIENTE_PAGO' || !rv.expiraEn || rv.expiraEn < new Date()) throw new HttpError(409, 'La reservación venció o ya fue pagada')
  const pedido = await prisma.pedido.findFirst({ where: { reservacionId: rv.id, origen: 'PREORDEN', estado: 'EN_ESPERA' } })
  await prisma.$transaction(async (tx) => {
    // UPDATE condicional atómico: si llegan dos pagos a la vez, solo uno cambia la fila; el otro
    // no registra pagos. (update() con filtros extra no sirve: Prisma en MySQL lee y luego actualiza por id.)
    const x = await tx.reservacion.updateMany({ where: { id: rv.id, estado: 'PENDIENTE_PAGO', expiraEn: { gt: new Date() } }, data: { estado: 'CONFIRMADA', expiraEn: null } })
    if (!x.count) throw new HttpError(409, 'La reservación venció o ya fue pagada')
    await tx.pago.create({ data: { reservacionId: rv.id, tipo: 'SALA', metodo: 'TARJETA', monto: rv.subtotalSala, enLinea: true, referencia: 'SIM-' + rv.codigo } })
    if (pedido && pedido.anticipo.gt(0)) await tx.pago.create({ data: { reservacionId: rv.id, pedidoId: pedido.id, tipo: 'ANTICIPO_PEDIDO', metodo: 'TARJETA', monto: pedido.anticipo, enLinea: true, referencia: 'SIM-' + rv.codigo } })
  })
  res.json({ ok: true, estado: 'CONFIRMADA' })
}))

r.post('/reservaciones/:codigo/cancelar', ah(async (req, res) => {
  const rv = await mia(req, req.params.codigo)
  const motivo = z.object({ motivo: z.string().max(255).optional() }).parse(req.body).motivo
  if (rv.estado !== 'PENDIENTE_PAGO' && rv.estado !== 'CONFIRMADA') throw new HttpError(409, 'Esta reservación ya no se puede cancelar')
  const cfg = await getConfig(prisma)
  const horas = Math.max(0, Math.floor((rv.inicio.getTime() - Date.now()) / 36e5))
  const pagado = new Prisma.Decimal((await prisma.pago.aggregate({ where: { reservacionId: rv.id, estado: 'PAGADO', enLinea: true }, _sum: { monto: true } }))._sum.monto ?? 0)
  // Con 24 h o más: reembolso total. Con menos: se retiene un porcentaje configurable (retencionTardiaPct).
  const retenido = pagado.gt(0) && horas < cfg.horasCancelacion ? pagado.mul(cfg.retencionTardiaPct).div(100).toDecimalPlaces(2) : D0()
  const reembolso = pagado.sub(retenido)
  await prisma.$transaction(async (tx) => {
    const x = await tx.reservacion.updateMany({ where: { id: rv.id, estado: rv.estado }, data: { estado: 'CANCELADA' } }) // atómico: evita reembolsos dobles
    if (!x.count) throw new HttpError(409, 'Esta reservación ya no se puede cancelar')
    await tx.pedido.updateMany({ where: { reservacionId: rv.id, estado: 'EN_ESPERA' }, data: { estado: 'CANCELADO' } })
    await tx.cancelacion.create({ data: { reservacionId: rv.id, motivo, horasAnticipacion: horas, reembolso, retenido } })
    if (reembolso.gt(0)) await tx.pago.create({ data: { reservacionId: rv.id, tipo: 'REEMBOLSO', metodo: 'TARJETA', estado: 'REEMBOLSADO', monto: reembolso, enLinea: true, referencia: 'SIM-REEMBOLSO' } })
  })
  res.json({ ok: true, reembolso, retenido })
}))

r.post('/reservaciones/:codigo/reagendar', ah(async (req, res) => {
  const rv = await mia(req, req.params.codigo)
  const { inicio, fin } = z.object({ inicio: z.coerce.date(), fin: z.coerce.date() }).parse(req.body)
  if (rv.estado !== 'CONFIRMADA') throw new HttpError(409, 'Solo se reagendan reservaciones confirmadas')
  if (fin.getTime() - inicio.getTime() !== rv.fin.getTime() - rv.inicio.getTime()) throw new HttpError(400, 'Debe conservar la misma duración')
  const cfg = await validarSlot(prisma, inicio, fin)
  await prisma.$transaction(async (tx) => {
    const libres = await salasLibres(tx, { tipoSalaId: rv.sala.tipoSalaId, inicio, fin, limpiezaMin: cfg.limpiezaMin, ignorarReservacionId: rv.id })
    const nueva = libres.find((s) => s.id === rv.salaId) ?? libres[0]
    if (!nueva) throw new HttpError(409, 'No hay salas libres en ese horario')
    await tx.reagendacion.create({ data: { reservacionId: rv.id, inicioAnterior: rv.inicio, finAnterior: rv.fin, salaAnteriorId: rv.salaId, inicioNuevo: inicio, finNuevo: fin, salaNuevaId: nueva.id } })
    await tx.reservacion.update({ where: { id: rv.id }, data: { inicio, fin, salaId: nueva.id } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  res.json({ ok: true })
}))

// Cambiar la música (género o lista de artistas/canciones) antes de que termine la visita.
r.patch('/reservaciones/:codigo/musica', ah(async (req, res) => {
  const rv = await mia(req, req.params.codigo)
  if (!['PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO'].includes(rv.estado)) throw new HttpError(409, 'Esta reservación ya no se puede modificar')
  const musica = await validarMusica(prisma, z.object(musicaZ).parse(req.body), { obligatoria: true })
  await prisma.reservacion.update({ where: { id: rv.id }, data: musica })
  res.json({ ok: true })
}))

// Pedido por QR desde la sala (solo durante la visita). Se cobra al cerrar la cuenta.
r.post('/reservaciones/:codigo/pedir', ah(async (req, res) => {
  const rv = await mia(req, req.params.codigo)
  const { items } = z.object({ items: itemsZ }).parse(req.body)
  if (rv.estado !== 'EN_CURSO') throw new HttpError(409, 'Solo puedes pedir cuando tu visita está en curso')
  if ((await prisma.pedido.count({ where: { reservacionId: rv.id, estado: { in: ['NUEVO', 'PREPARANDO'] } } })) >= 5) throw new HttpError(429, 'Ya tienes varios pedidos en preparación')
  const { lineas, total } = await armarItems(prisma, items)
  const p = await prisma.pedido.create({ data: { reservacionId: rv.id, origen: 'QR_SALA', total, items: { create: lineas } } })
  res.status(201).json({ pedidoId: p.id, estado: p.estado })
}))

export default r
