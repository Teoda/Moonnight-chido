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
  port: Number(e.PORT ?? 3000),
  sessionSecret,
  allowedOrigins,
  trustProxy: Number(e.TRUST_PROXY ?? 1),
  staff: { idleMs: 30 * 60_000, absoluteMs: 8 * 3600_000 },          // personal: 30 min de inactividad / 8 h máx.
  cliente: { idleMs: 2 * 3600_000, absoluteMs: 7 * 24 * 3600_000 }, // clientes: 2 h de inactividad / 7 días máx.
  pagosSimulados: e.PAGOS_SIMULADOS ? e.PAGOS_SIMULADOS === 'true' : !isProd,
}
