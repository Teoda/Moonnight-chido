import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db'
import { ah } from '../util'
import { crearSesion, cerrarSesion, revocarActual, csrfDe } from '../security/session'
import { requireStaff, csrf } from '../middleware/auth'
import { loginLimiter } from '../middleware/limiters'

const r = Router()
const DUMMY = bcrypt.hashSync('hash-de-relleno', 10) // para gastar el mismo tiempo si el usuario no existe
const MAX_INTENTOS = 5, BLOQUEO_MS = 15 * 60_000
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(150), password: z.string().min(1).max(200) })
const nuevaPw = z.string().min(10, 'Mínimo 10 caracteres').max(200).regex(/[A-Za-z]/, 'Incluye letras').regex(/\d/, 'Incluye números')
const publico = (u: { id: number; nombre: string; rol: string }) => ({ id: u.id, nombre: u.nombre, rol: u.rol })

r.post('/login', loginLimiter, ah(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const u = await prisma.usuario.findUnique({ where: { email } })
  const bloqueado = !!u?.bloqueadoHasta && u.bloqueadoHasta > new Date()
  const ok = await bcrypt.compare(password, u && !bloqueado ? u.passwordHash : DUMMY)

  if (!u || !u.activo || bloqueado || !ok) {
    if (u && !bloqueado && !ok) {
      const n = await prisma.usuario.update({ where: { id: u.id }, data: { intentosFallidos: { increment: 1 } } })
      if (n.intentosFallidos >= MAX_INTENTOS)
        await prisma.usuario.update({ where: { id: u.id }, data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS) } })
    }
    // Mismo mensaje en todos los casos: no revela si el correo existe.
    return void res.status(401).json({ error: 'Credenciales inválidas o cuenta bloqueada temporalmente' })
  }

  await prisma.usuario.update({ where: { id: u.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
  await prisma.sesion.deleteMany({ where: { usuarioId: u.id, expiraEn: { lt: new Date() } } })
  await revocarActual(req, 'staff')                // rotación: nunca se reutiliza un id de sesión previo
  const token = await crearSesion(req, res, { usuarioId: u.id, rol: u.rol })  // (evita fijación de sesión)
  res.json({ usuario: publico(u), csrfToken: csrfDe(token) })
}))

r.get('/me', requireStaff, (req, res) =>
  void res.json({ usuario: publico(req.auth!.usuario!), csrfToken: csrfDe(req.auth!.token) }))

r.post('/logout', requireStaff, csrf, ah(async (req, res) => {
  await cerrarSesion(req, res, 'staff')
  res.json({ ok: true })
}))

r.post('/logout-todas', requireStaff, csrf, ah(async (req, res) => {
  await prisma.sesion.deleteMany({ where: { usuarioId: req.auth!.usuario!.id } })
  await cerrarSesion(req, res, 'staff')
  res.json({ ok: true })
}))

r.post('/cambiar-password', requireStaff, csrf, ah(async (req, res) => {
  const { actual, nueva } = z.object({ actual: z.string().max(200), nueva: nuevaPw }).parse(req.body)
  const u = req.auth!.usuario!
  if (!(await bcrypt.compare(actual, u.passwordHash))) return void res.status(401).json({ error: 'Contraseña actual incorrecta' })
  await prisma.usuario.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(nueva, 12) } })
  // Cierra todas las demás sesiones: si alguien tenía una robada, deja de servir.
  await prisma.sesion.deleteMany({ where: { usuarioId: u.id, id: { not: req.auth!.sesion.id } } })
  res.json({ ok: true })
}))

export default r
