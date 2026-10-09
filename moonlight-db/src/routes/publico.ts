// Explorar sin iniciar sesión: salas, catálogo y horarios disponibles. Solo lectura.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { ah } from '../util'
import { getConfig, horariosDisponibles, botellasCortesia } from '../disponibilidad'

const r = Router()

r.get('/catalogo', ah(async (_req, res) => {
  const [tipos, tematicas, menu, horarios, cfg] = await Promise.all([
    prisma.tipoSala.findMany(), prisma.tematica.findMany(), prisma.productoMenu.findMany({ where: { activo: true }, orderBy: { orden: 'asc' } }),
    prisma.horarioOperacion.findMany({ where: { activo: true }, orderBy: { diaSemana: 'asc' } }), getConfig(prisma),
  ])
  // Botella de cortesía: qué tipo de sala la incluye y entre qué botellas se elige
  const tipoCortesia = tipos.find((t) => t.codigo === cfg.cortesiaTipo)
  const cortesia = tipoCortesia ? { tipoSalaId: tipoCortesia.id, botellas: await botellasCortesia(prisma, cfg.cortesiaTopePrecio) } : null
  res.json({ tipos, tematicas, menu, horarios, cortesia, reglas: { limpiezaMin: cfg.limpiezaMin, pasoMin: cfg.pasoMin, anticipoPedidoPct: cfg.anticipoPedidoPct, horasCancelacion: cfg.horasCancelacion, toleranciaMin: cfg.toleranciaMin } })
}))

r.get('/salas', ah(async (_req, res) => {
  const salas = await prisma.sala.findMany({ orderBy: { numero: 'asc' }, include: { tipoSala: true, tematica: true } })
  res.json(salas.map((s) => ({
    numero: s.numero, descripcion: s.descripcion, fotoUrl: s.fotoUrl ?? s.tematica.fotoUrl,
    tipo: s.tipoSala.nombre, capacidad: `${s.tipoSala.capacidadMin}-${s.tipoSala.capacidadMax}`, precioHora: s.tipoSala.precioHora,
    tematica: s.tematica.nombre, disponibleParaReservar: s.estado !== 'MANTENIMIENTO',
  })))
}))

r.get('/disponibilidad', ah(async (req, res) => {
  const q = z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), personas: z.coerce.number().int().min(1).max(16),
    tematicaId: z.coerce.number().int().optional(), duracionMin: z.coerce.number().int().min(60).max(240).default(120),
  }).parse(req.query)
  res.json(await horariosDisponibles(prisma, q))
}))

export default r
