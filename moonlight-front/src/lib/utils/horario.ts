// Ayudas del horario del personal (ver HorarioPersonal en api/types.ts).
import type { AreaTrabajo, HorarioPersonal } from '../api/types.ts'
import { TZ } from './formato.ts'

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const AREAS: Record<AreaTrabajo, { nombre: string; detalle: string }> = {
  PLANTA_BAJA: { nombre: 'Planta baja', detalle: 'Recepción y bar' },
  SALAS: { nombre: 'Salas', detalle: 'Pisos 2 y 3' },
}

const partes = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false })
const SEMANA = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Día y hora en México. Antes de las 06:00 sigue contando como el día anterior: el turno de la noche cierra a las 02:00. */
export function momentoOperativo(t = Date.now()) {
  const p = Object.fromEntries(partes.formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  const h = Number(p.hour) % 24, min = h * 60 + Number(p.minute)
  const dia = SEMANA.indexOf(p.weekday)
  return min < 6 * 60 ? { dia: (dia + 6) % 7, min: min + 24 * 60 } : { dia, min }
}

const aMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
/** Turno en curso según la hora (minutos del día operativo; el fin 02:00 cuenta como 26:00). */
export function turnoEnCurso(h: HorarioPersonal, min: number) {
  return h.turnos.find((t) => { const a = aMin(t.inicio); let b = aMin(t.fin); if (b <= a) b += 24 * 60; return min >= a && min < b })?.n ?? null
}
