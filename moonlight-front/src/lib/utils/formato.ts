// Formato de dinero, fechas y horas. Todo en la zona horaria del negocio.
import type { Dinero } from '../api/types.ts'

export const TZ = 'America/Mexico_City'

const mx = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const hora = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
const reloj = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

type Fecha = string | number | Date

export const num = (v: Dinero | null | undefined) => Number(v || 0)
export const money = (v: Dinero | null | undefined) => mx.format(num(v))
export const fmtHora = (d: Fecha) => hora.format(new Date(d))
export const fmtFecha = (d: Fecha) => fecha.format(new Date(d))
export const fmtFechaHora = (d: Fecha) => `${fmtFecha(d)} · ${fmtHora(d)}`
export const fmtRango = (a: Fecha, b: Fecha) => `${fmtFecha(a)} · ${fmtHora(a)}–${fmtHora(b)}`
export const fmtReloj = (d: Fecha) => reloj.format(new Date(d))

/** Fecha (YYYY-MM-DD) de hoy + offset en días, en la zona horaria del negocio. */
export const hoyLocal = (offsetDias = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + offsetDias * 864e5))

export const durTxt = (min: number) => (min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`)

export const slug = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** "1 d 4 h", "2 h 05 min", "12:09" (mm:ss si falta menos de una hora). */
export function falta(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60
  if (d) return `${d} d ${hh} h`
  if (hh) return `${hh} h ${String(mm).padStart(2, '0')} min`
  return `${mm}:${String(ss).padStart(2, '0')}`
}

export const lineas = (txt: string | null | undefined) => (txt || '').split('\n').map((x) => x.trim()).filter(Boolean)
