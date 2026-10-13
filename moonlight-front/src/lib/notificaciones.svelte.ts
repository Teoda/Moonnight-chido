// Notificaciones de la campanita. Se arman con los datos que ya trae el sitio (reservaciones del
// cliente y catálogo); su id incluye el estado, así que un cambio (p. ej. CONFIRMADA → EN_CURSO)
// vuelve a aparecer como no leído. Los ids leídos se guardan en localStorage.
import type { Catalogo, ReservacionCliente } from './api/types.ts'
import { estadoTxt } from './utils/estados.ts'
import { fmtFechaHora, fmtHora } from './utils/formato.ts'

export interface Notificacion { id: string; titulo: string; texto: string; href: string; icono: string; tono: 'ok' | 'warn' | 'bad' | 'accent' }

const CLAVE = 'ml-leidas'
const leidas = $state({ ids: cargar() })

function cargar(): string[] {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') } catch { return [] }
}

export const esLeida = (id: string) => leidas.ids.includes(id)

export function marcarLeidas(ids: string[]) {
  leidas.ids = [...new Set([...leidas.ids, ...ids])].slice(-200)
  try { localStorage.setItem(CLAVE, JSON.stringify(leidas.ids)) } catch { /* sin almacenamiento */ }
}

const TONOS: Record<string, Notificacion['tono']> = {
  PENDIENTE_PAGO: 'warn', CONFIRMADA: 'ok', EN_CURSO: 'accent', CANCELADA: 'bad', NO_SHOW: 'bad',
}
const ICONOS: Record<string, string> = {
  PENDIENTE_PAGO: '💳', CONFIRMADA: '✅', EN_CURSO: '🎤', CANCELADA: '✖️', NO_SHOW: '⚠️', FINALIZADA: '🧾',
}

/** Últimas notificaciones: primero las de las reservaciones del cliente, luego las del lugar. */
export function armar(lista: ReservacionCliente[] | null, cat: Catalogo | null): Notificacion[] {
  const n: Notificacion[] = []
  for (const r of [...(lista ?? [])].sort((a, b) => +new Date(b.inicio) - +new Date(a.inicio)).slice(0, 5)) {
    const texto = r.estado === 'EN_CURSO'
      ? `Sala ${r.sala.numero} · termina a las ${fmtHora(r.fin)}`
      : `Sala ${r.sala.tipoSala.nombre} · ${fmtFechaHora(r.inicio)}`
    n.push({
      id: `${r.codigo}:${r.estado}`, titulo: `${r.codigo} · ${estadoTxt(r.estado)}`, texto,
      href: '/mis-reservaciones', icono: ICONOS[r.estado] ?? '📅', tono: TONOS[r.estado] ?? 'accent',
    })
    for (const p of r.pedidos.filter((p) => p.estado === 'PREPARANDO' || p.estado === 'ENTREGADO')) {
      n.push({
        id: `${r.codigo}:pedido:${p.id}:${p.estado}`, href: '/mis-reservaciones', tono: 'ok', icono: p.estado === 'ENTREGADO' ? '🍹' : '🍳',
        titulo: p.estado === 'ENTREGADO' ? 'Tu pedido va en camino' : 'Tu pedido se está preparando', texto: `Sala ${r.sala.numero}`,
      })
    }
  }
  if (cat?.tematicas.length) {
    n.push({
      id: `tematicas:${cat.tematicas.map((t) => t.id).join(',')}`, icono: '🎶', tono: 'accent', href: '/reservar',
      titulo: 'Ambienta tu sala', texto: `${cat.tematicas.slice(0, 4).map((t) => t.nombre).join(', ')} y más.`,
    })
  }
  if (cat) {
    n.push({
      id: `anticipo:${cat.reglas.anticipoSalaPct}`, icono: '🌙', tono: 'warn', href: '/reservar',
      titulo: 'Reserva en línea', texto: `Aparta tu sala pagando solo el ${cat.reglas.anticipoSalaPct}% de anticipo.`,
    })
  }
  return n.slice(0, 8)
}
