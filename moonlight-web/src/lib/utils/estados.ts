// Etiquetas y colores de los estados que devuelve la API.
import type { MetodoPago, Rol } from '../api/types.ts'

export type Tono = '' | 'ok' | 'warn' | 'bad' | 'info' | 'accent'

export const ESTADOS: Record<string, [string, Tono]> = {
  PENDIENTE_PAGO: ['Pendiente de pago', 'warn'],
  CONFIRMADA: ['Confirmada', 'ok'],
  EN_CURSO: ['En curso', 'accent'],
  FINALIZADA: ['Finalizada', ''],
  CANCELADA: ['Cancelada', 'bad'],
  NO_SHOW: ['No-show', 'bad'],
  EN_ESPERA: ['En espera', 'warn'],
  NUEVO: ['Nuevo', 'info'],
  PREPARANDO: ['Preparando', 'warn'],
  ENTREGADO: ['Entregado', 'ok'],
  CANCELADO: ['Cancelado', 'bad'],
  ACTIVA: ['Lista', 'ok'],
  LIMPIEZA: ['Limpieza', 'warn'],
  MANTENIMIENTO: ['Mantenimiento', 'bad'],
  PENDIENTE: ['Pendiente', 'warn'],
  EN_PROCESO: ['En proceso', 'info'],
  LISTA: ['Lista', 'ok'],
  PAGADO: ['Pagado', 'ok'],
  REEMBOLSADO: ['Reembolsado', 'warn'],
  FALLIDO: ['Fallido', 'bad'],
}
export const estadoTxt = (e: string) => (ESTADOS[e] || [e])[0]

/** Estados "en movimiento": su etiqueta late. */
export const VIVOS = new Set(['EN_CURSO', 'PREPARANDO', 'NUEVO', 'PENDIENTE_PAGO'])

export const METODOS: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo', TARJETA_DEBITO: 'Tarjeta de débito', TARJETA_CREDITO: 'Tarjeta de crédito', TARJETA: 'Tarjeta',
}
export const metodoTxt = (m: MetodoPago, enLinea?: boolean) => (METODOS[m] || m) + (enLinea ? ' (en línea)' : '')
/** En el establecimiento se registra si la tarjeta es de débito o de crédito. */
export const METODOS_MOSTRADOR = ['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO'] as const

export const CONCEPTOS: Record<string, string> = {
  SALA: 'Sala', SALDO_SALA: 'Resto de la sala', ANTICIPO_PEDIDO: 'Anticipo del pedido', SALDO_PEDIDO: 'Resto del pedido',
  TIEMPO_EXTRA: 'Tiempo extra', CONSUMO: 'Cierre de cuenta', REEMBOLSO: 'Reembolso',
}

export const ROLES: Record<Rol, string> = {
  ADMIN: 'Administración', OPERACIONES: 'Operaciones', FINANZAS: 'Finanzas', RECEPCION: 'Recepción',
  BARRA: 'Barra', MARKETING: 'Marketing', LIMPIEZA: 'Limpieza',
}
