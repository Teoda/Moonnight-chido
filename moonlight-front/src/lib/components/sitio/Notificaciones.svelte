<!-- Campanita con indicador de no leídas y menú desplegable con las últimas notificaciones. -->
<script lang="ts">
  import { scale } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { seleccionar } from '#lib/store/index.ts'
  import { armar, esLeida, marcarLeidas } from '#lib/notificaciones.svelte.ts'

  const lista = seleccionar((s) => s.mis.lista)
  const cat = seleccionar((s) => s.catalogo.datos)
  const items = $derived(armar($lista, $cat))
  const pendientes = $derived(items.filter((n) => !esLeida(n.id)).length)

  let abierto = $state(false)
  let raiz: HTMLDivElement
  let boton: HTMLButtonElement

  function cerrar(devolverFoco = false) {
    abierto = false
    if (devolverFoco) boton.focus()
  }
  function fuera(e: PointerEvent) {
    if (abierto && !raiz.contains(e.target as Node)) cerrar()
  }
</script>

<svelte:window onpointerdown={fuera} onkeydown={(e) => { if (abierto && e.key === 'Escape') cerrar(true) }} />

<div class="relative" bind:this={raiz}>
  <button class="icono-btn" class:activo={abierto} type="button" bind:this={boton} onclick={() => (abierto = !abierto)}
    aria-haspopup="true" aria-expanded={abierto} aria-controls="panel-notif"
    aria-label={pendientes ? `Notificaciones: ${pendientes} sin leer` : 'Notificaciones'}>
    <svg class="campana" class:suena={pendientes > 0} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
    {#if pendientes}<span class="notif-punto" aria-hidden="true">{pendientes > 9 ? '9+' : pendientes}</span>{/if}
  </button>

  {#if abierto}
    <div id="panel-notif" class="notif-panel" role="region" aria-label="Notificaciones" transition:scale={{ start: 0.95, duration: 160, easing: cubicOut }}>
      <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p class="m-0 font-bold">Notificaciones</p>
        <button class="btn sm ghost" type="button" disabled={!pendientes} onclick={() => marcarLeidas(items.map((n) => n.id))}>Marcar como leídas</button>
      </div>
      {#if items.length}
        <ul class="m-0 max-h-[min(380px,60dvh)] list-none overflow-y-auto p-1.5">
          {#each items as n (n.id)}
            {@const nueva = !esLeida(n.id)}
            <li>
              <a class="notif-item" class:nueva href={n.href} onclick={() => { marcarLeidas([n.id]); cerrar() }}>
                <span class="notif-ico {n.tono}" aria-hidden="true">{n.icono}</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-[.92rem] leading-snug" class:font-bold={nueva}>{n.titulo}</span>
                  <span class="block text-[.82rem] leading-snug text-muted">{n.texto}</span>
                </span>
                {#if nueva}<span class="mt-1.5 size-2 flex-none rounded-full bg-accent-2" aria-label="sin leer"></span>{/if}
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty m-0">No tienes notificaciones.</p>
      {/if}
    </div>
  {/if}
</div>
