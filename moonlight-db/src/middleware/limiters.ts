import rateLimit from 'express-rate-limit'
import type { Request } from 'express'
const mk = (min: number, limit: number, error: string, skip?: (req: Request) => boolean) =>
  rateLimit({ windowMs: min * 60_000, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error }, skip })

// Tope amplio ANTES de leer la sesión: frena inundaciones sin consultar la base de datos.
export const floodLimiter = mk(15, 3000, 'Demasiadas solicitudes, intenta más tarde')
// Límite normal por IP. El personal autenticado queda fuera: las tabletas del local comparten IP
// y sus paneles se actualizan cada 15 s.
export const generalLimiter = mk(15, 300, 'Demasiadas solicitudes, intenta más tarde', (req) => !!req.auth?.usuario)
export const loginLimiter = mk(15, 10, 'Demasiados intentos de inicio de sesión')
export const limiterEscritura = mk(15, 20, 'Demasiadas reservaciones desde esta red')
export const limiterRegistro = mk(60, 10, 'Demasiados registros desde esta red')
