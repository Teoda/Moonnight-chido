<!-- Barra: pedidos en vivo (cada 15 s). Los nuevos se resaltan y suenan; a los 15 min de espera se marcan en rojo. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { PedidoBarra } from '#lib/api/types.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { esCortesia } from '#lib/utils/carta.ts'
  import { falta } from '#lib/utils/formato.ts'
  import { ahora, cambio, revelar } from '#lib/fx/efectos.ts'
  import { ding } from '#lib/fx/sonido.ts'
  import Badge from '#lib/components/Badge.svelte'
  import { confirmar } from '#lib/components/confirmar.svelte.ts'
  import { alternarSonido, cadaQuince, panel } from '#lib/components/staff/panel.svelte.ts'

  let pedidos = $state<PedidoBarra[] | null>(null), error = $state('')
  let vistos: Set<number> | null = null
  let nuevos = $state<number[]>([])

  async function cargar(forzar = false) {
    let ps: PedidoBarra[]
    try { ps = await api.get<PedidoBarra[]>('/staff/pedidos') } catch (e) { if (forzar) error = (e as Error).message; return }
    error = ''
    if (!cambio('barra', ps) && !forzar) return
    // pedidos que no estaban en la consulta anterior → resaltar y avisar
    const recien = vistos && !forzar ? ps.filter((p) => !vistos!.has(p.id)) : []
    vistos = new Set(ps.map((p) => p.id))
    nuevos = recien.map((p) => p.id)
    if (recien.length) {
      if (panel.sonido) ding()
      dispatch(avisar(recien.length === 1 ? `Nuevo pedido · sala ${recien[0].reservacion.sala.numero}` : `${recien.length} pedidos nuevos`, 'ok'))
    }
    pedidos = ps
  }

  async function cambiar(p: PedidoBarra, estado: 'PREPARANDO' | 'ENTREGADO' | 'CANCELADO') {
    if (estado === 'CANCELADO' && !(await confirmar('Cancelar pedido', `¿Cancelar el pedido de la sala ${p.reservacion.sala.numero}?`, { ok: 'Cancelar pedido', peligro: true }))) return
    try {
      await api.patch(`/staff/pedidos/${p.id}`, { estado })
      dispatch(avisar(estado === 'ENTREGADO' ? `Sala ${p.reservacion.sala.numero}: entregado` : 'Pedido actualizado', 'ok'))
      cargar(true)
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) }
  }

  $effect(() => { cargar(true); return cadaQuince(() => cargar()) })
</script>

<figure class="banner-foto bajo"><img src="/img/lugar/bar.jpg" alt="Bar de Moonlight" width="1200" height="675" loading="lazy" /></figure>
<div class="row between">
  <h2>Pedidos en barra</h2>
  <div class="row">
    <span class="vivo ok">En vivo</span>
    <button class="btn sm" type="button" aria-pressed={panel.sonido} onclick={() => { alternarSonido(); if (panel.sonido) ding() }}>{panel.sonido ? '🔔 Sonido' : '🔕 Silencio'}</button>
  </div>
</div>

{#if error}<div class="card empty err">{error}</div>
{:else if !pedidos}<div class="grid-3"><div class="skeleton bajo"></div><div class="skeleton bajo"></div></div>
{:else if !pedidos.length}<div class="card empty">Sin pedidos pendientes. 🎤</div>
{:else}
  <div class="grid-3">
    {#each pedidos as p, i (p.id)}
      {@const min = ($ahora - new Date(p.creadoEn).getTime()) / 6e4}
      <article class="card order {p.estado}" class:nuevo={nuevos.includes(p.id)} class:tarde={min >= 15} use:revelar={i}>
        <div class="row between"><h3 class="m-0">Sala {p.reservacion.sala.numero}</h3><Badge estado={p.estado} /></div>
        <div class="small muted">{p.reservacion.codigo} · {p.origen.replace('_', ' ').toLowerCase()}</div>
        <div><span class="vivo {min >= 15 ? 'bad' : 'accent'}">Esperando {falta($ahora - new Date(p.creadoEn).getTime())}</span></div>
        <ul>
          {#each p.items as it, j (j)}
            <li><b>{it.cantidad}× </b>{it.producto.nombre}{#if esCortesia(it)}<span class="badge ok ml-1.5">Cortesía</span>{/if}</li>
          {/each}
        </ul>
        <div class="row">
          {#if p.estado === 'NUEVO'}<button class="btn sm" type="button" onclick={() => cambiar(p, 'PREPARANDO')}>Preparar</button>{/if}
          <button class="btn sm ok" type="button" onclick={() => cambiar(p, 'ENTREGADO')}>Entregado</button>
          <button class="btn sm danger" type="button" onclick={() => cambiar(p, 'CANCELADO')}>Cancelar</button>
        </div>
      </article>
    {/each}
  </div>
{/if}
