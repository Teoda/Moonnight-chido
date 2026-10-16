// Carta, música y horario: lógica compartida entre el sitio y el panel.
import type { Catalogo, Horario, ItemPedido, Producto, TipoSala } from '../api/types.ts'
import { lineas } from './formato.ts'

export const MAX_LINEAS = 15 // la API acepta hasta 15 productos distintos por pedido
export const ORDEN_GRUPOS = ['Paquetes', 'Botellas', 'Refrescos y aguas', 'Botanas']
export const FOTOS_TIPO: Record<string, string> = {
  PEQUENA: '/img/salas/pequena.jpg', MEDIANA: '/img/salas/mediana.jpg', PREMIUM: '/img/salas/premium.jpg',
}
/** Foto de cada subgrupo de la carta, por su sección ("Grupo · Subgrupo", tal como llega del API).
 *  Las imágenes viven en public/images/menu/. Un subgrupo sin entrada se muestra sin foto.
 *  ancho/alto: medidas reales del archivo (evitan saltos al cargar). completa: se muestra entera, sin recortar
 *  (las de botellas tienen proporciones distintas y recortarlas dejaría fuera productos). */
export interface FotoCarta { src: string; alt: string; ancho: number; alto: number; completa?: boolean; posicion?: string }
const foto = (archivo: string, alt: string, ancho: number, alto: number, extra: Partial<FotoCarta> = {}): FotoCarta =>
  ({ src: `/images/menu/${archivo}`, alt, ancho, alto, ...extra })
export const FOTOS_CARTA: Record<string, FotoCarta> = {
  'Botellas · Tequila': foto('tequila_moonlight.webp', 'Botellas de José Cuervo Tradicional, Don Julio Blanco, 1800 Reposado y Don Julio 70 con caballitos y limón', 864, 376, { completa: true }),
  'Botellas · Ron': foto('ron_moonlight.webp', 'Botellas de Bacardí Carta Blanca, Bacardí Añejo, Havana Club 7 Años y Matusalem Gran Reserva 15 con vasos', 542, 336, { completa: true }),
  'Botellas · Vodka': foto('vodka_moonlight.webp', 'Botellas de Smirnoff No. 21, Absolut, Grey Goose y Belvedere con vasos con hielo', 658, 376, { completa: true }),
  'Botellas · Whisky': foto('whisky_moonlight.webp', 'Botellas de Johnnie Walker Red Label, Jack Daniel’s Old No. 7, Johnnie Walker Black Label y Buchanan’s 12 con vasos', 459, 336, { completa: true }),
  'Botellas · Brandy': foto('brandy_moonlight.webp', 'Botellas de Presidente Solera, Torres 10 y Fundador con copas de brandy', 506, 336, { completa: true }),
  'Refrescos y aguas · Individuales': foto('bebidas_moonlight.webp', 'Vasos de refresco de cola, refresco de limón y jugo de naranja junto a una botella de agua', 627, 627),
  'Refrescos y aguas · Para compartir': foto('compartir_moonlight.webp', 'Botellas de Coca-Cola de 1.5 L y 2 L y de Sprite de 2 L en la barra', 800, 600, { posicion: 'center 30%' }),
  'Botanas · Papas y frituras': foto('frituras_moonlight.webp', 'Papas, frituras enchiladas y totopos servidos en tazones negros', 627, 627),
  'Botanas · Cacahuates': foto('cacahuates_moonlight.webp', 'Bowl de cacahuates salados, japoneses y enchilados', 627, 627),
  'Botanas · Churritos (salados)': foto('churritos_moonlight.webp', 'Churritos con chile en polvo y limón en un plato negro', 627, 627),
}
/** Foto de un producto en particular (por su nombre exacto en el catálogo). */
export const FOTOS_PRODUCTO: Record<string, FotoCarta> = {
  'Charola mixta de botanas': foto('charola_mixta_moonlight.webp', 'Tazones con papas, frituras enchiladas y cacahuates', 559, 278),
}

/** Foto de cada paquete (por su nombre exacto en el catálogo), en public/images/paquetes/.
 *  Los archivos traen su propio marco redondeado: la tarjeta y el panel los recortan un poco al mostrarlos. */
