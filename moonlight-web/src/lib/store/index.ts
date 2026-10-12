// Store de Redux (Redux Toolkit) y el puente con Svelte: `seleccionar()` convierte una parte del estado
// en un store de Svelte, así los componentes se actualizan solos con `$valor`.
// La app se renderiza solo en el navegador (ssr = false), por lo que hay un store por usuario y nunca se
// comparte entre peticiones en el servidor.
import { configureStore } from '@reduxjs/toolkit'
import { readable, type Readable } from 'svelte/store'
import catalogo from './catalogo.ts'
import sesion from './sesion.ts'
import reserva from './reserva.ts'
import mis from './mis.ts'
import ui from './ui.ts'

export const store = configureStore({
  reducer: { catalogo, sesion, reserva, mis, ui },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const dispatch: AppDispatch = store.dispatch

/** Store de Svelte con el resultado del selector; solo avisa a los componentes cuando el valor cambia. */
export function seleccionar<T>(selector: (s: RootState) => T): Readable<T> {
  return readable(selector(store.getState()), (set) => store.subscribe(() => set(selector(store.getState()))))
}
