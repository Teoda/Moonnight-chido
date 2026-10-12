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

/**
 * Store de Svelte con el resultado del selector; solo avisa a los componentes cuando el valor cambia.
 * La comparación es por referencia (===): Redux conserva la misma referencia si esa parte del estado no cambió.
 * Sin esta comparación Svelte trata cualquier objeto como "cambiado" en cada acción de Redux, y un $effect que
 * lea el valor y despache una acción se repetiría sin fin (error effect_update_depth_exceeded).
 */
export function seleccionar<T>(selector: (s: RootState) => T): Readable<T> {
  return readable(selector(store.getState()), (set) => {
    let actual = selector(store.getState())
    set(actual)
    return store.subscribe(() => {
      const nuevo = selector(store.getState())
      if (nuevo === actual) return
      actual = nuevo
      set(nuevo)
    })
  })
}
