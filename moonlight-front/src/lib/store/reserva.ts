// Asistente de reserva: sala y horario → música → alimentos y bebidas → confirmar y pagar.
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { api } from '../api/client.ts'
import type { Catalogo, Disponibilidad } from '../api/types.ts'
import { horarioDe, MAX_LINEAS, noLaboral } from '../utils/carta.ts'
import { hoyLocal, lineas, num } from '../utils/formato.ts'

export type Genero = number | 'lista' | null
export interface Busqueda { fecha: string; personas: number; duracionMin: number; tipoSalaId: number }

export interface EstadoReserva {
  tipoSalaId: number | null
  fecha: string
  personas: number
  duracionMin: number
  busqueda: Busqueda | null
  slots: { estado: 'inicial' | 'cargando' | 'listo' | 'error'; datos: Disponibilidad | null; error: string | null }
  slot: string | null // ISO del inicio elegido
  genero: Genero
  artistas: string[]
  canciones: string
  carrito: Record<string, number> // productoId → cantidad (pedido anticipado)
  cortesiaId: number | null // botella de cortesía (Sala Premium)
}

const inicial = (): EstadoReserva => ({
  tipoSalaId: null, fecha: hoyLocal(), personas: 4, duracionMin: 120, busqueda: null,
  slots: { estado: 'inicial', datos: null, error: null }, slot: null,
  genero: null, artistas: ['', '', ''], canciones: '', carrito: {}, cortesiaId: null,
})

type Raiz = { reserva: EstadoReserva; catalogo: { datos: Catalogo | null } }

/** Consulta los horarios libres con lo elegido en el paso 1. Rechaza con un mensaje para el cliente. */
export const buscarHorarios = createAsyncThunk<Disponibilidad, void, { state: Raiz; rejectValue: string }>(
  'reserva/buscarHorarios',
  async (_, { getState, rejectWithValue }) => {
    const { reserva: r, catalogo } = getState()
    const tipo = catalogo.datos?.tipos.find((t) => t.id === r.tipoSalaId)
    if (!tipo) return rejectWithValue('Elige el tamaño de la sala')
    if (!r.fecha || !r.personas) return rejectWithValue('Elige fecha y número de personas')
    if (r.personas > tipo.capacidadMax) return rejectWithValue(`La Sala ${tipo.nombre} es para máximo ${tipo.capacidadMax} personas`)
    if (!horarioDe(catalogo.datos?.horarios, r.fecha)) return rejectWithValue(noLaboral(catalogo.datos?.horarios))
    const qs = new URLSearchParams({ fecha: r.fecha, personas: String(r.personas), duracionMin: String(r.duracionMin), tipoSalaId: String(tipo.id) })
    return api.get<Disponibilidad>('/publico/disponibilidad?' + qs)
  },
)

