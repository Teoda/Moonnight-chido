// Todo el negocio opera en hora de México (UTC-6, sin horario de verano desde 2022),
// sin importar en qué zona horaria corra el servidor.
export const MIN = 60_000
const OFFSET_H = 6
export type Horario = { diaSemana: number; abre: string; cierra: string }

export const aFecha = (fecha: string, hhmm: string) => new Date(`${fecha}T${hhmm}:00-0${OFFSET_H}:00`)
export function partes(d: Date) {
  const l = new Date(d.getTime() - OFFSET_H * 3600_000)
  return { fecha: l.toISOString().slice(0, 10), anio: l.getUTCFullYear(), mes: l.getUTCMonth() }
}
export const sumarDias = (fecha: string, n: number) => {
  const d = new Date(fecha + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
export const inicioDiaLocal = (d = new Date()) => aFecha(partes(d).fecha, '00:00')
export function rangoMesLocal(d: Date) {
  const { anio, mes } = partes(d)
  const f = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  return { desde: aFecha(f(anio, mes), '00:00'), hasta: aFecha(f(anio, mes + 1), '00:00') }
}
function ventanaSimple(fecha: string, hs: Horario[]) {
  const h = hs.find((x) => x.diaSemana === new Date(fecha + 'T00:00:00Z').getUTCDay())
  if (!h) return null
  const abre = aFecha(fecha, h.abre)
  let cierra = aFecha(fecha, h.cierra)
  if (cierra <= abre) cierra = new Date(cierra.getTime() + 86400_000)
  return { abre, cierra }
}
/**
 * Ventana de operación del día `fecha` (YYYY-MM-DD). Si cierra <= abre, cierra de madrugada del día siguiente.
 * `cierraDia` es el cierre de ese día; `cierra` se extiende si el día siguiente abre justo a esa hora
 * (operación continua, p. ej. 24 h): así una reservación puede cruzar la medianoche.
 */
export function ventanaDelDia(fecha: string, hs: Horario[]) {
  const v = ventanaSimple(fecha, hs)
  if (!v) return null
  const sig = ventanaSimple(sumarDias(fecha, 1), hs)
  return { abre: v.abre, cierraDia: v.cierra, cierra: sig && sig.abre.getTime() === v.cierra.getTime() ? sig.cierra : v.cierra }
}
/** Ventana de operación que contiene `inicio` (considera la madrugada del día siguiente). */
export function ventanaQueContiene(inicio: Date, hs: Horario[]) {
  const f = partes(inicio).fecha
  for (const dia of [f, sumarDias(f, -1)]) {
    const v = ventanaDelDia(dia, hs)
    if (v && inicio >= v.abre && inicio < v.cierra) return v
  }
  return null
}
