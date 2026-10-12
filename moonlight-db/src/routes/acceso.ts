// Inicio de sesión unificado: un mismo formulario para el personal y los clientes.
// Revisa las dos cuentas con las mismas protecciones que los logins separados (/api/auth/login y
// /api/cliente/login, que se conservan): mismo mensaje y mismo tiempo de respuesta exista o no la cuenta,
// bloqueo de 15 min tras 5 fallos y un solo intento contra el límite por IP.
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db'
import { ah } from '../util'
import { crearSesion, revocarActual, csrfDe } from '../security/session'
import { loginLimiter } from '../middleware/limiters'

const r = Router()
const DUMMY = bcrypt.hashSync('hash-de-relleno', 10) // para gastar el mismo tiempo si la cuenta no existe
const MAX_INTENTOS = 5, BLOQUEO_MS = 15 * 60_000
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(150), password: z.string().min(1).max(200) })

/** Suma un intento fallido y bloquea la cuenta al llegar al máximo. */
async function fallo(tabla: 'usuario' | 'cliente', id: number) {
  const modelo = prisma[tabla] as typeof prisma.usuario // mismas columnas en ambas tablas
  const n = await modelo.update({ where: { id }, data: { intentosFallidos: { increment: 1 } } })
  if (n.intentosFallidos >= MAX_INTENTOS)
    await modelo.update({ where: { id }, data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS) } })
}

r.post('/login', loginLimiter, ah(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const ahora = new Date()
  const [u, c] = await Promise.all([prisma.usuario.findUnique({ where: { email } }), prisma.cliente.findUnique({ where: { email } })])
  const uBloq = !!u?.bloqueadoHasta && u.bloqueadoHasta > ahora
  const cBloq = !!c?.bloqueadoHasta && c.bloqueadoHasta > ahora
  // Siempre se hacen las dos comparaciones (con un hash de relleno si no hay cuenta): el tiempo no revela nada.
  const [pwU, pwC] = await Promise.all([
    bcrypt.compare(password, u && !uBloq ? u.passwordHash : DUMMY),
    bcrypt.compare(password, c?.passwordHash && !cBloq ? c.passwordHash : DUMMY),
  ])
  const okU = !!u && u.activo && !uBloq && pwU
  const okC = !!c?.passwordHash && !cBloq && pwC

  // Personal: si un correo tiene ambas cuentas y las dos contraseñas coinciden, entra al panel.
  if (okU) {
    await prisma.usuario.update({ where: { id: u.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
    await prisma.sesion.deleteMany({ where: { usuarioId: u.id, expiraEn: { lt: ahora } } })
    await revocarActual(req, 'staff') // rotación: nunca se reutiliza un id de sesión previo
    const token = await crearSesion(req, res, { usuarioId: u.id, rol: u.rol })
    return void res.json({ tipo: 'staff', usuario: { id: u.id, nombre: u.nombre, rol: u.rol }, csrfToken: csrfDe(token) })
  }
  if (okC) {
    await prisma.cliente.update({ where: { id: c.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
    await revocarActual(req, 'cliente')
    const token = await crearSesion(req, res, { clienteId: c.id })
    return void res.json({ tipo: 'cliente', cliente: { id: c.id, nombre: c.nombre, email: c.email }, csrfToken: csrfDe(token) })
  }

  // Ninguna coincidió: cuenta el intento fallido en las cuentas que existen (si no están ya bloqueadas)
  if (u && !uBloq) await fallo('usuario', u.id)
  if (c?.passwordHash && !cBloq) await fallo('cliente', c.id)
  res.status(401).json({ error: 'Credenciales inválidas o cuenta bloqueada temporalmente' }) // mismo mensaje en todos los casos
}))

export default r
