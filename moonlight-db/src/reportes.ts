// Reporte financiero semanal (PDF). Se genera solo cada domingo a las 06:00 (hora de México), ya cerrada
// la operación del sábado (cierra a las 02:00), y cubre de domingo 06:00 a domingo 06:00: cada día con su madrugada.
// Si el servidor estuvo apagado ese domingo, se genera en cuanto vuelva a correr el mantenimiento.
//
// Criterios:
// - Ingresos (salas, alimentos, bebidas, paquetes, descuentos, retenciones): por fecha de la VISITA
//   (reservaciones cuyo inicio cae en la semana).
// - Cobros y métodos de pago: por fecha en que se REGISTRÓ el pago.
// - Pagos pendientes: lo que faltaba por cobrar de las visitas de la semana al momento de generar el reporte.
import PDFDocument from 'pdfkit'
import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { aFecha, partes, sumarDias } from './tiempo'

const CORTE = '06:00'
const SEMANA_MS = 7 * 86400_000
const TZ = 'America/Mexico_City'

// ───────────── PERIODOS ─────────────
/** Último corte (domingo 06:00) que ya pasó. */
export function ultimoCorte(ahora = new Date()) {
  const { fecha } = partes(ahora)
  const dow = new Date(fecha + 'T00:00:00Z').getUTCDay()
  const corte = aFecha(sumarDias(fecha, -dow), CORTE)
  return corte > ahora ? new Date(corte.getTime() - SEMANA_MS) : corte
}
/** Semana completa que termina en `hasta`. */
export const semanaQueTermina = (hasta: Date) => ({ desde: new Date(hasta.getTime() - SEMANA_MS), hasta })

// ───────────── CÁLCULO ─────────────
const D = (n: Prisma.Decimal.Value = 0) => new Prisma.Decimal(n)
const n2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2).toNumber()
const sumar = <T>(xs: T[], f: (x: T) => Prisma.Decimal.Value) => xs.reduce((a, x) => a.add(f(x)), D())

export interface Ingresos {
  salas: number; tiempoExtra: number; alimentos: number; bebidas: number; paquetes: number
  descuentos: number; retenciones: number; total: number
}
export interface Metodo { metodo: string; enLinea: boolean; operaciones: number; monto: number }
export interface Semana {
  desde: string; hasta: string; calculadoEn: string
  ingresos: Ingresos
  cortesias: { cantidad: number; valor: number }
  visitas: number
  reservaciones: Record<string, number>
  cobros: { metodos: Metodo[]; cobrado: number; reembolsos: number; neto: number }
  descuentos: { codigo: string; fecha: string; cliente: string; promocion: string; monto: number }[]
  cancelaciones: {
    porCliente: number; vencidas: number; noShow: number; reembolsado: number; retenidoCancelacion: number; retenidoNoShow: number
    detalle: { codigo: string; fecha: string; cliente: string; tipo: string; reembolso: number; retenido: number }[]
  }
  pendientes: { total: number; detalle: { codigo: string; fecha: string; cliente: string; concepto: string; monto: number }[] }
  cuentas: { codigo: string; fecha: string; cliente: string; sala: string; sala$: number; extras: number; consumo: number; descuento: number; total: number }[]
}
/** Lo de la semana anterior que se usa para comparar. */
export type Comparable = Pick<Semana, 'desde' | 'hasta' | 'ingresos' | 'visitas'> & { cobrado: number; cancelaciones: number }
export interface DatosReporte { actual: Semana; anterior: Comparable }

