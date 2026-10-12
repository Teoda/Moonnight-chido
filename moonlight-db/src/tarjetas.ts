// Pago con tarjeta SIMULADO. Se valida la tarjeta como lo haría una pasarela, pero no se cobra nada.
// Nunca se guarda ni se registra el número completo ni el CVV: de una tarjeta guardada solo quedan
// marca, últimos 4 dígitos, vencimiento, titular y un token. Con una pasarela real (Stripe, Mercado Pago,
// Openpay...) el número lo captura su formulario en el navegador y aquí solo llega su token.
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { Prisma, PrismaClient } from '@prisma/client'
import { HttpError } from './util'
import { partes } from './tiempo'

type Db = PrismaClient | Prisma.TransactionClient
const MAX_GUARDADAS = 5

const luhn = (n: string) => {
  let suma = 0
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i])
    if (i % 2) { d *= 2; if (d > 9) d -= 9 }
    suma += d
  }
  return suma % 10 === 0
}
export const marcaDe = (n: string) =>
  /^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'American Express' : null

export const pagoZ = z.object({
  tarjetaId: z.number().int().positive().optional(), // tarjeta guardada
  tarjeta: z.object({
    numero: z.string().transform((s) => s.replace(/[\s-]/g, '')).refine((s) => /^\d{15,16}$/.test(s) && luhn(s), 'Número de tarjeta inválido'),
    titular: z.string().trim().min(3, 'Escribe el nombre como aparece en la tarjeta').max(120),
    mes: z.number().int().min(1).max(12),
    anio: z.number().int().min(2000).max(2100),
    cvv: z.string().regex(/^\d{3,4}$/, 'CVV inválido'),
  }).optional(),
  guardar: z.boolean().optional(),
}).refine((b) => !!b.tarjetaId !== !!b.tarjeta, 'Elige una tarjeta guardada o escribe una nueva')

const MAX_ANIOS = 20 // ninguna tarjeta real vence más lejos
const vencida = (mes: number, anio: number) => {
  const hoy = partes(new Date())
  return anio < hoy.anio || (anio === hoy.anio && mes < hoy.mes + 1)
}
const demasiadoLejos = (anio: number) => anio > partes(new Date()).anio + MAX_ANIOS

/** Valida la tarjeta (nueva o guardada) y, si el cliente lo pidió, la guarda. Devuelve cómo mostrarla en el pago. */
export async function tarjetaParaPago(db: Db, clienteId: number, b: z.infer<typeof pagoZ>) {
  if (b.tarjetaId) {
    const t = await db.tarjetaGuardada.findFirst({ where: { id: b.tarjetaId, clienteId } })
    if (!t) throw new HttpError(404, 'Tarjeta no encontrada')
    if (vencida(t.mesExp, t.anioExp)) throw new HttpError(400, 'Esa tarjeta ya venció')
    return { marca: t.marca, ultimos4: t.ultimos4 }
  }
  const t = b.tarjeta!
  const marca = marcaDe(t.numero)
  if (!marca) throw new HttpError(400, 'Solo aceptamos Visa, Mastercard y American Express')
  if (t.numero.length !== (marca === 'American Express' ? 15 : 16)) throw new HttpError(400, 'Número de tarjeta inválido')
  if (t.cvv.length !== (marca === 'American Express' ? 4 : 3)) throw new HttpError(400, 'CVV inválido')
  if (vencida(t.mes, t.anio)) throw new HttpError(400, 'La tarjeta está vencida')
  if (demasiadoLejos(t.anio)) throw new HttpError(400, 'Fecha de vencimiento no válida')
  const ultimos4 = t.numero.slice(-4)
  if (b.guardar) {
    const igual = await db.tarjetaGuardada.findFirst({ where: { clienteId, marca, ultimos4, mesExp: t.mes, anioExp: t.anio } })
    if (!igual) {
      if ((await db.tarjetaGuardada.count({ where: { clienteId } })) >= MAX_GUARDADAS)
        throw new HttpError(400, `Puedes guardar hasta ${MAX_GUARDADAS} tarjetas: elimina una o paga sin guardar`)
      await db.tarjetaGuardada.create({
        data: { clienteId, marca, ultimos4, mesExp: t.mes, anioExp: t.anio, titular: t.titular, token: 'tok_sim_' + randomBytes(16).toString('hex') },
      })
    }
  }
  return { marca, ultimos4 }
}