const fotoPaquete = (archivo: string, alt: string): FotoCarta => ({ src: `/images/paquetes/${archivo}`, alt, ancho: 1800, alto: 732 })
export const FOTOS_PAQUETE: Record<string, FotoCarta> = {
  'Moon Mini': fotoPaquete('moon_mini.webp', 'Sala lounge con micrófono, sillón morado y una luna de neón'),
  'Moon Mini Drinks': fotoPaquete('moon_mini_drinks.webp', 'Botella de Bacardí en una cubeta con hielo junto a dos vasos'),
  'Moon Friends': fotoPaquete('moon_friends.webp', 'Sala de karaoke con micrófono sobre la mesa y una luna de neón'),
  'Moon Friends Drinks': fotoPaquete('moon_friends_drinks.webp', 'Cubeta con hielo y botellas junto a dos vasos con hielo'),
  'Premium Snacks': fotoPaquete('premium_snacks.webp', 'Tazón de botanas y charola dibujados con luces de neón'),
  'Moon VIP Drinks': fotoPaquete('moon_vip_drinks.webp', 'Botella en una cubeta con hielo frente a un letrero VIP de neón'),
}

/** Foto y frase de cada tamaño de sala (por su código) en "Nuestras salas". Se usan imágenes propias de ambientes
 *  lounge; las fotos de la base de datos (public/img/salas) traen marca de agua y logotipo ajeno. */
export const PRESENTACION_TIPO_SALA: Record<string, { foto: FotoCarta; frase: string }> = {
  PEQUENA: { foto: fotoPaquete('moon_mini.webp', 'Sala lounge con micrófono, sillón morado y una luna de neón'), frase: 'Para parejas y grupos chicos que quieren cantar a gusto.' },
  MEDIANA: { foto: fotoPaquete('moon_friends.webp', 'Sala de karaoke con micrófono sobre la mesa y una luna de neón'), frase: 'Para reuniones con amigos, cumpleaños y salidas de la oficina.' },
  PREMIUM: { foto: fotoPaquete('moon_vip_drinks.webp', 'Sala VIP con sillones morados, cubeta con hielo y letrero de neón'), frase: 'Para celebrar en grande con todo tu grupo.' },
}

/** Categorías del Menú: qué secciones del API agrupa cada una (en ese orden) y su foto de portada.
 *  Los productos siempre salen del catálogo; aquí solo se decide cómo se agrupan y presentan.
 *  pestanas: una pestaña por sección (Botellas). Paquetes se muestra aparte, siempre visible. */
export interface CategoriaCarta { id: string; nombre: string; descripcion: string; secciones: string[]; foto?: FotoCarta; pestanas?: boolean }
export const CATEGORIAS_CARTA: CategoriaCarta[] = [
  {
    id: 'botellas', nombre: 'Botellas', descripcion: 'Tequila, vodka, brandy, ron y whisky', pestanas: true,
    secciones: ['Botellas · Tequila', 'Botellas · Vodka', 'Botellas · Brandy', 'Botellas · Ron', 'Botellas · Whisky'],
    // la foto de tequila, recortada hacia la derecha para que no se vea su rótulo "Tequila"
    foto: { ...FOTOS_CARTA['Botellas · Tequila'], completa: false, posicion: 'right center', alt: 'Botellas de tequila con caballitos y limón' },
  },
  { id: 'refrescos', nombre: 'Refrescos y aguas', descripcion: 'Refrescos, aguas minerales y jugos', secciones: ['Refrescos y aguas · Individuales'], foto: FOTOS_CARTA['Refrescos y aguas · Individuales'] },
  { id: 'papas', nombre: 'Papas y frituras', descripcion: 'Sabritas, Doritos, Takis, Ruffles y más', secciones: ['Botanas · Papas y frituras'], foto: FOTOS_CARTA['Botanas · Papas y frituras'] },
  { id: 'cacahuates', nombre: 'Cacahuates', descripcion: 'Salados, japoneses, enchilados y estilo cantinero', secciones: ['Botanas · Cacahuates'], foto: FOTOS_CARTA['Botanas · Cacahuates'] },
  { id: 'churritos', nombre: 'Churritos', descripcion: 'Naturales, con chile y limón o preparados', secciones: ['Botanas · Churritos (salados)'], foto: FOTOS_CARTA['Botanas · Churritos (salados)'] },
  {
    id: 'compartir', nombre: 'Para compartir', descripcion: 'Refrescos de 1.5 y 2 litros y charola mixta de botanas',
    secciones: ['Refrescos y aguas · Para compartir', 'Botanas · Para compartir'], foto: FOTOS_CARTA['Refrescos y aguas · Para compartir'],
  },
]