export async function calcular(desde: Date, hasta: Date, ahora = new Date()): Promise<Semana> {
  const [rvs, pagos] = await Promise.all([
    prisma.reservacion.findMany({
      where: { inicio: { gte: desde, lt: hasta } }, orderBy: { inicio: 'asc' },
      include: {
        cliente: { select: { nombre: true } }, sala: { select: { numero: true, tipoSala: { select: { nombre: true } } } },
        pedidos: { include: { items: { include: { producto: { select: { categoria: true, precio: true } } } } } },
        extensiones: true, pagos: true, cuenta: true, cancelacion: true, promocion: { select: { nombre: true } },
      },
    }),
    prisma.pago.findMany({ where: { creadoEn: { gte: desde, lt: hasta } } }),
  ])

  const ing = { salas: D(), tiempoExtra: D(), ALIMENTO: D(), BEBIDA: D(), PAQUETE: D(), descuentos: D(), retenciones: D() }
  const cortesias = { cantidad: 0, valor: D() }
  const reservaciones: Record<string, number> = {}
  const cancel = { porCliente: 0, vencidas: 0, noShow: 0, reembolsado: D(), retenidoCancelacion: D(), retenidoNoShow: D() }
  const out: Pick<Semana, 'descuentos' | 'cuentas'> & { cancel: Semana['cancelaciones']['detalle']; pend: Semana['pendientes']['detalle'] } =
    { descuentos: [], cuentas: [], cancel: [], pend: [] }
  let visitas = 0, pendiente = D()

  for (const rv of rvs) {
    reservaciones[rv.estado] = (reservaciones[rv.estado] ?? 0) + 1
    const base = { codigo: rv.codigo, fecha: rv.inicio.toISOString(), cliente: rv.cliente.nombre }
    const pagado = sumar(rv.pagos.filter((p) => p.estado === 'PAGADO'), (p) => p.monto)
    const pedidos = rv.pedidos.filter((p) => p.estado !== 'CANCELADO')
    const extras = sumar(rv.extensiones, (e) => e.monto)

    if (rv.estado === 'FINALIZADA' || rv.estado === 'EN_CURSO') {
      visitas++
      ing.salas = ing.salas.add(rv.subtotalSala)
      ing.tiempoExtra = ing.tiempoExtra.add(extras)
      for (const i of pedidos.flatMap((p) => p.items)) {
        ing[i.producto.categoria] = ing[i.producto.categoria].add(i.precioUnitario.mul(i.cantidad))
        if (i.precioUnitario.eq(0) && i.producto.precio.gt(0)) { cortesias.cantidad += i.cantidad; cortesias.valor = cortesias.valor.add(i.producto.precio.mul(i.cantidad)) }
      }
      if (rv.cuenta?.descuento.gt(0)) {
        ing.descuentos = ing.descuentos.add(rv.cuenta.descuento)
        out.descuentos.push({ ...base, promocion: rv.promocion?.nombre ?? 'Descuento', monto: n2(rv.cuenta.descuento) })
      }
      if (rv.cuenta) {
        const c = rv.cuenta
        out.cuentas.push({
          ...base, sala: `${rv.sala.numero} · ${rv.sala.tipoSala.nombre}`, sala$: n2(c.subtotalSala), extras: n2(c.subtotalExtras),
          consumo: n2(c.subtotalPedidosAnticipados.add(c.subtotalConsumo)), descuento: n2(c.descuento), total: n2(c.total),
        })
      }
    }

    if (rv.estado === 'CANCELADA') {
      if (rv.cancelacion) {
        cancel.porCliente++
        cancel.reembolsado = cancel.reembolsado.add(rv.cancelacion.reembolso)
        cancel.retenidoCancelacion = cancel.retenidoCancelacion.add(rv.cancelacion.retenido)
        out.cancel.push({ ...base, tipo: 'Cancelada por el cliente', reembolso: n2(rv.cancelacion.reembolso), retenido: n2(rv.cancelacion.retenido) })
      } else {
        cancel.vencidas++
        out.cancel.push({ ...base, tipo: 'Vencida sin pago', reembolso: 0, retenido: 0 })
      }
    }
    if (rv.estado === 'NO_SHOW') {
      cancel.noShow++
      cancel.retenidoNoShow = cancel.retenidoNoShow.add(pagado)
      out.cancel.push({ ...base, tipo: 'No se presentó', reembolso: 0, retenido: n2(pagado) })
    }

    // pendiente de cobro (al momento de generar)
    let debe = D(), concepto = ''
    if (rv.estado === 'PENDIENTE_PAGO') {
      debe = rv.anticipoSala.add(sumar(pedidos, (p) => p.anticipo)); concepto = 'Anticipo en línea sin pagar'
    } else if (rv.estado === 'CONFIRMADA' || rv.estado === 'EN_CURSO') {
      debe = rv.subtotalSala.add(extras).add(sumar(pedidos, (p) => p.total)).sub(pagado)
      concepto = rv.estado === 'CONFIRMADA' ? 'Saldo por cobrar al llegar' : 'Cuenta abierta (sin cerrar)'
    }
    if (debe.gt(0)) { pendiente = pendiente.add(debe); out.pend.push({ ...base, concepto, monto: n2(debe) }) }
  }

  // cobros de la semana por método
  const metodos = new Map<string, { metodo: string; enLinea: boolean; operaciones: number; monto: Prisma.Decimal }>()
  let cobrado = D(), reembolsos = D()
  for (const p of pagos) {
    if (p.estado === 'REEMBOLSADO') { reembolsos = reembolsos.add(p.monto); continue }
    if (p.estado === 'PENDIENTE') {
      const rv = rvs.find((x) => x.id === p.reservacionId)
      if (rv) { pendiente = pendiente.add(p.monto); out.pend.push({ codigo: rv.codigo, fecha: p.creadoEn.toISOString(), cliente: rv.cliente.nombre, concepto: 'Pago registrado como pendiente', monto: n2(p.monto) }) }
      continue
    }
    if (p.estado !== 'PAGADO') continue
    const k = `${p.metodo}:${p.enLinea}`
    const m = metodos.get(k) ?? { metodo: p.metodo, enLinea: p.enLinea, operaciones: 0, monto: D() }
    m.operaciones++; m.monto = m.monto.add(p.monto); metodos.set(k, m)
    cobrado = cobrado.add(p.monto)
  }

  ing.retenciones = cancel.retenidoCancelacion.add(cancel.retenidoNoShow)
  const total = ing.salas.add(ing.tiempoExtra).add(ing.ALIMENTO).add(ing.BEBIDA).add(ing.PAQUETE).sub(ing.descuentos).add(ing.retenciones)
  return {
    desde: desde.toISOString(), hasta: hasta.toISOString(), calculadoEn: ahora.toISOString(),
    ingresos: {
      salas: n2(ing.salas), tiempoExtra: n2(ing.tiempoExtra), alimentos: n2(ing.ALIMENTO), bebidas: n2(ing.BEBIDA), paquetes: n2(ing.PAQUETE),
      descuentos: n2(ing.descuentos), retenciones: n2(ing.retenciones), total: n2(total),
    },
    cortesias: { cantidad: cortesias.cantidad, valor: n2(cortesias.valor) },
    visitas, reservaciones,
    cobros: {
      metodos: [...metodos.values()].sort((a, b) => b.monto.cmp(a.monto)).map((m) => ({ ...m, monto: n2(m.monto) })),
      cobrado: n2(cobrado), reembolsos: n2(reembolsos), neto: n2(cobrado.sub(reembolsos)),
    },
    descuentos: out.descuentos,
    cancelaciones: {
      porCliente: cancel.porCliente, vencidas: cancel.vencidas, noShow: cancel.noShow, reembolsado: n2(cancel.reembolsado),
      retenidoCancelacion: n2(cancel.retenidoCancelacion), retenidoNoShow: n2(cancel.retenidoNoShow), detalle: out.cancel,
    },
    pendientes: { total: n2(pendiente), detalle: out.pend },
    cuentas: out.cuentas,
  }
}

