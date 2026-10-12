// "Mis reservaciones" del cliente. Se revisan cada 20 s en cualquier página: al detectar un cambio
// (check-in, pedido en camino, tiempo ampliado, cuenta cerrada...) se avisa al cliente.
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { api } from '../api/client.ts'
import type { ReservacionCliente } from '../api/types.ts'
import { estadoTxt } from '../utils/estados.ts'
import { fmtHora } from '../utils/formato.ts'
import { ding } from '../fx/sonido.ts'
import { avisar } from './ui.ts'

export interface Alerta { tipo: 'tiempoTerminado' | 'cuentaCerrada'; codigo: string }
interface Estado {
  lista: ReservacionCliente[] | null
  hora: number // cuándo se actualizó por última vez
  estado: 'inicial' | 'cargando' | 'listo' | 'error'
  error: string | null
  flash: string[] // códigos que acaban de cambiar (se resaltan)
  alerta: Alerta | null
}

/** Avisos ya mostrados (por reservación y hora de fin), para no repetirlos al recargar la página. */
const avisado = (() => {
  let set: Set<string>
  try { set = new Set(JSON.parse(sessionStorage.getItem('ml-avisos') || '[]')) } catch { set = new Set() }
  return (clave: string) => {
    if (set.has(clave)) return true
    set.add(clave)
    try { sessionStorage.setItem('ml-avisos', JSON.stringify([...set].slice(-100))) } catch { /* sin almacenamiento */ }
    return false
  }
})()

type Raiz = { mis: Estado }

export const cargarMis = createAsyncThunk<{ lista: ReservacionCliente[]; cambiadas: string[]; alerta: Alerta | null }, { silencioso?: boolean } | void, { state: Raiz }>(
  'mis/cargar',
  async (_, { getState, dispatch }) => {
    const lista = await api.get<ReservacionCliente[]>('/cliente/reservaciones')
    const previa = getState().mis.lista
    const cambiadas: string[] = []
    let alerta: Alerta | null = null
    if (previa) {
      const antes = new Map(previa.map((r) => [r.codigo, r]))
      for (const r of lista) {
        const p = antes.get(r.codigo)
        if (!p) continue
        if (p.estado !== r.estado) {
          cambiadas.push(r.codigo)
          if (r.estado === 'FINALIZADA') { if (!avisado(`${r.codigo}:cerrada`)) { ding(); alerta = { tipo: 'cuentaCerrada', codigo: r.codigo } } }
          else if (r.estado === 'EN_CURSO') dispatch(avisar(`¡Bienvenido! Tu sala ${r.sala.numero} está lista. Termina a las ${fmtHora(r.fin)} 🎤`, 'ok'))
          else dispatch(avisar(`${r.codigo}: ${estadoTxt(r.estado)}`, r.estado === 'CANCELADA' || r.estado === 'NO_SHOW' ? 'bad' : 'ok'))
        }
        if (r.estado === 'EN_CURSO' && p.fin !== r.fin && new Date(r.fin) > new Date(p.fin)) {
          cambiadas.push(r.codigo)
          dispatch(avisar(`Se amplió tu tiempo: ahora terminas a las ${fmtHora(r.fin)} ⏱️`, 'ok'))
        }
        const pedPrev = new Map(p.pedidos.map((x) => [x.id, x.estado]))
        for (const ped of r.pedidos) {
          const antesEstado = pedPrev.get(ped.id)
          if (antesEstado && antesEstado !== ped.estado) {
            cambiadas.push(r.codigo)
            const msg = { PREPARANDO: '¡Tu pedido se está preparando! 🍳', ENTREGADO: '¡Tu pedido va en camino a tu sala! 🎉', CANCELADO: 'Un pedido fue cancelado' }[ped.estado as string]
            if (msg) dispatch(avisar(msg, ped.estado === 'CANCELADO' ? 'bad' : 'ok'))
          }
        }
      }
    }
    return { lista, cambiadas, alerta }
  },
)

const slice = createSlice({
  name: 'mis',
  initialState: { lista: null, hora: 0, estado: 'inicial', error: null, flash: [], alerta: null } as Estado,
  reducers: {
    olvidar() { return { lista: null, hora: 0, estado: 'inicial', error: null, flash: [], alerta: null } as Estado },
    alertar(s, a: PayloadAction<Alerta | null>) { s.alerta = a.payload },
  },
  extraReducers: (b) => {
    b.addCase(cargarMis.pending, (s, a) => { if (!a.meta.arg?.silencioso) { s.estado = 'cargando'; s.error = null } })
    b.addCase(cargarMis.fulfilled, (s, a) => {
      s.lista = a.payload.lista; s.hora = Date.now(); s.estado = 'listo'; s.error = null
      s.flash = a.payload.cambiadas
      if (a.payload.alerta) s.alerta = a.payload.alerta
    })
    b.addCase(cargarMis.rejected, (s, a) => {
      if (a.meta.arg?.silencioso) return // en segundo plano no se interrumpe al cliente
      s.estado = 'error'; s.error = a.error.message || 'No se pudieron cargar tus reservaciones'
    })
  },
})

export const { olvidar, alertar } = slice.actions
export default slice.reducer

/** Cada segundo: avisa cuando quedan 10 y 5 min de la visita, y cuando el tiempo terminó. */
export const revisarTiempos = () => (dispatch: (a: unknown) => unknown, getState: () => Raiz) => {
  const lista = getState().mis.lista
  if (!lista) return
  for (const r of lista) {
    if (r.estado !== 'EN_CURSO') continue
    const resta = new Date(r.fin).getTime() - Date.now(), base = `${r.codigo}:${r.fin}`
    if (resta <= 0) {
      if (!avisado(`${base}:fin`)) { ding(); dispatch(alertar({ tipo: 'tiempoTerminado', codigo: r.codigo })) }
    } else if (resta <= 5 * 60_000) {
      if (!avisado(`${base}:5`)) { ding(); dispatch(avisar(`⏰ Te quedan ${Math.ceil(resta / 60_000)} min en la sala ${r.sala.numero}`, 'bad')) }
    } else if (resta <= 10 * 60_000) {
      if (!avisado(`${base}:10`)) dispatch(avisar(`⏰ Te quedan ${Math.ceil(resta / 60_000)} min en la sala ${r.sala.numero}. Si quieres más tiempo, pídelo en recepción.`, 'ok'))
    }
  }
}
