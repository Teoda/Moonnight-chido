// Carta, música y horario: lógica compartida entre el sitio y el panel.
import type { Catalogo, Horario, ItemPedido, Producto, TipoSala } from '../api/types.ts'
import { lineas } from './formato.ts'

export const MAX_LINEAS = 15 // la API acepta hasta 15 productos distintos por pedido
export const ORDEN_GRUPOS = ['Paquetes', 'Botellas', 'Refrescos y aguas', 'Botanas']
export const FOTOS_TIPO: Record<string, string> = {
  PEQUENA: '/img/salas/pequena.jpg', MEDIANA: '/img/salas/mediana.jpg', PREMIUM: '/img/salas/premium.jpg',
}

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
