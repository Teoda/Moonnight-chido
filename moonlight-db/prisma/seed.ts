import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { CARTA } from './carta'

const prisma = new PrismaClient()

async function main() {
  // Tipos de sala (precios de ejemplo: ajústalos en la tabla tipos_sala)
  const tipos = [
    { codigo: 'PEQUENA', nombre: 'Pequeña', capacidadMin: 1, capacidadMax: 4, precioHora: 250 },
    { codigo: 'MEDIANA', nombre: 'Mediana', capacidadMin: 5, capacidadMax: 8, precioHora: 450 },
    { codigo: 'PREMIUM', nombre: 'Premium', capacidadMin: 9, capacidadMax: 16, precioHora: 800 },
  ]
  for (const t of tipos)
    await prisma.tipoSala.upsert({ where: { codigo: t.codigo }, update: t, create: t })

  const temas = ['Pop', 'Rock', 'Retro', 'K-Pop', 'Premium Lounge']
  for (const nombre of temas)
    await prisma.tematica.upsert({ where: { nombre }, update: {}, create: { nombre } })

  // 15 salas según el plano: 1-5 pequeñas, 6-9 medianas, 10-15 premium.
  // La temática de cada sala es una propuesta; cámbiala según la decoración real.
  const plano: [number, string, string][] = [
    [1, 'PEQUENA', 'Pop'], [2, 'PEQUENA', 'Rock'], [3, 'PEQUENA', 'Retro'], [4, 'PEQUENA', 'K-Pop'], [5, 'PEQUENA', 'Pop'],
    [6, 'MEDIANA', 'Pop'], [7, 'MEDIANA', 'Rock'], [8, 'MEDIANA', 'Retro'], [9, 'MEDIANA', 'K-Pop'],
    [10, 'PREMIUM', 'Pop'], [11, 'PREMIUM', 'Rock'], [12, 'PREMIUM', 'Retro'], [13, 'PREMIUM', 'K-Pop'],
    [14, 'PREMIUM', 'Premium Lounge'], [15, 'PREMIUM', 'Premium Lounge'],
  ]
  for (const [numero, tipo, tema] of plano) {
    const tipoSala = await prisma.tipoSala.findUniqueOrThrow({ where: { codigo: tipo } })
    const tematica = await prisma.tematica.findUniqueOrThrow({ where: { nombre: tema } })
    await prisma.sala.upsert({
      where: { numero }, update: {},
      create: { numero, tipoSalaId: tipoSala.id, tematicaId: tematica.id },
    })
  }

  // Fotos por tipo de sala (solo si la sala aún no tiene una propia)
  const fotos: Record<string, string> = { PEQUENA: '/img/salas/pequena.jpg', MEDIANA: '/img/salas/mediana.jpg', PREMIUM: '/img/salas/premium.jpg' }
  for (const [codigo, fotoUrl] of Object.entries(fotos))
    await prisma.sala.updateMany({ where: { tipoSala: { codigo }, fotoUrl: null }, data: { fotoUrl } })

  // Carta (prisma/carta.ts): se actualiza por nombre; lo que ya no está en la carta se desactiva
  const tiposPorCodigo = Object.fromEntries((await prisma.tipoSala.findMany()).map((t) => [t.codigo, t.id]))
  for (const [orden, p] of CARTA.entries()) {
    const data = {
      categoria: p.categoria, seccion: p.seccion, precio: p.precio, alcohol: p.alcohol ?? false,
      descripcion: p.descripcion ?? null, tipoSalaId: p.tipoSala ? tiposPorCodigo[p.tipoSala] : null, orden, activo: true,
    }
    await prisma.productoMenu.upsert({ where: { nombre: p.nombre }, update: data, create: { nombre: p.nombre, ...data } })
  }
  await prisma.productoMenu.updateMany({ where: { nombre: { notIn: CARTA.map((p) => p.nombre) } }, data: { activo: false } })

  // Promociones del plan de negocio
  if ((await prisma.promocion.count()) === 0) {
    await prisma.promocion.createMany({
      data: [
        { nombre: '50% en alimentos en la 4ª visita del mes', tipo: 'DESCUENTO_ALIMENTOS', porcentaje: 50, visitasRequeridas: 4 },
        // Happy Hour: horario y descuento por definir; queda inactiva hasta configurarla
        { nombre: 'Happy Hour', tipo: 'HAPPY_HOUR', porcentaje: 0, horaInicio: '17:00', horaFin: '19:00', activa: false },
      ],
    })
  }

  // Horario: martes (2) a sábado (6), de 17:00 a 01:00 (cierra de madrugada del día siguiente).
  // OJO: el sábado se recibió como "5:00 pm a 1:00 pm"; se asumió 1:00 am. Corrígelo aquí si no es así.
  for (const diaSemana of [2, 3, 4, 5, 6])
    await prisma.horarioOperacion.upsert({ where: { diaSemana }, update: {}, create: { diaSemana, abre: '17:00', cierra: '01:00' } })

  const config: Record<string, string> = {
    limpiezaMin: '15',                    // bloqueo de la sala al terminar cada reservación
    pasoMin: '30',                        // los horarios de inicio van de 30 en 30 min
    duracionMinMin: '60', duracionMaxMin: '240',
    anticipoPedidoPct: '30',              // % del pedido anticipado que se paga en línea
    horasCancelacionConReembolso: '24',
    retencionTardiaPct: '30',             // % retenido si se cancela con menos de 24 h (por definir)
    toleranciaLlegadaMin: '10',           // pasados estos min sin llegar = no-show
    minutosVencimientoPendientePago: '30',
  }
  for (const [clave, valor] of Object.entries(config))
    await prisma.configuracion.upsert({ where: { clave }, update: {}, create: { clave, valor } })

  // Usuarios de prueba (cambia las contraseñas antes de producción)
  if (process.env.NODE_ENV === 'production' && (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD === 'Moonlight2026!'))
    throw new Error('En producción define un SEED_PASSWORD propio (no el de ejemplo).')
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'Moonlight2026!', 10)
  const usuarios = [
    { nombre: 'Administración', email: 'admin@moonlight.mx', rol: 'ADMIN' },
    { nombre: 'Recepción', email: 'recepcion@moonlight.mx', rol: 'RECEPCION' },
    { nombre: 'Barra', email: 'barra@moonlight.mx', rol: 'BARRA' },
    { nombre: 'Operaciones', email: 'operaciones@moonlight.mx', rol: 'OPERACIONES' },
    { nombre: 'Limpieza', email: 'limpieza@moonlight.mx', rol: 'LIMPIEZA' },
  ] as const
  for (const u of usuarios)
    await prisma.usuario.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash } })

  console.log(`Seed listo: tipos, temáticas, 15 salas con foto, carta (${CARTA.length} productos), promociones, horario, configuración y usuarios.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