const comparable = (s: Semana): Comparable => ({
  desde: s.desde, hasta: s.hasta, ingresos: s.ingresos, visitas: s.visitas, cobrado: s.cobros.neto,
  cancelaciones: s.cancelaciones.porCliente + s.cancelaciones.vencidas + s.cancelaciones.noShow,
})

/** Calcula la semana y la compara con el mismo periodo de la semana anterior. */
export async function datosReporte(desde: Date, hasta: Date): Promise<DatosReporte> {
  const ahora = new Date()
  const [actual, anterior] = await Promise.all([
    calcular(desde, hasta, ahora),
    calcular(new Date(desde.getTime() - SEMANA_MS), new Date(hasta.getTime() - SEMANA_MS), ahora),
  ])
  return { actual, anterior: comparable(anterior) }
}

// ───────────── PDF ─────────────
const C = {
  noche: '#140d2b', morado: '#7c3aed', fucsia: '#c026d3', dorado: '#b7791f', lila: '#e9d5ff',
  texto: '#1f1633', gris: '#6b6480', linea: '#e4def0', suave: '#f6f2fd', cebra: '#faf8fe', verde: '#15803d', rojo: '#b91c1c',
}
const mx = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const dinero = (n: number) => mx.format(n)
const fFecha = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' })
const fLarga = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' })
const fHora = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const fecha = (iso: string) => fFecha.format(new Date(iso))

