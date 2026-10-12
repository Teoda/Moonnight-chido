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

  // Géneros musicales: el cliente elige uno al reservar y la sala se ambienta con él.
  // Los que ya no estén en la lista se desactivan (no se borran: hay reservaciones que los usan).
  const generos = [
    'Regional mexicano / Corridos tumbados', 'Reguetón / Urbano latino', 'Pop latino e internacional',
    'Banda / Grupero', 'Rock en español e inglés', 'Retro / Clásicos', 'K-Pop', 'Cumbia / Tropical', 'Electrónica / Dance',
  ]
  for (const [orden, nombre] of generos.entries())
    await prisma.tematica.upsert({ where: { nombre }, update: { orden, activo: true }, create: { nombre, orden } })
  await prisma.tematica.updateMany({ where: { nombre: { notIn: generos } }, data: { activo: false } })

  // 15 salas según el plano: 1-5 pequeñas, 6-9 medianas, 10-15 premium. Sin temática fija.
  const plano: [number, string][] = [
    [1, 'PEQUENA'], [2, 'PEQUENA'], [3, 'PEQUENA'], [4, 'PEQUENA'], [5, 'PEQUENA'],
    [6, 'MEDIANA'], [7, 'MEDIANA'], [8, 'MEDIANA'], [9, 'MEDIANA'],
    [10, 'PREMIUM'], [11, 'PREMIUM'], [12, 'PREMIUM'], [13, 'PREMIUM'], [14, 'PREMIUM'], [15, 'PREMIUM'],
  ]
  for (const [numero, tipo] of plano) {
    const tipoSala = await prisma.tipoSala.findUniqueOrThrow({ where: { codigo: tipo } })
    await prisma.sala.upsert({ where: { numero }, update: {}, create: { numero, tipoSalaId: tipoSala.id } })
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

  // Horario: lunes (1) a sábado (6), de 12:00 a 02:00 (cierra de madrugada del día siguiente). Domingo cerrado.
  // El seed deja la tabla igual a esta lista: actualiza los días abiertos y desactiva los demás.
  // Para pruebas: HORARIO_24H=true en .env abre los 7 días las 24 h. Quítalo y vuelve a correr el seed para el horario real.
  const HORARIO = process.env.HORARIO_24H === 'true'
    ? { dias: [0, 1, 2, 3, 4, 5, 6], abre: '00:00', cierra: '00:00' }
    : { dias: [1, 2, 3, 4, 5, 6], abre: '12:00', cierra: '02:00' }
  for (const diaSemana of HORARIO.dias) {
    const data = { abre: HORARIO.abre, cierra: HORARIO.cierra, activo: true }
    await prisma.horarioOperacion.upsert({ where: { diaSemana }, update: data, create: { diaSemana, ...data } })
  }
  await prisma.horarioOperacion.updateMany({ where: { diaSemana: { notIn: HORARIO.dias } }, data: { activo: false } })

  const config: Record<string, string> = {
    limpiezaMin: '15',                    // bloqueo de la sala al terminar cada reservación
    pasoMin: '30',                        // los horarios de inicio van de 30 en 30 min
    duracionMinMin: '60', duracionMaxMin: '240',
    anticipoSalaPct: '50',                // % de la sala que se paga en línea (el resto en recepción al llegar)
    anticipoPedidoPct: '30',              // % del pedido anticipado que se paga en línea
    horasCancelacionConReembolso: '24',
    retencionTardiaPct: '30',             // % retenido si se cancela con menos de 24 h (por definir)
    toleranciaLlegadaMin: '10',           // pasados estos min sin llegar = no-show
    ingresoAnticipadoMin: '15',           // check-in permitido hasta estos min antes (si la sala ya está libre)
    minutosVencimientoPendientePago: '30',
    cortesiaTipoSala: 'PREMIUM',           // tipo de sala que incluye botella de cortesía
    cortesiaTopePrecio: '550',            // el cliente elige entre las botellas de hasta este precio
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
