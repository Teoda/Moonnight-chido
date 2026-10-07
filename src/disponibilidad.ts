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
    anticipoPedidoPct: n('anticipoPedidoPct', 30), horasCancelacion: n('horasCancelacionConReembolso', 24),
    retencionTardiaPct: n('retencionTardiaPct', 30), toleranciaMin: n('toleranciaLlegadaMin', 10),
    vencePendienteMin: n('minutosVencimientoPendientePago', 30),
  }
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

/**
 * Dos reservaciones en la misma sala chocan si una empieza antes de que la otra termine MÁS el tiempo de limpieza:
 *   otra.inicio < nueva.fin + limpieza   Y   otra.fin + limpieza > nueva.inicio
 * Ej.: una sala de 18:00 a 19:00 con 15 min de limpieza no puede iniciar otra reservación antes de las 19:15
 * (en la rejilla de 30 min, a las 19:30).
 */
export function salasLibres(db: Db, p: {
  tipoSalaId: number; tematicaId?: number; salaNumero?: number; inicio: Date; fin: Date; limpiezaMin: number
  ignorarReservacionId?: number; listas?: boolean
}) {
  const B = p.limpiezaMin * MIN
  return db.sala.findMany({
    where: {
      tipoSalaId: p.tipoSalaId,
      estado: p.listas ? ('ACTIVA' as const) : { not: 'MANTENIMIENTO' as const }, // para ingresar YA, la sala debe estar limpia
      ...(p.tematicaId ? { tematicaId: p.tematicaId } : {}),
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
export async function horariosDisponibles(db: Db, p: { fecha: string; personas: number; tematicaId?: number; duracionMin: number }) {
  const [cfg, hs] = await Promise.all([getConfig(db), db.horarioOperacion.findMany({ where: { activo: true } })])
  const v = ventanaDelDia(p.fecha, hs)
  if (!v) return { cerrado: true, slots: [] as { inicio: string; disponibles: number }[] }
  const tipo = await tipoPorPersonas(db, p.personas)
  const salas = await db.sala.findMany({ where: { tipoSalaId: tipo.id, estado: { not: 'MANTENIMIENTO' }, ...(p.tematicaId ? { tematicaId: p.tematicaId } : {}) }, select: { id: true } })
  const B = cfg.limpiezaMin * MIN
  const rs = salas.length ? await db.reservacion.findMany({
    where: { salaId: { in: salas.map((s) => s.id) }, ...bloquean(), inicio: { lt: new Date(v.cierra.getTime() + B) }, fin: { gt: new Date(v.abre.getTime() - B) } },
    select: { salaId: true, inicio: true, fin: true },
  }) : []
  const dur = p.duracionMin * MIN, ahora = Date.now(), slots: { inicio: string; disponibles: number }[] = []
  for (let t = v.abre.getTime(); t + dur <= v.cierra.getTime(); t += cfg.pasoMin * MIN) {
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
  clienteId: number; personas: number; tematicaId?: number; salaNumero?: number; inicio: Date; fin: Date
  canal: 'WEB' | 'MOSTRADOR'; creadaPorId?: number; items?: { productoId: number; cantidad: number }[]
  mostrador?: { metodo: 'EFECTIVO' | 'TARJETA'; iniciarAhora: boolean }
}) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const cfg = await getConfig(tx)
        const tipo = await tipoPorPersonas(tx, d.personas)
        const [sala] = await salasLibres(tx, { tipoSalaId: tipo.id, tematicaId: d.tematicaId, salaNumero: d.salaNumero, inicio: d.inicio, fin: d.fin, limpiezaMin: cfg.limpiezaMin, listas: d.mostrador?.iniciarAhora })
        if (!sala) throw new HttpError(409, 'No hay salas disponibles en ese horario')
        const horas = new Prisma.Decimal((d.fin.getTime() - d.inicio.getTime()) / MIN).div(60)
        const subtotalSala = tipo.precioHora.mul(horas).toDecimalPlaces(2)
        const web = d.canal === 'WEB'
        const rv = await tx.reservacion.create({
          data: {
            codigo: 'ML' + randomBytes(4).toString('hex').toUpperCase(),
            clienteId: d.clienteId, salaId: sala.id, inicio: d.inicio, fin: d.fin, personas: d.personas, canal: d.canal, subtotalSala,
            estado: web ? 'PENDIENTE_PAGO' : d.mostrador!.iniciarAhora ? 'EN_CURSO' : 'CONFIRMADA',
            expiraEn: web ? new Date(Date.now() + cfg.vencePendienteMin * MIN) : null,
            checkInEn: d.mostrador?.iniciarAhora ? new Date() : null, creadaPorId: d.creadaPorId,
          },
        })
        let anticipoPedido = new Prisma.Decimal(0)
        if (web && d.items?.length) {
          const { lineas, total } = await armarItems(tx, d.items)
          anticipoPedido = total.mul(cfg.anticipoPedidoPct).div(100).toDecimalPlaces(2)
          await tx.pedido.create({ data: { reservacionId: rv.id, origen: 'PREORDEN', estado: 'EN_ESPERA', total, anticipo: anticipoPedido, items: { create: lineas } } })
        }
        if (d.mostrador)
          await tx.pago.create({ data: { reservacionId: rv.id, tipo: 'SALA', metodo: d.mostrador.metodo, monto: subtotalSala, enLinea: false, registradoPorId: d.creadaPorId } })
        return { reservacion: rv, sala, subtotalSala, anticipoPedido, aPagarEnLinea: subtotalSala.add(anticipoPedido) }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (e: any) {
      if (e.code === 'P2034' && intento < 2) continue
      throw e
    }
  }
  throw new HttpError(409, 'Conflicto simultáneo, intenta de nuevo')
}
