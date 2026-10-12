// Validación de tarjetas (el pago es simulado: se valida como una pasarela, pero no se cobra).
import type { TarjetaGuardada } from '../api/types.ts'

export const soloDigitos = (v: string) => v.replace(/\D/g, '')
export const marcaTarjeta = (n: string) =>
  /^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'American Express' : ''
export const luhn = (n: string) =>
  [...n].reverse().reduce((a, c, i) => { let d = Number(c); if (i % 2) { d *= 2; if (d > 9) d -= 9 } return a + d }, 0) % 10 === 0
export const tarjetaTxt = (t: TarjetaGuardada) =>
  `${t.marca} •••• ${t.ultimos4} · vence ${String(t.mesExp).padStart(2, '0')}/${String(t.anioExp).slice(-2)}`

const MAX_ANIOS = 20 // vencimientos más lejanos no existen en tarjetas reales
export interface CamposTarjeta { titular: string; numero: string; vence: string; cvv: string }
export type ErroresTarjeta = Partial<Record<keyof CamposTarjeta, string>>

export const VALIDAR: Record<keyof CamposTarjeta, (c: CamposTarjeta) => string> = {
  titular: (c) => (c.titular.trim().length < 3 ? 'Escribe el nombre como aparece en la tarjeta' : ''),
  numero: (c) => {
    const n = soloDigitos(c.numero)
    if (!n) return 'Escribe el número de la tarjeta'
    if (!marcaTarjeta(n)) return 'Solo aceptamos Visa, Mastercard y American Express'
    if (n.length !== (marcaTarjeta(n) === 'American Express' ? 15 : 16)) return 'El número está incompleto'
    if (!luhn(n)) return 'El número de tarjeta no es válido; revísalo'
    return ''
  },
  vence: (c) => {
    const m = /^(\d{2})\/(\d{2})$/.exec(c.vence)
    if (!m) return 'Escribe el vencimiento como MM/AA'
    const mm = Number(m[1]), anio = 2000 + Number(m[2]), hoy = new Date()
    if (mm < 1 || mm > 12) return 'El mes debe ser de 01 a 12'
    if (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mm < hoy.getMonth() + 1)) return 'La tarjeta está vencida'
    if (anio > hoy.getFullYear() + MAX_ANIOS) return 'Fecha de vencimiento no válida'
    return ''
  },
  cvv: (c) => {
    const largo = marcaTarjeta(soloDigitos(c.numero)) === 'American Express' ? 4 : 3
    return c.cvv.length !== largo ? `El CVV son ${largo} dígitos (al reverso${largo === 4 ? ', o al frente en American Express' : ''})` : ''
  },
}

/** Datos para la API: { tarjeta: {...}, guardar }. */
export function cuerpoTarjeta(c: CamposTarjeta, guardar: boolean) {
  const [mm, aa] = c.vence.split('/').map(Number)
  return { tarjeta: { numero: soloDigitos(c.numero), titular: c.titular.trim(), mes: mm, anio: 2000 + aa, cvv: c.cvv }, guardar }
}
