import { randomBytes } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from './db'
import { HttpError } from './util'
import { MIN, ventanaDelDia, ventanaQueContiene } from './tiempo'
import { armarItems } from './pedidos'

type Db = PrismaClient | Prisma.TransactionClient

export async function getConfig(db: Db) {
  const m = Object.fromEntries((await db.configuracion.findMany()).map((r) => [r.clave, r.valor]))
  const n = (k: string, d: number) => Number(m[k] ?? d)
  return {
    limpiezaMin: n('limpiezaMin', 15), pasoMin: n('pasoMin', 30), durMin: n('duracionMinMin', 60), durMax: n('duracionMaxMin', 240),
    anticipoSalaPct: n('anticipoSalaPct', 50),          // % de la sala que se paga en línea; el resto, al llegar
    anticipoPedidoPct: n('anticipoPedidoPct', 30), horasCancelacion: n('horasCancelacionConReembolso', 24),
    retencionTardiaPct: n('retencionTardiaPct', 30), toleranciaMin: n('toleranciaLlegadaMin', 10),
    ingresoAnticipadoMin: n('ingresoAnticipadoMin', 15), // check-in permitido hasta estos min antes del inicio
    vencePendienteMin: n('minutosVencimientoPendientePago', 30),
    cortesiaTipo: m.cortesiaTipoSala ?? 'PREMIUM',       // tipo de sala que incluye botella de cortesía
    cortesiaTopePrecio: n('cortesiaTopePrecio', 550),    // el cliente elige entre las botellas de hasta este precio
  }
}

/** Botellas que el cliente puede elegir como cortesía (botellas activas con precio <= tope). */
export function botellasCortesia(db: Db, topePrecio: number) {
  return db.productoMenu.findMany({
    where: { activo: true, alcohol: true, categoria: 'BEBIDA', seccion: { startsWith: 'Botellas' }, precio: { lte: topePrecio } },
    orderBy: { orden: 'asc' }, select: { id: true, nombre: true, precio: true },
  })
}

/** Valida la botella de cortesía: obligatoria para el tipo de sala que la incluye y prohibida para los demás. */
async function lineaCortesia(db: Db, cfg: Awaited<ReturnType<typeof getConfig>>, tipoCodigo: string, productoId?: number) {
  if (tipoCodigo !== cfg.cortesiaTipo) {
    if (productoId) throw new HttpError(400, 'La botella de cortesía solo aplica para la Sala Premium')
    return null
  }
  if (!productoId) throw new HttpError(400, 'Elige la botella de cortesía incluida con la Sala Premium')
  const permitidas = await botellasCortesia(db, cfg.cortesiaTopePrecio)
  if (!permitidas.some((p) => p.id === productoId)) throw new HttpError(400, 'Esa botella no está disponible como cortesía')
  return { productoId, cantidad: 1, precioUnitario: new Prisma.Decimal(0) }
}

/** Reservaciones que bloquean una sala (las pendientes de pago solo hasta que vencen). */
export const bloquean = () => ({
  OR: [{ estado: { in: ['CONFIRMADA' as const, 'EN_CURSO' as const] } }, { estado: 'PENDIENTE_PAGO' as const, expiraEn: { gt: new Date() } }],
})

export async function tipoPorPersonas(db: Db, n: number) {
  const t = await db.tipoSala.findFirst({ where: { capacidadMin: { lte: n }, capacidadMax: { gte: n } } })
  if (!t) throw new HttpError(400, 'No hay salas para esa cantidad de personas')
  return t
}

/** Tipo de sala: el que eligió el cliente (validando que quepan las personas) o, si no eligió, el que corresponde por personas. */
export async function resolverTipo(db: Db, p: { tipoSalaId?: number; personas?: number }) {
  if (!p.tipoSalaId) {
    if (!p.personas) throw new HttpError(400, 'Elige el tamaño de la sala')
    return tipoPorPersonas(db, p.personas)
  }
  const t = await db.tipoSala.findUnique({ where: { id: p.tipoSalaId } })
  if (!t) throw new HttpError(400, 'Ese tamaño de sala no existe')
  if (p.personas && p.personas > t.capacidadMax) throw new HttpError(400, `La Sala ${t.nombre} es para máximo ${t.capacidadMax} personas`)
  return t
}

/**
 * Música de la reservación: un género (temática activa) o "mi propia lista".
 * Si se escriben artistas deben ser al menos 3; sin género, los 3 artistas son obligatorios.
 */
