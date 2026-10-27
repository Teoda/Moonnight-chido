// Paneles solares del techo: SIMULADO. Todavía no hay inversor conectado; estos datos sirven para mostrar
// cómo se verá el panel del súper administrador y la sección del reporte semanal. Cuando se conecte el
// inversor, estas dos funciones son las que se reemplazan por lecturas reales.
export type EstadoPanel = 'ok' | 'revisar' | 'reparacion'
export interface Panel { numero: number; estado: EstadoPanel; watts: number; revisado: string; nota?: string }
export interface Reparacion {
  panel: number; fecha: string; tipo: 'Reparación' | 'Mantenimiento preventivo'; detalle: string; costo: number; estado: 'En proceso' | 'Terminada'
}

export const NOMINAL_W = 550 // W por panel

export const panelesSimulados = (): Panel[] => [
  { numero: 1, estado: 'ok', watts: 468, revisado: '2026-10-02' },
  { numero: 2, estado: 'ok', watts: 472, revisado: '2026-10-02' },
  { numero: 3, estado: 'ok', watts: 455, revisado: '2026-10-02' },
  { numero: 4, estado: 'revisar', watts: 301, revisado: '2026-09-18', nota: 'Suciedad acumulada: produce 35 % menos que sus vecinos.' },
  { numero: 5, estado: 'ok', watts: 461, revisado: '2026-10-02' },
  { numero: 6, estado: 'ok', watts: 470, revisado: '2026-10-02' },
  { numero: 7, estado: 'ok', watts: 466, revisado: '2026-10-02' },
  { numero: 8, estado: 'reparacion', watts: 0, revisado: '2026-10-15', nota: 'Vidrio estrellado por granizo. Técnico agendado; refacción en camino.' },
  { numero: 9, estado: 'ok', watts: 459, revisado: '2026-10-02' },
  { numero: 10, estado: 'ok', watts: 463, revisado: '2026-10-02' },
  { numero: 11, estado: 'ok', watts: 457, revisado: '2026-10-02' },
  { numero: 12, estado: 'revisar', watts: 268, revisado: '2026-09-18', nota: 'Conector con temperatura alta en la última revisión.' },
  { numero: 13, estado: 'ok', watts: 471, revisado: '2026-10-02' },
  { numero: 14, estado: 'revisar', watts: 322, revisado: '2026-09-18', nota: 'Sombra parcial por la tarde (árbol del vecino).' },
  { numero: 15, estado: 'ok', watts: 464, revisado: '2026-10-02' },
]

/** Reparaciones y mantenimientos de la semana que empieza en `desde` (las mismas cada semana; solo las ya ocurridas antes de `hasta`). */
export function reparacionesSimuladas(desde: Date, hasta: Date): Reparacion[] {
  const dia = (d: number) => new Date(desde.getTime() + d * 86400_000 + 5 * 3600_000).toISOString() // ~11:00 del día d
  const todas: Reparacion[] = [
    { panel: 8, fecha: dia(1), tipo: 'Reparación', detalle: 'Cambio de vidrio estrellado por granizo', costo: 3850, estado: 'En proceso' },
    { panel: 4, fecha: dia(3), tipo: 'Mantenimiento preventivo', detalle: 'Limpieza profunda de la superficie', costo: 450, estado: 'Terminada' },
    { panel: 12, fecha: dia(5), tipo: 'Reparación', detalle: 'Cambio de conector MC4 sobrecalentado', costo: 680, estado: 'Terminada' },
  ]
  return todas.filter((r) => new Date(r.fecha) < hasta)
}
