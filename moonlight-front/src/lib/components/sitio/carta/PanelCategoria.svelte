<!-- Panel de una categoría del Menú (sobre PanelLateral: dialog, animación, foco, Esc, fondo inerte).
     Botellas: pestañas por tipo (Tequila, Vodka…). Arriba, accesos a las demás categorías sin cerrar. -->
<script lang="ts">
  import type { CategoriaLista } from './TarjetaCategoria.svelte'
  import PanelLateral from './PanelLateral.svelte'
  import { FOTOS_CARTA, FOTOS_PRODUCTO, nombreBotella } from '#lib/utils/carta.ts'
  import { lineas, money } from '#lib/utils/formato.ts'

  let { categorias, abierta, oncambiar, oncerrar }: {
    categorias: CategoriaLista[]; abierta: string | undefined
    oncambiar: (id: string) => void; oncerrar: () => void
  } = $props()

  const actual = $derived(categorias.find((c) => c.id === abierta) ?? null)
  let pestana = $state(0)

  // ── pestañas (Botellas): flechas, Inicio y Fin mueven la selección ──
  let tabs: HTMLButtonElement[] = $state([])
  function teclaPestana(e: KeyboardEvent, i: number, n: number) {
    const destino = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key]
    if (destino === undefined) return
    e.preventDefault()
    pestana = destino
    tabs[destino]?.focus()
  }

  const gruposDe = (c: CategoriaLista) => (c.pestanas ? [c.grupos[pestana]].filter(Boolean) : c.grupos)
  // foto de cabecera: la del tipo de botella elegido, o la de la categoría
  const fotoDe = (c: CategoriaLista) => (c.pestanas ? FOTOS_CARTA[gruposDe(c)[0]?.seccion] : c.foto)
</script>

<PanelLateral item={actual} idTitulo="panel-carta-titulo" etiquetaCerrar={(c) => `Cerrar ${c.nombre}`} {oncerrar} oncambio={() => (pestana = 0)}>
  {#snippet barra(m)}
    <nav class="atajos" aria-label="Categorías de la carta">
      {#each categorias as c (c.id)}
        <button type="button" class="atajo" aria-current={c.id === m.id ? 'true' : undefined} onclick={() => oncambiar(c.id)}>{c.nombre}</button>
      {/each}
    </nav>
  {/snippet}

  {#snippet children(m)}
    {@const grupos = gruposDe(m)}
    {@const foto = fotoDe(m)}
    <figure class="portada" class:completa={foto?.completa}>
      {#if foto}
        <img src={foto.src} alt={foto.alt} width={foto.ancho} height={foto.alto} decoding="async" style:object-position={foto.posicion} />
      {:else}
        <span class="sin-foto"><img class="logo-img" src="/img/isotipo.jpg" alt="" width="64" height="64" />Foto próximamente</span>
      {/if}
    </figure>

    <div class="contenido">
      <h2 id="panel-carta-titulo" class="titulo">{m.nombre}</h2>
      <p class="desc">{m.descripcion}</p>

      {#if m.pestanas}
        <div class="pestanas" role="tablist" aria-label="Tipo de botella">
          {#each m.grupos as g, i (g.seccion)}
            <button bind:this={tabs[i]} type="button" role="tab" id="tab-{i}" aria-controls="lista-carta"
              aria-selected={i === pestana} tabindex={i === pestana ? 0 : -1}
              onclick={() => (pestana = i)} onkeydown={(e) => teclaPestana(e, i, m.grupos.length)}>{g.titulo}</button>
          {/each}
        </div>
      {/if}

      <div id="lista-carta" role={m.pestanas ? 'tabpanel' : undefined} aria-labelledby={m.pestanas ? `tab-${pestana}` : undefined}>
        {#each grupos as g (g.seccion)}
          {#if !m.pestanas && grupos.length > 1}<h3 class="subtitulo-lista">{g.titulo}</h3>{/if}
          <ul class="productos">
            {#each g.productos as p (p.id)}
              {@const miniatura = FOTOS_PRODUCTO[p.nombre]}
              <li class="producto">
                {#if miniatura}
                  <img class="miniatura" src={miniatura.src} alt={miniatura.alt} width="64" height="64" loading="lazy" decoding="async" />
                {/if}
                <div class="info">
                  <span class="nombre">{nombreBotella(p.nombre)}{#if p.alcohol}<span class="badge mas18" title="Venta solo a mayores de edad">+18</span>{/if}</span>
                  {#if p.descripcion}<span class="detalle">{lineas(p.descripcion).join(' · ')}</span>{/if}
                </div>
                <span class="precio">{money(p.precio)}</span>
              </li>
            {/each}
          </ul>
        {/each}
      </div>

      {#if m.id === 'botellas'}
        <p class="nota">Botellas de 700–750 ml aprox. según marca. Pregunta en barra si hielo, vasos y mezcladores se cobran por separado.</p>
      {/if}
      {#if grupos.some((g) => g.productos.some((p) => p.alcohol))}
        <p class="nota"><b class="text-bad">+18</b> Venta de bebidas alcohólicas exclusivamente a mayores de edad. Se solicitará identificación oficial.</p>
      {/if}
    </div>
  {/snippet}

  {#snippet pie()}
    <p class="pie-texto">Pide al reservar o desde tu sala durante la visita.</p>
    <a class="btn primary" href="/reservar">Reservar y pedir</a>
  {/snippet}
</PanelLateral>

<style>
  .atajos { display: flex; gap: 6px; min-width: 0; overflow-x: auto; scrollbar-width: none; padding: 2px; }
  .atajos::-webkit-scrollbar { display: none; }
  .atajo {
    flex: none; padding: 7px 12px; border: 1px solid var(--line); border-radius: 999px; background: transparent;
    color: var(--muted); font: inherit; font-size: .84rem; white-space: nowrap; cursor: pointer; transition: color .2s, border-color .2s, background .2s;
  }
  .atajo:hover { color: var(--text); border-color: rgba(180, 92, 255, .6); }
  .atajo[aria-current='true'] { color: #fff; background: var(--accent); border-color: var(--accent); }
  .atajo:focus-visible, .pestanas button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

  .portada.completa img { object-fit: contain; } /* botellas: completas, sin recortar */
  .sin-foto { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; color: var(--muted); font-size: .85rem;
    background: radial-gradient(120% 90% at 50% 0%, #2a1a52 0%, var(--card) 70%); }

  .pestanas { display: flex; gap: 6px; margin-bottom: 14px; padding-bottom: 2px; overflow-x: auto; scrollbar-width: none; }
  .pestanas button {
    flex: none; padding: 8px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--card);
    color: var(--muted); font: inherit; font-weight: 600; cursor: pointer; transition: color .2s, border-color .2s, background .2s;
  }
  .pestanas button:hover { color: var(--text); }
  .pestanas button[aria-selected='true'] { color: var(--gold); border-color: rgba(255, 194, 61, .7); background: rgba(255, 194, 61, .08); }

  .subtitulo-lista { margin: 18px 0 6px; color: var(--color-lila); font-size: .95rem; }
  .miniatura { width: 64px; height: 64px; flex: none; border-radius: 10px; object-fit: cover; }
  .info { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .nombre { font-weight: 600; line-height: 1.35; }
  .nombre .badge { margin-left: 6px; }
  .detalle { color: var(--muted); font-size: .84rem; line-height: 1.45; }
</style>
