<!-- Recepción: buscar por número de reservación, cliente sin registro y pedidos anticipados por cobrar. -->
<script lang="ts">
  import { untrack } from 'svelte'
  import { api } from '#lib/api/client.ts'
  import type { MetodoMostrador, PedidoBarra, ReservacionStaff } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { lineaItem } from '#lib/utils/carta.ts'
  import { money, num } from '#lib/utils/formato.ts'
  import Badge from '#lib/components/Badge.svelte'
  import DetalleReservacion from '#lib/components/staff/DetalleReservacion.svelte'
  import Mostrador from '#lib/components/staff/Mostrador.svelte'
  import MetodoPago from '#lib/components/staff/MetodoPago.svelte'
  import { recepcion } from '#lib/components/staff/panel.svelte.ts'

  const cat = seleccionar((s) => s.catalogo.datos)
  let codigo = $state(recepcion.codigo)
  let rv = $state<ReservacionStaff | null>(null)
  let buscando = $state(false), error = $state('')
  let porCobrar = $state<PedidoBarra[] | null>(null), errorCobrar = $state('')
  let metodos = $state<Record<number, MetodoMostrador>>({})
  let mostrador = $state(false)

  async function buscar(c = codigo) {
    c = (c || '').trim().toUpperCase()
    if (!/^ML[0-9A-F]{8}$/.test(c)) return dispatch(avisar('El número tiene el formato ML seguido de 8 caracteres (0-9, A-F)', 'bad'))
    codigo = c; recepcion.codigo = c
    buscando = true; error = ''
    try { rv = await api.get<ReservacionStaff>(`/staff/reservaciones/buscar/${c}`) } catch (e) { rv = null; error = (e as Error).message } finally { buscando = false }
  }

  async function cargarPorCobrar() {
    try { porCobrar = await api.get<PedidoBarra[]>('/staff/pedidos/por-cobrar'); errorCobrar = '' } catch (e) { errorCobrar = (e as Error).message }
  }

  async function cobrar(p: PedidoBarra) {
    try {
      await api.post(`/staff/pedidos/${p.id}/cobrar-saldo`, { metodo: metodos[p.id] ?? 'EFECTIVO' })
      dispatch(avisar('Cobrado: el pedido pasó a barra', 'ok'))
      cargarPorCobrar()
      if (rv?.codigo === p.reservacion.codigo) buscar(p.reservacion.codigo)
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) }
  }

  // solo al abrir la pestaña (untrack: buscar() actualiza estado que este efecto no debe vigilar)
  $effect(() => untrack(() => {
    cargarPorCobrar()
    if (recepcion.codigo) buscar(recepcion.codigo) // viene de la agenda
  }))
</script>

<div class="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
  <div class="stack">
    <div class="card">
      <form class="row" onsubmit={(e) => { e.preventDefault(); buscar() }}>
        <input class="min-w-[200px] flex-1 uppercase" placeholder="Número de reservación (ML…)" maxlength="10" autocomplete="off" required bind:value={codigo} aria-label="Número de reservación" />
        <button class="btn primary" type="submit">Buscar</button>
        <button class="btn" type="button" onclick={() => (mostrador = true)} disabled={!$cat}>+ Cliente sin registro</button>
      </form>
    </div>
    {#if buscando}
      <div class="card empty"><span class="spinner"></span></div>
    {:else if error}
      <div class="card empty err">{error}</div>
    {:else if rv}
      {#key rv}<DetalleReservacion {rv} cat={$cat} oncambio={() => { buscar(rv!.codigo); cargarPorCobrar() }} />{/key}
    {/if}
  </div>

  <aside class="card">
    <div class="row between"><h3 class="m-0">Pedidos anticipados por cobrar</h3><button class="btn sm ghost" type="button" aria-label="Actualizar" onclick={cargarPorCobrar}>↻</button></div>
    <p class="muted small mt-2">El cliente pagó el anticipo en línea; cobra el resto al llegar.</p>
    {#if errorCobrar}<p class="err">{errorCobrar}</p>
    {:else if porCobrar && !porCobrar.length}<p class="muted small">Nada pendiente.</p>
    {:else if porCobrar}
      {#each porCobrar as p (p.id)}
        {@const dentro = p.reservacion.estado === 'EN_CURSO'}
        <div class="border-b border-line py-2.5">
          <div class="row between">
            <a href="#detalle" onclick={(e) => { e.preventDefault(); buscar(p.reservacion.codigo) }}>{p.reservacion.codigo}</a>
            <span class="small muted">Sala {p.reservacion.sala.numero}</span>
            {#if p.reservacion.estado}<Badge estado={p.reservacion.estado} />{/if}
          </div>
          <p class="small my-1.5">{p.items.map(lineaItem).join(', ')}</p>
          <div class="row">
            <MetodoPago clase="w-auto" bind:valor={() => metodos[p.id] ?? 'EFECTIVO', (v) => (metodos[p.id] = v)} />
            <button class="btn sm primary" type="button" disabled={!dentro} title={dentro ? '' : 'Haz el check-in primero'} onclick={() => cobrar(p)}>
              {num(p.restante) > 0 ? `Cobrar ${money(p.restante)}` : 'Enviar a barra'}
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </aside>
</div>

{#if $cat}<Mostrador bind:abierto={mostrador} cat={$cat} oncreada={(c) => buscar(c)} />{/if}