/** Semana completa: "del 4 al 10 de octubre de 2026" (el último día es el anterior al corte de cierre).
 *  Tramo parcial (semana en curso): con fecha y hora de inicio y fin. */
export function etiquetaPeriodo(desde: string, hasta: string) {
  const a = new Date(desde), h = new Date(hasta)
  if (h.getTime() - a.getTime() !== SEMANA_MS) return `del ${fHora.format(a)} al ${fHora.format(h)}`
  const b = new Date(h.getTime() - 86400_000)
  const [ta, tb] = [fLarga.format(a), fLarga.format(b)]
  const mismoMes = ta.replace(/^\d+ de /, '') === tb.replace(/^\d+ de /, '')
  return `del ${mismoMes ? ta.split(' ')[0] : ta.replace(/ de \d{4}$/, '')} al ${tb}`
}
/** Variación porcentual; null si la semana anterior fue 0 y esta no. */
export const variacion = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : null) : ((a - b) / Math.abs(b)) * 100)
const txtVar = (v: number | null) => (v === null ? 'nuevo' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)
const METODOS: Record<string, string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TARJETA_DEBITO: 'Tarjeta de débito', TARJETA_CREDITO: 'Tarjeta de crédito' }

type Col = { t: string; w: number; a?: 'left' | 'right' | 'center' }

