import crypto from 'node:crypto'
import type { Request, Response, CookieOptions } from 'express'
import type { Rol } from '@prisma/client'
import { prisma } from '../db'
import { config } from '../config'

// Una cookie para el personal y otra para los clientes: así iniciar sesión en el sitio de clientes
// no cierra la del panel (y viceversa) aunque se use el mismo navegador.
// "__Host-" obliga al navegador a exigir Secure + Path=/ + sin Domain (no se puede fijar desde subdominios).
export type TipoSesion = 'staff' | 'cliente'
const COOKIES: Record<TipoSesion, string> = config.isProd
  ? { staff: '__Host-ml_staff', cliente: '__Host-ml_cli' }
  : { staff: 'ml_staff', cliente: 'ml_cli' }
const cookieOpts: CookieOptions = { httpOnly: true, secure: config.isProd, sameSite: 'strict', path: '/' }
const sha256 = (t: string) => crypto.createHash('sha256').update(t).digest('hex')

/** Límites de la sesión: clientes, Administración (no expira mientras se use) o el resto del personal. */
const limites = (rol?: Rol) => (!rol ? config.cliente : rol === 'ADMIN' || rol === 'SUPERADMIN' ? config.admin : config.staff)

/** Crea una sesión NUEVA (token de 256 bits) para un usuario del personal o un cliente. */
export async function crearSesion(req: Request, res: Response, quien: { usuarioId: number; rol: Rol } | { clienteId: number }) {
  const tipo: TipoSesion = 'usuarioId' in quien ? 'staff' : 'cliente'
  const lim = limites('rol' in quien ? quien.rol : undefined)
  const token = crypto.randomBytes(32).toString('base64url')
  const dueno = 'usuarioId' in quien ? { usuarioId: quien.usuarioId } : { clienteId: quien.clienteId }
  await prisma.sesion.create({
    data: { id: sha256(token), ...dueno, expiraEn: new Date(Date.now() + lim.absoluteMs), ip: req.ip?.slice(0, 45), userAgent: req.get('user-agent')?.slice(0, 255) },
  })
  res.cookie(COOKIES[tipo], token, { ...cookieOpts, maxAge: lim.absoluteMs })
  return token
}

export async function validarSesion(req: Request, res: Response, tipo: TipoSesion) {
  const token = req.cookies?.[COOKIES[tipo]]
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const row = await prisma.sesion.findUnique({ where: { id: sha256(token) }, include: { usuario: true, cliente: true } })
  if (!row || (tipo === 'staff' ? !row.usuario : !row.cliente)) return null // la cookie de un tipo nunca sirve para el otro
  const lim = limites(row.usuario?.rol)
  const ahora = Date.now()
  const activa = row.usuario ? row.usuario.activo : !!row.cliente
  const inactiva = lim.idleMs !== null && ahora - row.ultimaActividad.getTime() > lim.idleMs
  if (row.expiraEn.getTime() < ahora || inactiva || !activa) {
    await prisma.sesion.delete({ where: { id: row.id } }).catch(() => {})
    res.clearCookie(COOKIES[tipo], cookieOpts)
    return null
  }
  if (ahora - row.ultimaActividad.getTime() > 60_000) {
    // Las sesiones renovables (Administración) recorren su vencimiento con cada uso: solo se cierran con "Salir".
    const renovar = lim.renovable ? { expiraEn: new Date(ahora + lim.absoluteMs) } : {}
    await prisma.sesion.update({ where: { id: row.id }, data: { ultimaActividad: new Date(), ...renovar } }).catch(() => {})
    if (lim.renovable) res.cookie(COOKIES[tipo], token, { ...cookieOpts, maxAge: lim.absoluteMs })
  }
  const { usuario, cliente, ...sesion } = row
  return { token, sesion, usuario: usuario ?? undefined, cliente: cliente ?? undefined }
}

export async function revocarActual(req: Request, tipo: TipoSesion) {
  const token = req.cookies?.[COOKIES[tipo]]
  if (typeof token === 'string') await prisma.sesion.deleteMany({ where: { id: sha256(token) } })
}
export async function cerrarSesion(req: Request, res: Response, tipo: TipoSesion) {
  await revocarActual(req, tipo)
  res.clearCookie(COOKIES[tipo], cookieOpts)
}
export const csrfDe = (token: string) => crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex')
