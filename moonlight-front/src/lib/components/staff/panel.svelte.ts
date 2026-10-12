// Pestañas del panel y permisos: cada una se muestra solo a los roles que la API permite (ADMIN ve todo).
import type { Rol } from '../../api/types.ts'

export const PESTANAS = [
  { ruta: 'recepcion', titulo: 'Recepción', roles: ['RECEPCION', 'OPERACIONES'] },
  { ruta: 'agenda', titulo: 'Agenda', roles: ['RECEPCION', 'OPERACIONES', 'FINANZAS'] },
  { ruta: 'barra', titulo: 'Barra', roles: ['BARRA', 'RECEPCION'] },
  { ruta: 'salas', titulo: 'Salas', roles: ['OPERACIONES', 'RECEPCION', 'LIMPIEZA'] },
  { ruta: 'limpieza', titulo: 'Limpieza', roles: ['LIMPIEZA', 'OPERACIONES'] },
  { ruta: 'finanzas', titulo: 'Finanzas', roles: ['FINANZAS'] },
] as const satisfies readonly { ruta: string; titulo: string; roles: readonly Rol[] }[]

export const puede = (rol: Rol | undefined, ...roles: readonly Rol[]) => !!rol && (rol === 'ADMIN' || roles.includes(rol))
export const pestanasDe = (rol: Rol | undefined) => PESTANAS.filter((p) => puede(rol, ...p.roles))

/** Preferencias del panel en este dispositivo. */
export const panel = $state({
  sonido: (() => { try { return localStorage.getItem('ml-sonido') !== 'no' } catch { return true } })(),
})
export function alternarSonido() {
  panel.sonido = !panel.sonido
  try { localStorage.setItem('ml-sonido', panel.sonido ? 'si' : 'no') } catch { /* sin almacenamiento */ }
}

/** Refresco periódico (cada 15 s) mientras la pestaña del navegador esté visible. */
export function cadaQuince(fn: () => void) {
  const id = setInterval(() => { if (!document.hidden) fn() }, 15_000)
  return () => clearInterval(id)
}

/** Reservación que recepción quiere abrir (al hacer clic en la agenda o en "por cobrar"). */
export const recepcion = $state({ codigo: '' })
