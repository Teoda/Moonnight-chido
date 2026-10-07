import crypto from 'node:crypto'
import type { RequestHandler } from 'express'

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
/** Envuelve handlers async para que los errores lleguen al manejador central. */
export const ah = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
/** Comparación en tiempo constante (evita ataques de temporización). */
export const safeEq = (a: string, b: string) => {
  const h = (s: string) => crypto.createHash('sha256').update(s).digest()
  return crypto.timingSafeEqual(h(a), h(b))
}
export const normTel = (s: string) => s.replace(/\D/g, '').slice(-10)
