<!-- Nuestras salas: listado con foto, precio y estado; "Reservar" lleva al asistente con ese tamaño. -->
<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { api } from '#lib/api/client.ts'
  import type { SalaPublica } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { acciones } from '#lib/store/reserva.ts'
  import { conCortesia } from '#lib/utils/carta.ts'
  import { money } from '#lib/utils/formato.ts'
  import { inclinar, revelar } from '#lib/fx/efectos.ts'

  const cat = seleccionar((s) => s.catalogo.datos)
  let salas = $state<SalaPublica[] | null>(null)
  let error = $state('')
  let tipo = $state(page.url.searchParams.get('tipo') ?? '')

  $effect(() => {
    api.get<SalaPublica[]>('/publico/salas').then((l) => (salas = l), (e) => (error = e.message))
  })

  const lista = $derived((salas ?? []).filter((s) => !tipo || s.tipo === tipo))

  function reservar(s: SalaPublica) {
    const t = $cat?.tipos.find((x) => x.id === s.tipoSalaId)
    if (t) dispatch(acciones.elegirTipo({ id: t.id, capacidadMax: t.capacidadMax }))
    goto('/reservar?buscar=1')
  }
</script>

<svelte:head><title>Salas · Moonlight</title></svelte:head>

<div class="row between">
  <h2>Nuestras salas</h2>
  <select class="w-auto" bind:value={tipo} aria-label="Filtrar por tamaño">
    <option value="">Todos los tamaños</option>
    {#each $cat?.tipos ?? [] as t (t.id)}<option value={t.nombre}>{t.nombre} ({t.capacidadMin}–{t.capacidadMax} personas)</option>{/each}
  </select>
</div>
{#if $cat}
  <p class="muted">{$cat.tipos.map((t) => `${t.nombre}: ${t.capacidadMin}–${t.capacidadMax} personas, ${money(t.precioHora)}/h`).join(' · ')}</p>
{/if}

{#if error}
  <div class="empty err">{error}</div>
{:else if !salas}
  <div class="grid-3">{#each Array(6) as _, i (i)}<div class="skeleton"></div>{/each}</div>
{:else if !lista.length}
  <div class="empty">No hay salas con esos filtros.</div>
{:else}
  <div class="grid-3">
    {#each lista as s, i (s.numero)}
      <article class="card sala" use:revelar={i} use:inclinar>
        {#if s.fotoUrl}
          <div class="thumb foto"><img src={s.fotoUrl} alt="Sala {s.numero}, {s.tipo}" loading="lazy" /><span>#{s.numero}</span></div>
        {:else}
          <div class="thumb">#{s.numero}</div>
        {/if}
        <div class="row between"><h3 class="m-0">Sala {s.numero}</h3><span class="badge accent">{s.tipo}</span></div>
        <p class="muted small">{s.descripcion || 'Se ambienta con el género musical que elijas al reservar.'}</p>
        {#if conCortesia($cat, s.tipoSalaId)}<p class="cortesia-tag">🍾 Incluye botella de cortesía</p>{/if}
        <div class="row between">
          <div><div class="price">{money(s.precioHora)}<small> /hora</small></div><div class="muted small">{s.capacidad} personas</div></div>
          {#if s.disponibleParaReservar}
            <button class="btn sm primary" type="button" onclick={() => reservar(s)}>Reservar</button>
          {:else if s.estado === 'LIMPIEZA'}
            <span class="badge warn">En limpieza</span>
          {:else}
            <span class="badge bad">En mantenimiento</span>
          {/if}
        </div>
      </article>
    {/each}
  </div>
{/if}