export async function validarMusica(db: Db, m: { tematicaId?: number; artistas?: string[]; canciones?: string[] }, opt: { obligatoria: boolean }) {
  const artistas = [...new Set((m.artistas ?? []).map((a) => a.trim()).filter(Boolean))]
  const canciones = (m.canciones ?? []).map((c) => c.trim()).filter(Boolean)
  if (m.tematicaId && !(await db.tematica.findFirst({ where: { id: m.tematicaId, activo: true } })))
    throw new HttpError(400, 'Ese género musical no está disponible')
  if (artistas.length && artistas.length < 3) throw new HttpError(400, 'Escribe al menos 3 artistas distintos')
  if (opt.obligatoria && !m.tematicaId && !artistas.length)
    throw new HttpError(400, 'Elige un género musical o escribe al menos 3 artistas de tu gusto')
  return {
    tematicaId: m.tematicaId ?? null,
    artistas: artistas.length ? artistas.join('\n') : null,
    canciones: canciones.length ? canciones.join('\n') : null,
  }
}

/**
 * Dos reservaciones en la misma sala chocan si una empieza antes de que la otra termine MÁS el tiempo de limpieza:
 *   otra.inicio < nueva.fin + limpieza   Y   otra.fin + limpieza > nueva.inicio
 * Ej.: una sala de 18:00 a 19:00 con 15 min de limpieza no puede iniciar otra reservación antes de las 19:15
 * (en la rejilla de 30 min, a las 19:30).
 */
export function salasLibres(db: Db, p: {
  tipoSalaId: number; salaNumero?: number; inicio: Date; fin: Date; limpiezaMin: number
  ignorarReservacionId?: number
}) {
  const B = p.limpiezaMin * MIN
  return db.sala.findMany({
    where: {
      tipoSalaId: p.tipoSalaId,
      estado: 'ACTIVA' as const, // en Limpieza o Mantenimiento no se ofrece para ninguna reservación nueva
      ...(p.salaNumero ? { numero: p.salaNumero } : {}),
      reservaciones: { none: { ...bloquean(), id: p.ignorarReservacionId ? { not: p.ignorarReservacionId } : undefined, inicio: { lt: new Date(p.fin.getTime() + B) }, fin: { gt: new Date(p.inicio.getTime() - B) } } },
    },
    orderBy: { numero: 'asc' },
  })
}

/** ¿Hay otra reservación en esa sala que choque con [inicio, fin] (considerando limpieza)? */
export async function hayConflicto(db: Db, salaId: number, inicio: Date, fin: Date, ignorarId: number, limpiezaMin: number) {
  const B = limpiezaMin * MIN
  return (await db.reservacion.count({
    where: { salaId, id: { not: ignorarId }, ...bloquean(), inicio: { lt: new Date(fin.getTime() + B) }, fin: { gt: new Date(inicio.getTime() - B) } },
  })) > 0
}

/** Horarios de inicio disponibles de un día (cada `pasoMin` min), con cuántas salas quedan libres. */
export async function horariosDisponibles(db: Db, p: { fecha: string; personas?: number; tipoSalaId?: number; duracionMin: number }) {
  const [cfg, hs] = await Promise.all([getConfig(db), db.horarioOperacion.findMany({ where: { activo: true } })])
  const v = ventanaDelDia(p.fecha, hs)
  if (!v) return { cerrado: true, slots: [] as { inicio: string; disponibles: number }[] }
  const tipo = await resolverTipo(db, p)
  const salas = await db.sala.findMany({ where: { tipoSalaId: tipo.id, estado: 'ACTIVA' }, select: { id: true } }) // ni en limpieza ni en mantenimiento
  const B = cfg.limpiezaMin * MIN
  const rs = salas.length ? await db.reservacion.findMany({
    where: { salaId: { in: salas.map((s) => s.id) }, ...bloquean(), inicio: { lt: new Date(v.cierra.getTime() + B) }, fin: { gt: new Date(v.abre.getTime() - B) } },
    select: { salaId: true, inicio: true, fin: true },
  }) : []
  const dur = p.duracionMin * MIN, ahora = Date.now(), slots: { inicio: string; disponibles: number }[] = []
  for (let t = v.abre.getTime(); t < v.cierraDia.getTime() && t + dur <= v.cierra.getTime(); t += cfg.pasoMin * MIN) {
    if (t < ahora) continue
    const n = salas.filter((s) => !rs.some((r) => r.salaId === s.id && r.inicio.getTime() < t + dur + B && r.fin.getTime() > t - B)).length
    if (n) slots.push({ inicio: new Date(t).toISOString(), disponibles: n })
  }
  return { cerrado: false, tipo: tipo.nombre, slots }
}

