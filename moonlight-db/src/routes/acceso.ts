// Inicio de sesión.
// - Clientes: correo y contraseña (mismo mensaje y mismo tiempo de respuesta exista o no la cuenta).
// - Personal: nombre del trabajador + llave de 8 dígitos. El personal ya no entra con correo.
// Ambos: bloqueo de 15 min tras 5 fallos y un solo intento contra el límite por IP.
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
export const llaveZ = z.string().regex(/^\d{8}$/, 'La llave tiene 8 números')

/** Suma un intento fallido y bloquea la cuenta al llegar al máximo. */
async function fallo(tabla: 'usuario' | 'cliente', id: number) {
  const modelo = prisma[tabla] as typeof prisma.usuario // mismas columnas en ambas tablas
  const n = await modelo.update({ where: { id }, data: { intentosFallidos: { increment: 1 } } })
  if (n.intentosFallidos >= MAX_INTENTOS)
    await modelo.update({ where: { id }, data: { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MS) } })
}

// ── clientes ──
r.post('/login', loginLimiter, ah(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const c = await prisma.cliente.findUnique({ where: { email } })
  const bloq = !!c?.bloqueadoHasta && c.bloqueadoHasta > new Date()
  const ok = await bcrypt.compare(password, c?.passwordHash && !bloq ? c.passwordHash : DUMMY)
  if (c?.passwordHash && !bloq && ok) {
    await prisma.cliente.update({ where: { id: c.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
    await revocarActual(req, 'cliente')
    const token = await crearSesion(req, res, { clienteId: c.id })
    return void res.json({ tipo: 'cliente', cliente: { id: c.id, nombre: c.nombre, email: c.email }, csrfToken: csrfDe(token) })
  }
  if (c?.passwordHash && !bloq) await fallo('cliente', c.id)
  res.status(401).json({ error: 'Credenciales inválidas o cuenta bloqueada temporalmente' }) // mismo mensaje en todos los casos
}))

// ── personal ──
/** Nombres del personal que puede entrar (para elegir en la pantalla de acceso del panel). */
r.get('/personal', ah(async (_req, res) => {
  res.json(await prisma.usuario.findMany({ where: { activo: true, llaveHash: { not: null } }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }))
}))

r.post('/personal/login', loginLimiter, ah(async (req, res) => {
  const { usuarioId, llave } = z.object({ usuarioId: z.number().int().positive(), llave: z.string().max(20) }).parse(req.body)
  const ahora = new Date()
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  const bloq = !!u?.bloqueadoHasta && u.bloqueadoHasta > ahora
  const usable = !!u?.llaveHash && u.activo && !bloq
  // siempre se compara (con un hash de relleno si no aplica): el tiempo de respuesta no revela nada
  const ok = (await bcrypt.compare(llave, usable ? u!.llaveHash! : DUMMY)) && usable && llaveZ.safeParse(llave).success
  if (!ok || !u) {
    if (u?.llaveHash && u.activo && !bloq) await fallo('usuario', u.id)
    return void res.status(401).json({ error: 'Llave incorrecta o acceso bloqueado temporalmente' })
  }
  await prisma.usuario.update({ where: { id: u.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } })
  await prisma.sesion.deleteMany({ where: { usuarioId: u.id, expiraEn: { lt: ahora } } })
  await revocarActual(req, 'staff') // rotación: nunca se reutiliza un id de sesión previo
  const token = await crearSesion(req, res, { usuarioId: u.id, rol: u.rol })
  res.json({ tipo: 'staff', usuario: { id: u.id, nombre: u.nombre, rol: u.rol }, csrfToken: csrfDe(token) })
}))

export default r