/** "Botellas · Tequila" → Map { 'Botellas' → Map { 'Tequila' → [productos] } }, en orden de la carta. */
export function agruparCarta(menu: Producto[]) {
  const out = new Map<string, Map<string, Producto[]>>()
  for (const p of menu) {
    const [grupo, sub = ''] = (p.seccion || 'Otros').split(' · ')
    if (!out.has(grupo)) out.set(grupo, new Map())
    const g = out.get(grupo)!
    if (!g.has(sub)) g.set(sub, [])
    g.get(sub)!.push(p)
  }
  return out
}
export const ordenGrupos = (grupos: Map<string, unknown>) =>
  [...ORDEN_GRUPOS.filter((g) => grupos.has(g)), ...[...grupos.keys()].filter((g) => !ORDEN_GRUPOS.includes(g))]

export const lineasPaquete = (p: Producto) => lineas(p.descripcion)
export const nombreBotella = (n: string) => n.replace(' (botella)', '')

/** Las líneas con precio $0 son la botella de cortesía de la Sala Premium. */
export const esCortesia = (i: ItemPedido) => i.precioUnitario != null && Number(i.precioUnitario) === 0
export const lineaItem = (i: ItemPedido) => `${i.cantidad}× ${i.producto.nombre}${esCortesia(i) ? ' 🍾 cortesía' : ''}`

export const tipoPara = (tipos: TipoSala[], personas: number) =>
  tipos.find((t) => t.capacidadMin <= personas && personas <= t.capacidadMax)

/** ¿Este tipo de sala incluye botella de cortesía? */
export const conCortesia = (cat: Catalogo | null, tipoId?: number | null) =>
  !!tipoId && cat?.cortesia?.tipoSalaId === tipoId && cat.cortesia.botellas.length > 0

/** Género elegido o "Mi lista" con sus artistas (para ambientar la sala). */
export function musicaTxt(r: { tematica: { nombre: string } | null; artistas: string | null }) {
  const artistas = lineas(r.artistas)
  const base = r.tematica ? r.tematica.nombre : artistas.length ? 'Mi lista' : 'Por definir'
  return artistas.length ? `${base}: ${artistas.join(', ')}` : base
}

// ── horario ──
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
/** "12:00–02:00", o "24 h" si abre y cierra a la misma hora. */
export const horaTxt = (x: Horario) => (x.abre === x.cierra ? '24 h' : `${x.abre}–${x.cierra}`)

export function resumenHorario(horarios: Horario[] | undefined) {
  if (!horarios?.length) return ''
  const dias = horarios.map((x) => x.diaSemana).sort()
  const mismos = horarios.every((x) => x.abre === horarios[0].abre && x.cierra === horarios[0].cierra)
  const consecutivos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1)
  const diasTxt = dias.length === 7 ? 'Todos los días'
    : consecutivos && dias.length > 2 ? `${DIAS[dias[0]]}–${DIAS[dias[dias.length - 1]]}` : dias.map((d) => DIAS[d]).join(', ')
  return mismos ? `${diasTxt} · ${horaTxt(horarios[0])}` : diasTxt
}
/** Horario del día (YYYY-MM-DD) o null si ese día no se abre. */
export const horarioDe = (horarios: Horario[] | undefined, fecha: string) =>
  (horarios || []).find((x) => x.diaSemana === new Date(fecha + 'T00:00:00Z').getUTCDay()) || null
export const noLaboral = (horarios: Horario[] | undefined) => `Día no laboral. Abrimos ${resumenHorario(horarios) || 'otros días'}.`
