import 'dotenv/config'
import { randomBytes } from 'node:crypto'

const e = process.env
const isProd = e.NODE_ENV === 'production'
const allowedOrigins = (e.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean)

let sessionSecret = e.SESSION_SECRET ?? ''
if (sessionSecret.length < 32) {
  if (isProd) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres en producción.')
  sessionSecret = randomBytes(32).toString('hex') // solo desarrollo: cambia en cada reinicio
  console.warn('[aviso] SESSION_SECRET no definido: usando uno temporal de desarrollo.')
}
if (isProd && allowedOrigins.some((o) => !o.startsWith('https://')))
  throw new Error('En producción ALLOWED_ORIGINS debe usar https://')

export const config = {
  isProd,
  port: Number(e.PORT ?? 4000), // el front (moonlight-front) ocupa el 3000 y reenvía /api aquí
  sessionSecret,
  allowedOrigins,
  trustProxy: Number(e.TRUST_PROXY ?? 1),
  // Sesiones. idleMs: se cierra tras ese tiempo sin actividad (null = nunca). renovable: el vencimiento se recorre con cada uso.
  staff: { idleMs: 30 * 60_000 as number | null, absoluteMs: 8 * 3600_000, renovable: false },          // personal: 30 min de inactividad / 8 h máx.
  admin: { idleMs: null as number | null, absoluteMs: 400 * 24 * 3600_000, renovable: true },           // Administración: hasta que cierre sesión (400 días = máximo de una cookie)
  cliente: { idleMs: 60 * 60_000 as number | null, absoluteMs: 7 * 24 * 3600_000, renovable: false },  // clientes: 1 h de inactividad / 7 días máx.
  pagosSimulados: e.PAGOS_SIMULADOS ? e.PAGOS_SIMULADOS === 'true' : !isProd,
}
