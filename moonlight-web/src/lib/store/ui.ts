// Avisos (toasts) que se muestran en la esquina inferior.
import { createSlice, type Dispatch, type PayloadAction } from '@reduxjs/toolkit'

export type TipoAviso = '' | 'ok' | 'bad'
export interface Aviso { id: number; msg: string; tipo: TipoAviso }

let siguiente = 1
const slice = createSlice({
  name: 'ui',
  initialState: { avisos: [] as Aviso[] },
  reducers: {
    mostrar: {
      reducer(s, a: PayloadAction<Aviso>) { s.avisos.push(a.payload); if (s.avisos.length > 5) s.avisos.shift() },
      prepare: (msg: string, tipo: TipoAviso = '') => ({ payload: { id: siguiente++, msg, tipo } }),
    },
    quitar(s, a: PayloadAction<number>) { s.avisos = s.avisos.filter((x) => x.id !== a.payload) },
  },
})

export const { quitar } = slice.actions
export default slice.reducer

/** Muestra un aviso y lo quita solo (los de error duran más). */
export const avisar = (msg: string, tipo: TipoAviso = '') => (d: Dispatch) => {
  const a = d(slice.actions.mostrar(msg, tipo))
  setTimeout(() => d(quitar(a.payload.id)), tipo === 'bad' ? 6000 : 3500)
}
