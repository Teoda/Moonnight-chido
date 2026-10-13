import { prisma } from './db'
import { getConfig } from './disponibilidad'
import { MIN } from './tiempo'
import { asegurarReporteSemanal } from './reportes'

/** Corre cada minuto: libera reservas sin pagar, marca no-show al pasar la tolerancia de llegada
 *  y genera el reporte financiero semanal en cuanto pasa el corte del domingo. */
export async function mantenimiento() {
  const ahora = new Date()
  const cfg = await getConfig(prisma)

  const vencidas = await prisma.reservacion.findMany({ where: { estado: 'PENDIENTE_PAGO', expiraEn: { lt: ahora } }, select: { id: true } })
  if (vencidas.length) {
    const ids = vencidas.map((v) => v.id)
    await prisma.$transaction([
      prisma.reservacion.updateMany({ where: { id: { in: ids }, estado: 'PENDIENTE_PAGO' }, data: { estado: 'CANCELADA' } }),
      prisma.pedido.updateMany({ where: { reservacionId: { in: ids }, estado: 'EN_ESPERA' }, data: { estado: 'CANCELADO' } }),
    ])
  }

  const limite = new Date(ahora.getTime() - cfg.toleranciaMin * MIN)
  const noShows = await prisma.reservacion.findMany({ where: { estado: 'CONFIRMADA', inicio: { lt: limite } }, select: { id: true } })
  if (noShows.length) {
    const ids = noShows.map((v) => v.id)
    await prisma.$transaction([
      prisma.reservacion.updateMany({ where: { id: { in: ids }, estado: 'CONFIRMADA' }, data: { estado: 'NO_SHOW' } }),
      prisma.pedido.updateMany({ where: { reservacionId: { in: ids }, estado: 'EN_ESPERA' }, data: { estado: 'CANCELADO' } }),
    ])
  }
  await prisma.sesion.deleteMany({ where: { expiraEn: { lt: ahora } } })
  await asegurarReporteSemanal().catch((e) => console.error('[reporte semanal]', e)) // si falla, se reintenta al siguiente minuto
}
