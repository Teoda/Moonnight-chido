// Catálogo público: tipos de sala, géneros, carta, horario, cortesía y reglas. Se pide una sola vez.
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { api } from '../api/client.ts'
import type { Catalogo } from '../api/types.ts'

interface Estado { datos: Catalogo | null; estado: 'inicial' | 'cargando' | 'listo' | 'error'; error: string | null }

export const cargarCatalogo = createAsyncThunk('catalogo/cargar', () => api.get<Catalogo>('/publico/catalogo'), {
  condition: (_, { getState }) => {
    const s = (getState() as { catalogo: Estado }).catalogo
    return s.estado !== 'cargando' && s.estado !== 'listo'
  },
})

const slice = createSlice({
  name: 'catalogo',
  initialState: { datos: null, estado: 'inicial', error: null } as Estado,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(cargarCatalogo.pending, (s) => { s.estado = 'cargando'; s.error = null })
    b.addCase(cargarCatalogo.fulfilled, (s, a) => { s.estado = 'listo'; s.datos = a.payload })
    b.addCase(cargarCatalogo.rejected, (s, a) => { s.estado = 'error'; s.error = a.error.message || 'No se pudo cargar el catálogo' })
  },
})

export default slice.reducer
