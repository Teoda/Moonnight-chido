import type { RequestHandler } from 'express'
import type { Rol } from '@prisma/client'
import { config } from '../config'
import { ah, safeEq } from '../util'
import { validarSesion, csrfDe, type TipoSesion } from '../security/session'

/** Lee la sesión del tipo indicado (cada tipo tiene su propia cookie). */
export const cargarSesion = (tipo: TipoSesion): RequestHandler => ah(async (req, res, next) => {
  req.auth = (await validarSesion(req, res, tipo)) ?? undefined
  next()
})

// Una sesión de cliente NUNCA sirve para rutas del personal, y viceversa.
export const requireStaff: RequestHandler = (req, res, next) =>
  req.auth?.usuario ? next() : void res.status(401).json({ error: 'No autenticado' })
export const requireCliente: RequestHandler = (req, res, next) =>
  req.auth?.cliente ? next() : void res.status(401).json({ error: 'Inicia sesión para continuar' })

/** ADMIN puede todo; el resto solo los roles indicados. */
export const requireRol = (...roles: Rol[]): RequestHandler => (req, res, next) => {
  const rol = req.auth?.usuario?.rol
  if (!rol) return void res.status(401).json({ error: 'No autenticado' })
  if (rol === 'ADMIN' || roles.includes(rol)) return next()
  res.status(403).json({ error: 'Sin permiso' })
}

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])
export const csrf: RequestHandler = (req, res, next) => {
  if (SEGUROS.has(req.method)) return next()
  const origin = req.get('origin')
  if (origin && !config.allowedOrigins.includes(origin)) return void res.status(403).json({ error: 'Origen no permitido' })
  const t = req.get('x-csrf-token')
  if (!req.auth || !t || !safeEq(t, csrfDe(req.auth.token))) return void res.status(403).json({ error: 'Token CSRF inválido' })
  next()
}
