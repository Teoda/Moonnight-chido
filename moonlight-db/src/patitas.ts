// "Moonlight por las patitas": SIMULADO. El vidrio de las botellas se separa, se vende al reciclador y parte de lo
// obtenido se dona a organizaciones locales que alimentan, rescatan y cuidan perros en situación de calle.
// Todavía no se registra en el sistema; estos datos sirven para mostrar la pestaña del súper administrador y la
// sección del reporte semanal. Cuando se registre de verdad, esta función es la que se reemplaza.
export interface EntregaVidrio { fecha: string; kilos: number; obtenido: number }
export interface Donacion { fecha: string; organizacion: string; monto: number; destino: string }
export interface SemanaPatitas { entregas: EntregaVidrio[]; donaciones: Donacion[]; kilos: number; obtenido: number; donado: number }

export const PRECIO_KG = 1.8 // $ por kg de vidrio que paga el reciclador
export const PORCENTAJE_DONADO = 0.6 // parte de lo obtenido que se dona

/** Movimientos de la semana que empieza en `desde` (los mismos cada semana; solo los ya ocurridos antes de `hasta`). */
export function patitasSimuladas(desde: Date, hasta: Date): SemanaPatitas {
  const dia = (d: number) => new Date(desde.getTime() + d * 86400_000 + 6 * 3600_000).toISOString() // ~12:00 del día d
  const entregas = [{ d: 2, kilos: 84 }, { d: 5, kilos: 112 }]
    .map((e) => ({ fecha: dia(e.d), kilos: e.kilos, obtenido: Math.round(e.kilos * PRECIO_KG * 100) / 100 }))
    .filter((e) => new Date(e.fecha) < hasta)
  const obtenido = entregas.reduce((a, e) => a + e.obtenido, 0)
  const donaciones = obtenido
    ? [{ fecha: dia(6), organizacion: 'Huellitas Puebla A.C.', monto: Math.round(obtenido * PORCENTAJE_DONADO), destino: 'Croquetas y vacunas' }]
        .filter((x) => new Date(x.fecha) < hasta)
    : []
  return { entregas, donaciones, kilos: entregas.reduce((a, e) => a + e.kilos, 0), obtenido, donado: donaciones.reduce((a, x) => a + x.monto, 0) }
}

/** Acumulado de las últimas `semanas` semanas (para el resumen de la pestaña). */
export function historialPatitas(ultimoCorte: Date, semanas = 8) {
  return Array.from({ length: semanas }, (_, i) => {
    const desde = new Date(ultimoCorte.getTime() - (semanas - 1 - i) * 7 * 86400_000)
    const s = patitasSimuladas(desde, new Date(desde.getTime() + 7 * 86400_000))
    const ajuste = 0.8 + ((i * 37) % 9) / 20 // semanas distintas entre sí
    return { desde: desde.toISOString(), kilos: Math.round(s.kilos * ajuste), donado: Math.round(s.donado * ajuste) }
  })
}
