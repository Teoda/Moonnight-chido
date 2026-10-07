import crypto from 'node:crypto'
import type { Request, Response, CookieOptions } from 'express'
import { prisma } from '../db'
import { config } from '../config'

// "__Host-" obliga al navegador a exigir Secure + Path=/ + sin Domain (no se puede fijar desde subdominios).
export const COOKIE = config.isProd ? '__Host-ml_sid' : 'ml_sid'
const cookieOpts: CookieOptions = { httpOnly: true, secure: config.isProd, sameSite: 'strict', path: '/' }
const sha256 = (t: string) => crypto.createHash('sha256').update(t).digest('hex')

/** Crea una sesión NUEVA (token de 256 bits) para un usuario del personal o un cliente. */
export async function crearSesion(req: Request, res: Response, quien: { usuarioId: number } | { clienteId: number }) {
  const lim = 'usuarioId' in quien ? config.staff : config.cliente
  const token = crypto.randomBytes(32).toString('base64url')
  await prisma.sesion.create({
    data: { id: sha256(token), ...quien, expiraEn: new Date(Date.now() + lim.absoluteMs), ip: req.ip?.slice(0, 45), userAgent: req.get('user-agent')?.slice(0, 255) },
  })
  res.cookie(COOKIE, token, { ...cookieOpts, maxAge: lim.absoluteMs })
  return token
}

export async function validarSesion(req: Request) {
  const token = req.cookies?.[COOKIE]
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const row = await prisma.sesion.findUnique({ where: { id: sha256(token) }, include: { usuario: true, cliente: true } })
  if (!row) return null
  const lim = row.clienteId ? config.cliente : config.staff
  const ahora = Date.now()
  const activa = row.usuario ? row.usuario.activo : !!row.cliente
  if (row.expiraEn.getTime() < ahora || ahora - row.ultimaActividad.getTime() > lim.idleMs || !activa) {
    await prisma.sesion.delete({ where: { id: row.id } }).catch(() => {})
    return null
  }
  if (ahora - row.ultimaActividad.getTime() > 60_000)
    await prisma.sesion.update({ where: { id: row.id }, data: { ultimaActividad: new Date() } }).catch(() => {})
  const { usuario, cliente, ...sesion } = row
  return { token, sesion, usuario: usuario ?? undefined, cliente: cliente ?? undefined }
}

export async function revocarActual(req: Request) {
  const token = req.cookies?.[COOKIE]
  if (typeof token === 'string') await prisma.sesion.deleteMany({ where: { id: sha256(token) } })
}
export async function cerrarSesion(req: Request, res: Response) {
  await revocarActual(req)
  res.clearCookie(COOKIE, cookieOpts)
}
export const csrfDe = (token: string) => crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex')
