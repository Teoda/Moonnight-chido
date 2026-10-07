import { Prisma, type PrismaClient } from '@prisma/client'
import { HttpError } from './util'

/** Arma las líneas de un pedido con los PRECIOS de la base de datos (nunca los del navegador). */
export async function armarItems(db: PrismaClient | Prisma.TransactionClient, items: { productoId: number; cantidad: number }[]) {
  const ids = [...new Set(items.map((i) => i.productoId))]
  const prods = await db.productoMenu.findMany({ where: { id: { in: ids }, activo: true } })
  if (prods.length !== ids.length) throw new HttpError(400, 'Producto no disponible')
  const lineas = items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, precioUnitario: prods.find((p) => p.id === i.productoId)!.precio }))
  const total = lineas.reduce((a, l) => a.add(l.precioUnitario.mul(l.cantidad)), new Prisma.Decimal(0))
  return { lineas, total }
}
