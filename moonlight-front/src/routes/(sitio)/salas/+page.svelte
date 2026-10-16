<!-- Nuestras salas: tres tarjetas, una por tamaño (agrupadas por tipoSalaId del API), y un panel para explorar
     las salas registradas de cada tamaño con su estado. "Reservar" lleva al asistente con ese tamaño elegido:
     el cliente no escoge número de sala, el sistema asigna una libre según la disponibilidad. -->
<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { api } from '#lib/api/client.ts'
  import type { SalaPublica, TipoSala } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { acciones } from '#lib/store/reserva.ts'
  import { cargarCatalogo } from '#lib/store/catalogo.ts'
  import { conCortesia } from '#lib/utils/carta.ts'
  import TarjetaTipoSala from '#lib/components/sitio/salas/TarjetaTipoSala.svelte'
  import PanelSalas from '#lib/components/sitio/salas/PanelSalas.svelte'

  const cat = seleccionar((s) => s.catalogo.datos)
  const estadoCat = seleccionar((s) => s.catalogo.estado)
  let salas = $state<SalaPublica[] | null>(null)
  let error = $state('')

  function cargarSalas() {
    error = ''
    api.get<SalaPublica[]>('/publico/salas').then((l) => (salas = l), (e) => (error = e.message))
  }
  $effect(() => cargarSalas())

  // tamaños con al menos una sala registrada, en el orden del catálogo
  const tipos = $derived(($cat?.tipos ?? []).filter((t) => salas?.some((s) => s.tipoSalaId === t.id)))
  const totalDe = (t: TipoSala) => salas?.filter((s) => s.tipoSalaId === t.id).length ?? 0
  const cortesia = (tipoId: number) => conCortesia($cat, tipoId)

  // mismo comportamiento de siempre: elige el tamaño en el asistente y busca horarios
  function reservar(t: TipoSala) {
    dispatch(acciones.elegirTipo({ id: t.id, capacidadMax: t.capacidadMax }))
    goto('/reservar?buscar=1')
  }

  // panel abierto = estado del historial: el botón "atrás" lo cierra y no se sale de la página
  const abierto = $derived(page.state.tipoSala)
  const explorar = (id: number) => goto('', { state: { tipoSala: id }, shallow: true })
  const cambiar = (id: number) => goto('', { state: { tipoSala: id }, shallow: true, replace: true })
  const cerrar = () => history.back()

  // compatibilidad: /salas?tipo=Mediana (enlace del inicio) abre directamente el panel de ese tamaño
  let desdeUrl = false
  $effect(() => {
    const nombre = page.url.searchParams.get('tipo')
    if (desdeUrl || !nombre || !tipos.length) return
    desdeUrl = true
    const t = tipos.find((x) => x.nombre === nombre)
    if (t) explorar(t.id)
  })
</script>

<svelte:head><title>Salas · Moonlight</title></svelte:head>

<header class="encabezado">
  <h1 class="titulo">Nuestras salas</h1>
  <p class="intro">Salas privadas para cantar, celebrar y convivir. Elige el tamaño según tu grupo y, al reservar, ambiéntala con tu género favorito o tu propia lista de artistas.</p>
</header>

{#if error || $estadoCat === 'error'}
  <div class="aviso" role="alert">
    <p class="font-bold">No pudimos cargar las salas.</p>
    <p class="muted">Revisa tu conexión a internet e inténtalo de nuevo.</p>
    <button class="btn" type="button" onclick={() => { cargarSalas(); if (!$cat) dispatch(cargarCatalogo()) }}>Reintentar</button>
  </div>
{:else if !salas || !$cat}
  <div class="tipos" aria-busy="true" aria-label="Cargando salas">{#each Array(3) as _, i (i)}<div class="skeleton"></div>{/each}</div>
{:else if !tipos.length}
  <div class="aviso"><p class="font-bold">Por ahora no hay salas registradas.</p><p class="muted">Vuelve pronto.</p></div>
{:else}
  <div class="tipos">
    {#each tipos as t (t.id)}
      <TarjetaTipoSala tipo={t} total={totalDe(t)} cortesia={cortesia(t.id)} abierto={abierto === t.id} onexplorar={explorar} onreservar={reservar} />
    {/each}
  </div>

  <PanelSalas {tipos} {salas} {abierto} {cortesia} oncambiar={cambiar} oncerrar={cerrar} onreservar={reservar} />
{/if}

<style>
  .encabezado { max-width: 62ch; margin-bottom: 24px; }
  .titulo { margin: 0 0 8px; font-size: clamp(2rem, 1.5rem + 2vw, 2.75rem); letter-spacing: -.03em; line-height: 1.1; }
  .intro { margin: 0; color: var(--muted); font-size: clamp(1rem, .95rem + .25vw, 1.1rem); line-height: 1.6; }

  /* teléfono: 1 columna · tableta: 2 · escritorio: las 3 en una fila */
  .tipos { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
  @media (width >= 40rem) { .tipos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (width >= 64rem) { .tipos { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .tipos .skeleton { min-height: 420px; }

  .aviso { padding: 28px 20px; border: 1px dashed var(--line); border-radius: var(--radius); background: var(--bg-2); text-align: center; }
  .aviso p { margin: 0 0 6px; }
</style>
