import rateLimit from 'express-rate-limit'
const mk = (min: number, limit: number, error: string) =>
  rateLimit({ windowMs: min * 60_000, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error } })

export const generalLimiter = mk(15, 300, 'Demasiadas solicitudes, intenta más tarde')
export const loginLimiter = mk(15, 10, 'Demasiados intentos de inicio de sesión')
export const limiterEscritura = mk(15, 20, 'Demasiadas reservaciones desde esta red')
export const limiterConsulta = mk(15, 30, 'Demasiados intentos, espera unos minutos') // frena adivinar códigos
export const limiterRegistro = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados registros desde esta red' } })