export function crearPdf(d: DatosReporte, op: { automatico: boolean; preliminar?: boolean }): Promise<Uint8Array<ArrayBuffer>> {
  const { actual: s, anterior: p } = d
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `Reporte semanal Moonlight ${etiquetaPeriodo(s.desde, s.hasta)}`, Author: 'Moonlight Karaoke & Social Lounge' } })
  const partesPdf: Buffer[] = []
  doc.on('data', (c: Buffer) => partesPdf.push(c))
  const listo = new Promise<Uint8Array<ArrayBuffer>>((ok, mal) => { doc.on('end', () => ok(new Uint8Array(Buffer.concat(partesPdf)))); doc.on('error', mal) })

  const X = 40, W = doc.page.width - 80, ABAJO = () => doc.page.height - 56
  const espacio = (h: number) => { if (doc.y + h > ABAJO()) { doc.addPage(); doc.y = 40 } }

  // encabezado
  doc.rect(0, 0, doc.page.width, 92).fill(C.noche)
  doc.fillColor('#ffc23d').font('Helvetica-Bold').fontSize(22).text('MOONLIGHT', X, 26, { characterSpacing: 2 })
  doc.fillColor(C.lila).font('Helvetica').fontSize(8.5).text('KARAOKE & SOCIAL LOUNGE', X, 52, { characterSpacing: 2.5 })
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text(op.preliminar ? 'Reporte semanal (preliminar)' : 'Reporte financiero semanal', X, 24, { width: W, align: 'right' })
  doc.fillColor(C.lila).font('Helvetica').fontSize(9)
    .text(op.preliminar ? `Semana en curso, hasta el ${fHora.format(new Date(s.hasta))}` : `Semana ${etiquetaPeriodo(s.desde, s.hasta)}`, X, 44, { width: W, align: 'right' })
    .text(`Generado el ${fHora.format(new Date(s.calculadoEn))} · ${op.automatico ? 'automático' : 'manual'}`, X, 58, { width: W, align: 'right' })
  doc.y = 110

  // tarjetas de resumen
  const vIng = variacion(s.ingresos.total, p.ingresos.total)
  const kpis: [string, string, string, string?][] = [
    ['Ingresos', dinero(s.ingresos.total), `${txtVar(vIng)} vs semana anterior`, vIng === null || vIng >= 0 ? C.verde : C.rojo],
    ['Cobrado neto', dinero(s.cobros.neto), `Reembolsos: ${dinero(s.cobros.reembolsos)}`],
    ['Visitas', String(s.visitas), `Semana anterior: ${p.visitas}`],
    ['Por cobrar', dinero(s.pendientes.total), `${s.pendientes.detalle.length} concepto(s)`, s.pendientes.total > 0 ? C.rojo : C.verde],
  ]
  const kw = (W - 30) / 4, ky = doc.y
  kpis.forEach(([t, v, sub, color], i) => {
    const x = X + i * (kw + 10)
    doc.roundedRect(x, ky, kw, 62, 6).fillAndStroke(C.suave, C.linea)
    doc.fillColor(C.gris).font('Helvetica').fontSize(7.5).text(t.toUpperCase(), x + 10, ky + 9, { width: kw - 20, characterSpacing: .4 })
    doc.fillColor(C.texto).font('Helvetica-Bold').fontSize(14).text(v, x + 10, ky + 22, { width: kw - 20 })
    doc.fillColor(color ?? C.gris).font('Helvetica').fontSize(7.5).text(sub, x + 10, ky + 44, { width: kw - 20 })
  })
  doc.y = ky + 80

  const seccion = (t: string, nota?: string) => {
    espacio(70)
    doc.x = X
    doc.fillColor(C.morado).font('Helvetica-Bold').fontSize(12).text(t, X, doc.y)
    doc.moveTo(X, doc.y + 2).lineTo(X + W, doc.y + 2).lineWidth(1).strokeColor(C.linea).stroke()
    doc.y += 7
    if (nota) doc.fillColor(C.gris).font('Helvetica').fontSize(8).text(nota, X, doc.y, { width: W }).moveDown(.4)
  }
  const parrafo = (t: string) => { doc.fillColor(C.gris).font('Helvetica-Oblique').fontSize(9).text(t, X, doc.y, { width: W }); doc.moveDown(.8) }

  /** Tabla con encabezado repetido al saltar de página. `resaltar`: índices de filas en negritas (totales). */
  const tabla = (cols: Col[], filas: string[][], o: { resaltar?: number[]; color?: (f: number, c: number) => string | undefined } = {}) => {
    const anchoTotal = cols.reduce((a, c) => a + c.w, 0)
    const ws = cols.map((c) => (c.w / anchoTotal) * W)
    const pad = 5
    const encabezado = () => {
      const y = doc.y
      doc.rect(X, y, W, 18).fill('#efe8fb')
      let x = X
      cols.forEach((c, i) => { doc.fillColor(C.gris).font('Helvetica-Bold').fontSize(7).text(c.t.toUpperCase(), x + pad, y + 6, { width: ws[i] - pad * 2, align: c.a ?? 'left', lineBreak: false }); x += ws[i] })
      doc.y = y + 18
    }
    espacio(40); encabezado()
    filas.forEach((f, fi) => {
      const negrita = o.resaltar?.includes(fi)
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
      const h = Math.max(...f.map((t, i) => doc.heightOfString(t, { width: ws[i] - pad * 2 }))) + 9
      if (doc.y + h > ABAJO()) { doc.addPage(); doc.y = 40; encabezado(); doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5) }
      const y = doc.y
      if (negrita) doc.rect(X, y, W, h).fill(C.suave)
      else if (fi % 2) doc.rect(X, y, W, h).fill(C.cebra)
      let x = X
      f.forEach((t, i) => {
        doc.fillColor(o.color?.(fi, i) ?? C.texto).font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
          .text(t, x + pad, y + 4.5, { width: ws[i] - pad * 2, align: cols[i].a ?? 'left' })
        x += ws[i]
      })
      doc.moveTo(X, y + h).lineTo(X + W, y + h).lineWidth(.5).strokeColor(C.linea).stroke()
      doc.y = y + h
    })
    doc.x = X
    doc.moveDown(1)
  }
  const colorVar = (v: number | null, inverso = false) => (v === null || v === 0 ? C.gris : (v > 0) !== inverso ? C.verde : C.rojo)

  // 1. ingresos y comparación
  seccion('Ingresos por concepto y comparación con la semana anterior',
    `Por fecha de la visita. Semana anterior: ${etiquetaPeriodo(p.desde, p.hasta)}${op.preliminar ? ' (mismo tramo de la semana)' : ''}.`)
  const conceptos: [string, keyof Ingresos, boolean?][] = [
    ['Renta de salas', 'salas'], ['Tiempo extra', 'tiempoExtra'], ['Alimentos', 'alimentos'], ['Bebidas', 'bebidas'], ['Paquetes', 'paquetes'],
    ['(-) Descuentos aplicados', 'descuentos', true], ['Retenciones por cancelación y no-show', 'retenciones'], ['Total de ingresos', 'total'],
  ]
  const vars = conceptos.map(([, k]) => variacion(s.ingresos[k], p.ingresos[k]))
  tabla(
    [{ t: 'Concepto', w: 40 }, { t: 'Esta semana', w: 20, a: 'right' }, { t: 'Semana anterior', w: 20, a: 'right' }, { t: 'Variación', w: 14, a: 'right' }],
    [
      ...conceptos.map(([t, k], i) => [t, dinero(s.ingresos[k]), dinero(p.ingresos[k]), txtVar(vars[i])]),
      ['Cobrado neto en caja', dinero(s.cobros.neto), dinero(p.cobrado), txtVar(variacion(s.cobros.neto, p.cobrado))],
      ['Visitas', String(s.visitas), String(p.visitas), txtVar(variacion(s.visitas, p.visitas))],
    ],
    { resaltar: [7], color: (f, c) => (c === 3 ? (f < conceptos.length ? colorVar(vars[f], conceptos[f][2]) : C.gris) : undefined) },
  )

  // barras: esta semana vs anterior
  const barras = conceptos.slice(0, 5)
  const max = Math.max(1, ...barras.flatMap(([, k]) => [s.ingresos[k], p.ingresos[k]]))
  espacio(barras.length * 26 + 30)
  const by0 = doc.y, etq = 90, bw = W - etq - 90
  barras.forEach(([t, k], i) => {
    const y = by0 + i * 26
    doc.fillColor(C.texto).font('Helvetica').fontSize(8.5).text(t, X, y + 4, { width: etq - 8 })
    doc.rect(X + etq, y, Math.max(1.5, (s.ingresos[k] / max) * bw), 9).fill(C.morado)
    doc.rect(X + etq, y + 11, Math.max(1.5, (p.ingresos[k] / max) * bw), 7).fill('#cfc6e3')
    doc.fillColor(C.texto).fontSize(7.5).text(dinero(s.ingresos[k]), X + etq + bw + 6, y, { width: 84 })
    doc.fillColor(C.gris).text(dinero(p.ingresos[k]), X + etq + bw + 6, y + 10, { width: 84 })
  })
  const ly = by0 + barras.length * 26 + 2
  doc.rect(X + etq, ly, 9, 7).fill(C.morado); doc.fillColor(C.gris).fontSize(7.5).text('Esta semana', X + etq + 13, ly)
  doc.rect(X + etq + 80, ly, 9, 7).fill('#cfc6e3'); doc.fillColor(C.gris).text('Semana anterior', X + etq + 93, ly)
  doc.x = X; doc.y = ly + 22

  // 2. métodos de pago
  seccion('Métodos de pago', 'Pagos registrados en la semana (anticipos en línea, cobros en recepción y cierres de cuenta).')
  if (!s.cobros.metodos.length && !s.cobros.reembolsos) parrafo('No se registraron pagos esta semana.')
  else tabla(
    [{ t: 'Método', w: 40 }, { t: 'Operaciones', w: 16, a: 'right' }, { t: 'Monto', w: 22, a: 'right' }, { t: '% del cobrado', w: 16, a: 'right' }],
    [
      ...s.cobros.metodos.map((m) => [
        `${METODOS[m.metodo] ?? m.metodo}${m.enLinea ? ' (en línea)' : ''}`, String(m.operaciones), dinero(m.monto),
        s.cobros.cobrado ? `${((m.monto / s.cobros.cobrado) * 100).toFixed(1)}%` : '-',
      ]),
      ['Total cobrado', String(s.cobros.metodos.reduce((a, m) => a + m.operaciones, 0)), dinero(s.cobros.cobrado), '100%'],
      ['(-) Reembolsos', '', dinero(s.cobros.reembolsos), ''],
      ['Cobrado neto', '', dinero(s.cobros.neto), ''],
    ],
    { resaltar: [s.cobros.metodos.length, s.cobros.metodos.length + 2] },
  )

  // 3. descuentos
  seccion('Descuentos aplicados',
    `Total: ${dinero(s.ingresos.descuentos)} en ${s.descuentos.length} cuenta(s).` +
    (s.cortesias.cantidad ? ` Además se entregaron ${s.cortesias.cantidad} botella(s) de cortesía (Sala Premium) con valor de carta de ${dinero(s.cortesias.valor)}.` : ''))
  if (!s.descuentos.length) parrafo('No se aplicaron descuentos esta semana.')
  else tabla(
    [{ t: 'Reservación', w: 16 }, { t: 'Fecha', w: 16 }, { t: 'Cliente', w: 30 }, { t: 'Promoción', w: 24 }, { t: 'Descuento', w: 14, a: 'right' }],
    s.descuentos.map((x) => [x.codigo, fecha(x.fecha), x.cliente, x.promocion, dinero(x.monto)]),
  )

  // 4. cancelaciones
  const c = s.cancelaciones
  seccion('Cancelaciones y no-show', `Semana anterior: ${p.cancelaciones} en total.`)
  tabla(
    [{ t: 'Concepto', w: 40 }, { t: 'Cantidad', w: 16, a: 'right' }, { t: 'Reembolsado', w: 22, a: 'right' }, { t: 'Retenido', w: 22, a: 'right' }],
    [
      ['Canceladas por el cliente', String(c.porCliente), dinero(c.reembolsado), dinero(c.retenidoCancelacion)],
      ['Vencidas sin pago', String(c.vencidas), dinero(0), dinero(0)],
      ['No se presentaron (no-show)', String(c.noShow), dinero(0), dinero(c.retenidoNoShow)],
      ['Total', String(c.porCliente + c.vencidas + c.noShow), dinero(c.reembolsado), dinero(c.retenidoCancelacion + c.retenidoNoShow)],
    ],
    { resaltar: [3] },
  )
  if (c.detalle.length) tabla(
    [{ t: 'Reservación', w: 15 }, { t: 'Fecha', w: 12 }, { t: 'Cliente', w: 24 }, { t: 'Tipo', w: 21 }, { t: 'Reembolso', w: 14, a: 'right' }, { t: 'Retenido', w: 14, a: 'right' }],
    c.detalle.map((x) => [x.codigo, fecha(x.fecha), x.cliente, x.tipo, dinero(x.reembolso), dinero(x.retenido)]),
  )

  // 5. pendientes
  seccion('Pagos pendientes', `Lo que faltaba por cobrar de las visitas de la semana al ${fHora.format(new Date(s.calculadoEn))}.`)
  if (!s.pendientes.detalle.length) parrafo('No hay pagos pendientes.')
  else tabla(
    [{ t: 'Reservación', w: 16 }, { t: 'Fecha', w: 16 }, { t: 'Cliente', w: 28 }, { t: 'Concepto', w: 26 }, { t: 'Monto', w: 14, a: 'right' }],
    [...s.pendientes.detalle.map((x) => [x.codigo, fecha(x.fecha), x.cliente, x.concepto, dinero(x.monto)]), ['Total pendiente', '', '', '', dinero(s.pendientes.total)]],
    { resaltar: [s.pendientes.detalle.length] },
  )

  // 6. estados de cuenta
  seccion('Estados de cuenta de la semana', `${s.cuentas.length} cuenta(s) cerrada(s).`)
  if (!s.cuentas.length) parrafo('No se cerraron cuentas esta semana.')
  else {
    const t = s.cuentas.reduce((a, x) => ({ sala$: a.sala$ + x.sala$, extras: a.extras + x.extras, consumo: a.consumo + x.consumo, descuento: a.descuento + x.descuento, total: a.total + x.total }),
      { sala$: 0, extras: 0, consumo: 0, descuento: 0, total: 0 })
    tabla(
      [{ t: 'Reservación', w: 16 }, { t: 'Fecha', w: 11 }, { t: 'Cliente', w: 18 }, { t: 'Sala', w: 13 }, { t: 'Sala $', w: 11, a: 'right' },
        { t: 'Extras', w: 10, a: 'right' }, { t: 'Alim./beb.', w: 11, a: 'right' }, { t: 'Desc.', w: 9, a: 'right' }, { t: 'Total', w: 12, a: 'right' }],
      [
        ...s.cuentas.map((x) => [x.codigo, fecha(x.fecha), x.cliente, x.sala, dinero(x.sala$), dinero(x.extras), dinero(x.consumo), dinero(x.descuento), dinero(x.total)]),
        ['Total', '', '', '', dinero(t.sala$), dinero(t.extras), dinero(t.consumo), dinero(t.descuento), dinero(t.total)],
      ],
      { resaltar: [s.cuentas.length] },
    )
  }

  // pie de página en cada hoja
  const rango = doc.bufferedPageRange()
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i)
    const margen = doc.page.margins.bottom
    doc.page.margins.bottom = 0 // escribir bajo el margen sin que pdfkit agregue otra página
    doc.fillColor(C.gris).font('Helvetica').fontSize(7.5)
      .text(`Moonlight · Reporte semanal ${etiquetaPeriodo(s.desde, s.hasta)}`, X, doc.page.height - 30, { width: W / 2, lineBreak: false })
      .text(`Página ${i + 1} de ${rango.count}`, X + W / 2, doc.page.height - 30, { width: W / 2, align: 'right', lineBreak: false })
    doc.page.margins.bottom = margen
  }
  doc.end()
  return listo
}

