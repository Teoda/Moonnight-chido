// Pestañas del panel y permisos: cada una se muestra solo a los roles que la API permite (ADMIN ve todo).
// El súper administrador no ve la operación diaria: solo las pestañas con `superadmin` en 'si' o 'solo',
// además de la gestión del personal y los turnos, que es solo suya.
import type { Rol } from '../../api/types.ts'

export const PESTANAS = [
  { ruta: 'recepcion', titulo: 'Recepción', roles: ['RECEPCION', 'OPERACIONES'], superadmin: 'no' },
  { ruta: 'agenda', titulo: 'Agenda', roles: ['RECEPCION', 'OPERACIONES', 'FINANZAS'], superadmin: 'si' }, // él solo mira
  { ruta: 'barra', titulo: 'Barra', roles: ['BARRA', 'RECEPCION'], superadmin: 'no' },
  { ruta: 'salas', titulo: 'Salas', roles: ['OPERACIONES', 'RECEPCION', 'LIMPIEZA'], superadmin: 'si' }, // él solo mira
  { ruta: 'limpieza', titulo: 'Limpieza', roles: ['LIMPIEZA', 'OPERACIONES'], superadmin: 'no' },
  { ruta: 'finanzas', titulo: 'Finanzas', roles: ['FINANZAS'], superadmin: 'si' },
  { ruta: 'reportes', titulo: 'Reportes', roles: [], superadmin: 'si' }, // solo Administración
  { ruta: 'horario', titulo: 'Horario', roles: ['OPERACIONES', 'FINANZAS', 'RECEPCION', 'BARRA', 'MARKETING', 'LIMPIEZA'], superadmin: 'si' }, // todos lo ven; solo él lo edita
  { ruta: 'paneles', titulo: 'Paneles solares', roles: [], superadmin: 'solo' },
] as const satisfies readonly { ruta: string; titulo: string; roles: readonly Rol[]; superadmin: 'si' | 'no' | 'solo' }[]

export const puede = (rol: Rol | undefined, ...roles: readonly Rol[]) => !!rol && (rol === 'SUPERADMIN' || rol === 'ADMIN' || roles.includes(rol))
export const esSuper = (rol: Rol | undefined) => rol === 'SUPERADMIN'
export const pestanasDe = (rol: Rol | undefined) =>
  esSuper(rol) ? PESTANAS.filter((p) => p.superadmin !== 'no') : PESTANAS.filter((p) => p.superadmin !== 'solo' && puede(rol, ...p.roles))

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
