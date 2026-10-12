<!-- Detalle de una reservación en recepción, con sus acciones según el estado. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { Catalogo, Cuenta, MetodoMostrador, ReservacionStaff } from '#lib/api/types.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { lineaItem, musicaTxt } from '#lib/utils/carta.ts'
  import { metodoTxt } from '#lib/utils/estados.ts'
  import { durTxt, fmtFechaHora, fmtHora, fmtRango, lineas, money, num } from '#lib/utils/formato.ts'
  import Badge from '../Badge.svelte'
  import Modal from '../Modal.svelte'
  import SelectorMenu from '../SelectorMenu.svelte'
  import MetodoPago from './MetodoPago.svelte'
  import { confirmar } from '../confirmar.svelte.ts'

  let { rv, cat, oncambio }: { rv: ReservacionStaff; cat: Catalogo | null; oncambio: () => void } = $props()

  const pagado = $derived(rv.pagos.filter((p) => p.estado === 'PAGADO').reduce((a, p) => a + num(p.monto), 0))
  const saldo = $derived(num(rv.saldoSala))
  let modal = $state<'' | 'checkin' | 'extender' | 'pedido' | 'cerrar' | 'cerrada'>('')
  let metodo = $state<MetodoMostrador>('EFECTIVO')
  let minutos = $state(30)
  let carrito = $state<Record<string, number>>({})
  let cuenta = $state<Cuenta | null>(null)
  let ocupado = $state(false)
  const totalCarrito = $derived(Object.entries(carrito).reduce((a, [id, c]) => a + num(cat?.menu.find((p) => p.id === Number(id))?.precio) * c, 0))

  async function hacer<T>(fn: () => Promise<T>, ok?: (r: T) => string) {
    ocupado = true
    try {
      const r = await fn()
      if (ok) dispatch(avisar(ok(r), 'ok'))
      oncambio()
      return r
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')); return undefined } finally { ocupado = false }
  }

  const msgCheckIn = (r: { retrasoMin: number; tiempoPerdidoMin: number; fin: string; cobradoSala?: string }) =>
    (r.retrasoMin > 0 ? `Check-in con ${r.retrasoMin} min de retraso${r.tiempoPerdidoMin ? ` (se pierden ${r.tiempoPerdidoMin} min)` : ' (se recorrió el fin)'}. Termina ${fmtHora(r.fin)}` : `Check-in listo. Termina ${fmtHora(r.fin)}`)
    + (num(r.cobradoSala) > 0 ? ` · cobrado ${money(r.cobradoSala)}` : '')

  /** Check-in; si el cliente solo pagó el anticipo en línea, primero se cobra el resto de la sala. */
  async function checkIn() {
    if (saldo > 0 && modal !== 'checkin') { metodo = 'EFECTIVO'; modal = 'checkin'; return }
    const r = await hacer(() => api.post<{ retrasoMin: number; tiempoPerdidoMin: number; fin: string; cobradoSala?: string }>(
      `/staff/reservaciones/${rv.id}/check-in`, saldo > 0 ? { metodo } : {}), msgCheckIn)
    if (r) modal = ''
  }
  async function noShow() {
    if (!(await confirmar('Marcar no-show', `${rv.codigo}: no se reembolsa el pago y se cancela el pedido anticipado.`, { ok: 'Marcar no-show', peligro: true }))) return
    hacer(() => api.post(`/staff/reservaciones/${rv.id}/no-show`), () => 'Marcada como no-show')
  }
  async function extender() {
    const r = await hacer(() => api.post<{ fin: string; monto: string }>(`/staff/reservaciones/${rv.id}/extender`, { minutos, metodo }),
      (r) => `Ampliada hasta ${fmtHora(r.fin)} · cobrado ${money(r.monto)}`)
    if (r) modal = ''
  }
  async function enviarPedido() {
    const items = Object.entries(carrito).map(([id, cantidad]) => ({ productoId: Number(id), cantidad }))
    if (!items.length) return dispatch(avisar('Agrega al menos un producto', 'bad'))
    const r = await hacer(() => api.post(`/staff/reservaciones/${rv.id}/pedido`, { items }), () => 'Pedido enviado a barra')
    if (r) { modal = ''; carrito = {} }
  }
  async function cerrar() {
    const c = await hacer(() => api.post<Cuenta>(`/staff/reservaciones/${rv.id}/cerrar-cuenta`, { metodo }))
    if (c) { cuenta = c; modal = 'cerrada' }
  }
  const abrir = (m: typeof modal) => { metodo = 'EFECTIVO'; minutos = 30; carrito = {}; modal = m }
</script>

<div class="card stack">
  <div class="row between">
    <code class="font-mono text-[1.4rem] tracking-[.08em] text-gold">{rv.codigo}</code>
    <Badge estado={rv.estado} />
  </div>
  <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1">
    <dt class="muted small">Cliente</dt><dd>{rv.cliente.nombre}{rv.cliente.telefono ? ` · ${rv.cliente.telefono}` : ''}</dd>
    <dt class="muted small">Horario</dt><dd>{fmtRango(rv.inicio, rv.fin)}{rv.finOriginal ? ` (original ${fmtHora(rv.finOriginal)})` : ''}</dd>
    <dt class="muted small">Sala</dt><dd>{rv.sala.numero} · {rv.sala.tipoSala?.nombre} <Badge estado={rv.sala.estado} /></dd>
    <dt class="muted small">Música</dt><dd>{musicaTxt(rv)}</dd>
    {#if rv.canciones}<dt class="muted small">Canciones</dt><dd>{lineas(rv.canciones).join(' · ')}</dd>{/if}
    <dt class="muted small">Personas</dt><dd>{rv.personas}</dd>
    <dt class="muted small">Canal</dt><dd>{rv.canal === 'WEB' ? 'En línea' : 'Sin registro'}</dd>
    <dt class="muted small">Sala (subtotal)</dt><dd>{money(rv.subtotalSala)}</dd>
    <dt class="muted small">Pagado</dt><dd>{money(pagado)}</dd>
    {#if saldo > 0}<dt class="muted small">Resta de la sala</dt><dd><b class="text-warn">{money(saldo)} · se cobra en el check-in</b></dd>{/if}
    {#if rv.retrasoMin}<dt class="muted small">Retraso</dt><dd>{rv.retrasoMin} min (perdidos {rv.tiempoPerdidoMin})</dd>{/if}
    {#if rv.checkInEn}<dt class="muted small">Check-in</dt><dd>{fmtFechaHora(rv.checkInEn)}</dd>{/if}
  </dl>

  {#if rv.pagos.length}
    <div>
      <h3>Pagos</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Método</th><th>Monto</th><th>Estado</th></tr></thead>
          <tbody>
            {#each rv.pagos as p (p.id)}
              <tr><td>{p.tipo.replace(/_/g, ' ').toLowerCase()}</td><td>{metodoTxt(p.metodo, p.enLinea)}</td><td>{money(p.monto)}</td><td>{p.estado.toLowerCase()}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
  {#if rv.pedidos.length}
    <div>
      <h3>Pedidos</h3>
      {#each rv.pedidos as p (p.id)}
        <div class="row mb-1.5"><Badge estado={p.estado} /><span class="small muted">{p.origen.replace('_', ' ')}</span><span class="small">{p.items.map(lineaItem).join(', ')}</span><b class="small">{money(p.total)}</b></div>
      {/each}
    </div>
  {/if}
  {#if rv.extensiones.length}
    <p class="small muted">Tiempo extra: {rv.extensiones.map((x) => `${x.minutos} min (${money(x.monto)})`).join(', ')}</p>
  {/if}

  {#if rv.estado === 'CONFIRMADA'}
    <div class="row">
      <button class="btn primary" type="button" disabled={ocupado} onclick={checkIn}>{saldo > 0 ? `Check-in y cobrar ${money(saldo)}` : 'Check-in'}</button>
      <button class="btn danger" type="button" disabled={ocupado} onclick={noShow}>No-show</button>
    </div>
  {:else if rv.estado === 'EN_CURSO'}
    <div class="row">
      <button class="btn" type="button" onclick={() => abrir('extender')}>Tiempo extra</button>
      <button class="btn" type="button" onclick={() => abrir('pedido')}>Agregar pedido</button>
      <button class="btn primary" type="button" onclick={() => abrir('cerrar')}>Cerrar cuenta</button>
    </div>
  {/if}
</div>

{#if modal === 'checkin'}
  <Modal abierto titulo="Check-in · {rv.codigo}" onclose={() => (modal = '')}>
    <p>El cliente pagó en línea el anticipo de la sala. Cobra el resto antes de darle acceso:</p>
    <div class="code-big text-[1.8rem]">{money(saldo)}</div>
    <div class="field"><label for="ci-metodo">Método de pago</label><MetodoPago id="ci-metodo" bind:valor={metodo} /></div>
    {#snippet pie()}
      <button class="btn ghost" type="button" onclick={() => (modal = '')}>Volver</button>
      <button class="btn primary" type="button" disabled={ocupado} onclick={checkIn}>Cobrar {money(saldo)} y hacer check-in</button>
    {/snippet}
  </Modal>
{:else if modal === 'extender'}
  <Modal abierto titulo="Tiempo extra · {rv.codigo}" onclose={() => (modal = '')}>
    <p class="muted small">Solo si no hay otra reservación después (incluida la limpieza) y sin rebasar el cierre.</p>
    <div class="form-grid">
      <div class="field"><label for="ex-min">Minutos</label>
        <select id="ex-min" bind:value={minutos}>{#each [30, 60, 90, 120] as n (n)}<option value={n}>{durTxt(n)}</option>{/each}</select></div>
      <div class="field"><label for="ex-metodo">Método de pago</label><MetodoPago id="ex-metodo" bind:valor={metodo} /></div>
    </div>
    {#snippet pie()}
      <button class="btn ghost" type="button" onclick={() => (modal = '')}>Volver</button>
      <button class="btn primary" type="button" disabled={ocupado} onclick={extender}>Cobrar y ampliar</button>
    {/snippet}
  </Modal>
{:else if modal === 'pedido' && cat}
  <Modal abierto titulo="Pedido · sala {rv.sala.numero}" onclose={() => (modal = '')}>
    <p class="muted small">Se cobra al cerrar la cuenta.</p>
    <SelectorMenu menu={cat.menu} tipos={cat.tipos} tipoSalaId={rv.sala.tipoSalaId ?? null} cantidades={carrito}
      oncambiar={(id, c) => { const n = { ...carrito }; if (c) n[id] = c; else delete n[id]; carrito = n }} />
    <p class="mt-3">Total: <b>{money(totalCarrito)}</b></p>
    {#snippet pie()}
      <button class="btn ghost" type="button" onclick={() => (modal = '')}>Volver</button>
      <button class="btn primary" type="button" disabled={ocupado} onclick={enviarPedido}>Enviar a barra</button>
    {/snippet}
  </Modal>
{:else if modal === 'cerrar'}
  <Modal abierto titulo="Cerrar cuenta · {rv.codigo}" onclose={() => (modal = '')}>
    <p class="muted small">Se suman sala, tiempo extra y pedidos; se aplica la promo de la 4ª visita del mes si corresponde, y se cobra el saldo.</p>
    <div class="field"><label for="cc-metodo">Método para el saldo (si hay)</label><MetodoPago id="cc-metodo" bind:valor={metodo} /></div>
    {#snippet pie()}
      <button class="btn ghost" type="button" onclick={() => (modal = '')}>Volver</button>
      <button class="btn primary" type="button" disabled={ocupado} onclick={cerrar}>Cerrar cuenta</button>
    {/snippet}
  </Modal>
{:else if modal === 'cerrada' && cuenta}
  <Modal abierto titulo="Cuenta cerrada · {rv.codigo}" onclose={() => (modal = '')}>
    <dl class="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
      <dt>Sala</dt><dd class="text-right">{money(cuenta.subtotalSala)}</dd>
      <dt>Tiempo extra</dt><dd class="text-right">{money(cuenta.subtotalExtras)}</dd>
      <dt>Pedidos anticipados</dt><dd class="text-right">{money(cuenta.subtotalPedidosAnticipados)}</dd>
      <dt>Consumo</dt><dd class="text-right">{money(cuenta.subtotalConsumo)}</dd>
      {#if num(cuenta.descuento)}<dt>Descuento (promo 4ª visita)</dt><dd class="text-right">−{money(cuenta.descuento)}</dd>{/if}
      <dt><b>Total</b></dt><dd class="text-right"><b>{money(cuenta.total)}</b></dd>
      <dt>Pagado antes</dt><dd class="text-right">{money(cuenta.pagadoPrevio)}</dd>
      <dt><b>Cobrado ahora</b></dt><dd class="text-right"><b>{money(cuenta.saldo)}</b></dd>
    </dl>
    <p class="muted small mt-3">La sala {rv.sala.numero} pasó a limpieza.</p>
    {#snippet pie()}<button class="btn primary" type="button" onclick={() => (modal = '')}>Listo</button>{/snippet}
  </Modal>
{/if}
