// Sesión del personal. El acceso es con nombre + llave (POST /api/acceso/personal/login).
// El personal no cambia su propia llave: la genera Administración (POST /api/staff/personal/:id/llave).
import { Router } from 'express'
import { prisma } from '../db'
import { ah } from '../util'
import { cerrarSesion, csrfDe } from '../security/session'
import { requireStaff, csrf } from '../middleware/auth'

const r = Router()
const publico = (u: { id: number; nombre: string; rol: string }) => ({ id: u.id, nombre: u.nombre, rol: u.rol })

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

export default r