/** Valida duración, horario de operación y (en web) que el inicio caiga en la rejilla de 30 min. */
export async function validarSlot(db: Db, inicio: Date, fin: Date, opt: { mostrador?: boolean } = {}) {
  const [cfg, hs] = await Promise.all([getConfig(db), db.horarioOperacion.findMany({ where: { activo: true } })])
  const dur = (fin.getTime() - inicio.getTime()) / MIN
  if (dur < cfg.durMin || dur > cfg.durMax || dur % cfg.pasoMin !== 0)
    throw new HttpError(400, `La duración debe ser de ${cfg.durMin / 60} a ${cfg.durMax / 60} horas, en pasos de ${cfg.pasoMin} minutos`)
  const v = ventanaQueContiene(inicio, hs)
  if (!v || fin.getTime() > v.cierra.getTime()) throw new HttpError(400, 'Fuera del horario de operación')
  if (!opt.mostrador) { // en mostrador se puede iniciar en cualquier minuto (ingreso inmediato)
    if (inicio.getTime() < Date.now()) throw new HttpError(400, 'Esa hora ya pasó')
    if (((inicio.getTime() - v.abre.getTime()) / MIN) % cfg.pasoMin !== 0) throw new HttpError(400, `Los horarios inician cada ${cfg.pasoMin} minutos`)
  }
  return cfg
}

/** Crea la reservación (y su preorden, si aplica) en una transacción serializable: evita dobles reservas. */
export async function crearReservacion(d: {
  clienteId: number; personas: number; tipoSalaId?: number; salaNumero?: number; inicio: Date; fin: Date
  canal: 'WEB' | 'MOSTRADOR'; creadaPorId?: number; items?: { productoId: number; cantidad: number }[]
  mostrador?: { metodo: 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO'; iniciarAhora: boolean }
  cortesiaProductoId?: number // botella incluida con la Sala Premium
  musica: { tematicaId: number | null; artistas: string | null; canciones: string | null } // ya validada (validarMusica)
}) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const cfg = await getConfig(tx)
        const tipo = await resolverTipo(tx, { tipoSalaId: d.tipoSalaId, personas: d.personas })
        const cortesia = await lineaCortesia(tx, cfg, tipo.codigo, d.cortesiaProductoId)
        const [sala] = await salasLibres(tx, { tipoSalaId: tipo.id, salaNumero: d.salaNumero, inicio: d.inicio, fin: d.fin, limpiezaMin: cfg.limpiezaMin })
        if (!sala) throw new HttpError(409, 'No hay salas disponibles en ese horario')
        const horas = new Prisma.Decimal((d.fin.getTime() - d.inicio.getTime()) / MIN).div(60)
        const subtotalSala = tipo.precioHora.mul(horas).toDecimalPlaces(2)
        const web = d.canal === 'WEB'
        // En línea se paga un anticipo de la sala; sin registro (mostrador) se paga completa
        const anticipoSala = web ? subtotalSala.mul(cfg.anticipoSalaPct).div(100).toDecimalPlaces(2) : subtotalSala
        const rv = await tx.reservacion.create({
          data: {
            codigo: 'ML' + randomBytes(4).toString('hex').toUpperCase(),
            clienteId: d.clienteId, salaId: sala.id, inicio: d.inicio, fin: d.fin, personas: d.personas, canal: d.canal, subtotalSala, anticipoSala,
            estado: web ? 'PENDIENTE_PAGO' : d.mostrador!.iniciarAhora ? 'EN_CURSO' : 'CONFIRMADA',
            expiraEn: web ? new Date(Date.now() + cfg.vencePendienteMin * MIN) : null,
            checkInEn: d.mostrador?.iniciarAhora ? new Date() : null, creadaPorId: d.creadaPorId, ...d.musica,
          },
        })
        // Preorden: lo pedido en línea (se anticipa un %) + la botella de cortesía ($0). Queda EN_ESPERA
        // y recepción la libera a barra cuando el cliente ya ingresó.
        let anticipoPedido = new Prisma.Decimal(0)
        const preorden = web && d.items?.length ? await armarItems(tx, d.items) : { lineas: [], total: new Prisma.Decimal(0) }
        const lineas = cortesia ? [...preorden.lineas, cortesia] : preorden.lineas
        if (lineas.length) {
          anticipoPedido = preorden.total.mul(cfg.anticipoPedidoPct).div(100).toDecimalPlaces(2)
          await tx.pedido.create({
            data: {
              reservacionId: rv.id, origen: 'PREORDEN', estado: 'EN_ESPERA', total: preorden.total, anticipo: anticipoPedido,
              notas: cortesia ? 'Incluye botella de cortesía (Sala Premium)' : null, items: { create: lineas },
            },
          })
        }
        if (d.mostrador)
          await tx.pago.create({ data: { reservacionId: rv.id, tipo: 'SALA', metodo: d.mostrador.metodo, monto: subtotalSala, enLinea: false, registradoPorId: d.creadaPorId } })
        return { reservacion: rv, sala, subtotalSala, anticipoSala, anticipoPedido, aPagarEnLinea: anticipoSala.add(anticipoPedido) }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (e: any) {
      if (e.code === 'P2034' && intento < 2) continue
      throw e
    }
  }
  throw new HttpError(409, 'Conflicto simultáneo, intenta de nuevo')
}
