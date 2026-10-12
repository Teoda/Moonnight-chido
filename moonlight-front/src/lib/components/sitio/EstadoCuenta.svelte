<!-- Desglose de lo cobrado y lo que falta. Con la cuenta cerrada usa sus totales (incluye la promo). -->
<script lang="ts">
  import type { ReservacionCliente } from '#lib/api/types.ts'
  import { CONCEPTOS, metodoTxt } from '#lib/utils/estados.ts'
  import { money, num } from '#lib/utils/formato.ts'

  let { r }: { r: ReservacionCliente } = $props()

  const d = $derived.by(() => {
    const vivos = r.pedidos.filter((p) => p.estado !== 'CANCELADO')
    const c = r.cuenta
    const sala = c ? num(c.subtotalSala) : num(r.subtotalSala)
    const extras = c ? num(c.subtotalExtras) : (r.extensiones || []).reduce((a, x) => a + num(x.monto), 0)
    const preorden = c ? num(c.subtotalPedidosAnticipados) : vivos.filter((p) => p.origen === 'PREORDEN').reduce((a, p) => a + num(p.total), 0)
    const consumo = c ? num(c.subtotalConsumo) : vivos.filter((p) => p.origen !== 'PREORDEN').reduce((a, p) => a + num(p.total), 0)
    const descuento = c ? num(c.descuento) : 0
    const total = c ? num(c.total) : sala + extras + preorden + consumo
    const pagos = (r.pagos || []).filter((p) => p.estado === 'PAGADO')
    const reembolsos = (r.pagos || []).filter((p) => p.tipo === 'REEMBOLSO')
    const pagado = pagos.reduce((a, p) => a + num(p.monto), 0)
    return { c, sala, extras, preorden, consumo, descuento, total, pagos, reembolsos, pagado, saldo: Math.max(0, total - pagado) }
  })
  const terminada = $derived(['FINALIZADA', 'CANCELADA', 'NO_SHOW'].includes(r.estado))
</script>

<div class="estado-cuenta">
  <h4>{d.c ? 'Cuenta cerrada' : r.estado === 'EN_CURSO' ? 'Tu cuenta hasta ahora' : 'Estado de cuenta'}</h4>
  <dl>
    <dt>Sala</dt><dd>{money(d.sala)}</dd>
    {#if d.extras}<dt>Tiempo extra</dt><dd>{money(d.extras)}</dd>{/if}
    {#if d.preorden}<dt>Pedido anticipado</dt><dd>{money(d.preorden)}</dd>{/if}
    {#if d.consumo}<dt>Consumo en sala</dt><dd>{money(d.consumo)}</dd>{/if}
    {#if d.descuento}<dt class="ok">Descuento (promo)</dt><dd class="ok">−{money(d.descuento)}</dd>{/if}
    <dt class="total">Total</dt><dd class="total">{money(d.total)}</dd>
    <dt>Pagado</dt><dd>{money(d.pagado)}</dd>
    {#if !terminada}
      <dt class={d.saldo > 0 ? 'pendiente' : 'ok'}>Por pagar</dt><dd class={d.saldo > 0 ? 'pendiente' : 'ok'}>{money(d.saldo)}</dd>
    {/if}
  </dl>
  {#if d.pagos.length || d.reembolsos.length}
    <details class="mt-2.5 text-[.88rem]">
      <summary class="cursor-pointer text-muted">Pagos ({d.pagos.length + d.reembolsos.length})</summary>
      <ul class="mt-2 list-none p-0">
        {#each [...d.pagos, ...d.reembolsos] as p (p.id)}
          <li class="flex justify-between gap-2.5 border-b border-dashed border-line py-1">
            <span>{CONCEPTOS[p.tipo] || p.tipo} · {metodoTxt(p.metodo, p.enLinea)}</span>
            <b>{p.tipo === 'REEMBOLSO' ? '−' : ''}{money(p.monto)}</b>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
  {#if !d.c && d.consumo}
    <p class="muted small mt-2">El consumo en sala se paga al cerrar la cuenta. Si te toca la promo de la 4ª visita, el descuento se aplica al cerrar.</p>
  {/if}
</div>