// ───────────── GENERACIÓN ─────────────
/** Calcula, arma el PDF y lo guarda (reemplaza el de esa semana si ya existía). */
export async function generarReporte(desde: Date, hasta: Date, op: { automatico: boolean; usuarioId?: number }) {
  const datos = await datosReporte(desde, hasta)
  const pdf = await crearPdf(datos, { automatico: op.automatico })
  const data = { hasta, datos: datos as unknown as Prisma.InputJsonValue, pdf, automatico: op.automatico, generadoPorId: op.usuarioId ?? null, generadoEn: new Date() }
  return prisma.reporteSemanal.upsert({ where: { desde }, create: { desde, ...data }, update: data, select: { id: true } })
}

/** Lo llama el mantenimiento cada minuto: si ya pasó el corte del domingo y no hay reporte de esa semana, lo genera. */
export async function asegurarReporteSemanal() {
  const { desde, hasta } = semanaQueTermina(ultimoCorte())
  if (await prisma.reporteSemanal.findUnique({ where: { desde }, select: { id: true } })) return
  const datos = await datosReporte(desde, hasta)
  const pdf = await crearPdf(datos, { automatico: true })
  try {
    await prisma.reporteSemanal.create({ data: { desde, hasta, datos: datos as unknown as Prisma.InputJsonValue, pdf, automatico: true } })
    console.log(`Reporte semanal generado: ${etiquetaPeriodo(desde.toISOString(), hasta.toISOString())}`)
  } catch (e) {
    if ((e as { code?: string }).code !== 'P2002') throw e // otra instancia lo generó al mismo tiempo
  }
}