const slice = createSlice({
  name: 'reserva',
  initialState: inicial(),
  reducers: {
    elegirTipo(s, a: PayloadAction<{ id: number; capacidadMax: number }>) {
      s.tipoSalaId = a.payload.id
      if (s.personas > a.payload.capacidadMax) s.personas = a.payload.capacidadMax
    },
    setFecha(s, a: PayloadAction<string>) { s.fecha = a.payload },
    setPersonas(s, a: PayloadAction<number>) { s.personas = Math.max(1, Math.min(16, Math.round(a.payload) || 1)) },
    setDuracion(s, a: PayloadAction<number>) { s.duracionMin = a.payload },
    elegirSlot(s, a: PayloadAction<string | null>) { s.slot = a.payload },
    elegirGenero(s, a: PayloadAction<Genero>) { s.genero = a.payload },
    setArtista(s, a: PayloadAction<{ i: number; valor: string }>) { s.artistas[a.payload.i] = a.payload.valor },
    agregarArtista(s) { if (s.artistas.length < 10) s.artistas.push('') },
    setCanciones(s, a: PayloadAction<string>) { s.canciones = a.payload },
    setCantidad(s, a: PayloadAction<{ id: number; cantidad: number }>) {
      const c = Math.max(0, Math.min(20, a.payload.cantidad))
      const k = String(a.payload.id)
      if (c && !(k in s.carrito) && Object.keys(s.carrito).length >= MAX_LINEAS) return
      if (c) s.carrito[k] = c
      else delete s.carrito[k]
    },
    elegirCortesia(s, a: PayloadAction<number | null>) { s.cortesiaId = a.payload },
    /** Tras crear la reservación: se limpian horario y pedido; se conservan sala, fecha y música. */
    reservado(s) { s.slot = null; s.carrito = {} },
    /** Día no laboral u otro cambio que invalida los horarios mostrados. */
    sinHorarios(s, a: PayloadAction<string | null>) {
      s.busqueda = null; s.slot = null
      s.slots = { estado: a.payload ? 'error' : 'inicial', datos: null, error: a.payload }
    },
  },
  extraReducers: (b) => {
    b.addCase(buscarHorarios.pending, (s) => {
      s.busqueda = s.tipoSalaId ? { fecha: s.fecha, personas: s.personas, duracionMin: s.duracionMin, tipoSalaId: s.tipoSalaId } : null
      s.slot = null
      s.slots = { estado: 'cargando', datos: null, error: null }
    })
    b.addCase(buscarHorarios.fulfilled, (s, a) => { s.slots = { estado: 'listo', datos: a.payload, error: null } })
    b.addCase(buscarHorarios.rejected, (s, a) => {
      if (a.payload) s.busqueda = null
      s.slots = { estado: 'error', datos: null, error: a.payload || a.error.message || 'No se pudieron consultar los horarios' }
    })
  },
})

export const acciones = slice.actions
export default slice.reducer

// ── selectores ──
/** Lo elegido de música, listo para la API, o el mensaje de lo que falta. */
export function musicaElegida(r: EstadoReserva):
  { error: string } | { error?: undefined; datos: { tematicaId?: number; artistas?: string[]; canciones?: string[] }; artistas: string[] } {
  const artistas = [...new Set(r.artistas.map((a) => a.trim()).filter(Boolean))]
  const canciones = lineas(r.canciones).slice(0, 20)
  if (!r.genero) return { error: 'Elige un género musical o "Mi propia lista"' }
  if (r.genero === 'lista' && artistas.length < 3) return { error: 'Escribe al menos 3 artistas para tu lista' }
  if (artistas.length && artistas.length < 3) return { error: 'Si escribes artistas, que sean al menos 3' }
  return {
    datos: {
      ...(r.genero !== 'lista' ? { tematicaId: r.genero } : {}),
      ...(artistas.length ? { artistas } : {}),
      ...(canciones.length ? { canciones } : {}),
    },
    artistas,
  }
}

export const itemsCarrito = (r: EstadoReserva) =>
  Object.entries(r.carrito).map(([id, cantidad]) => ({ productoId: Number(id), cantidad }))

/** Importes del resumen: sala, anticipos y lo que se paga al llegar. */
export function totales(r: EstadoReserva, cat: Catalogo | null) {
  const b = r.busqueda
  const tipo = cat?.tipos.find((t) => t.id === b?.tipoSalaId)
  const sala = tipo && b ? num(tipo.precioHora) * (b.duracionMin / 60) : 0
  const pedido = Object.entries(r.carrito).reduce((a, [id, c]) => a + num(cat?.menu.find((p) => p.id === Number(id))?.precio) * c, 0)
  const pctSala = cat?.reglas.anticipoSalaPct ?? 100, pctPedido = cat?.reglas.anticipoPedidoPct ?? 0
  const anticipoSala = Math.round(sala * pctSala) / 100
  const anticipoPedido = Math.round(pedido * pctPedido) / 100
  return { tipo, sala, pedido, anticipoSala, anticipoPedido, enLinea: anticipoSala + anticipoPedido, alLlegar: sala - anticipoSala + pedido - anticipoPedido }
}
