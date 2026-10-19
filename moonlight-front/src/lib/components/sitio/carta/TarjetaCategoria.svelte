<!-- Tarjeta de una categoría del Menú: foto, nombre, descripción, cuántas opciones hay y desde qué precio.
     Es un botón: abre el panel de la categoría (mouse, teclado o toque). -->
<script lang="ts" module>
  import type { CategoriaCarta } from '#lib/utils/carta.ts'
  import type { Producto } from '#lib/api/types.ts'
  /** Categoría con sus productos ya tomados del catálogo. */
  export interface CategoriaLista extends CategoriaCarta {
    grupos: { seccion: string; titulo: string; productos: Producto[] }[]
    total: number
    desde: number
  }
</script>

<script lang="ts">
  import { money } from '#lib/utils/formato.ts'

  let { categoria, forma = 'normal', onabrir }: {
    categoria: CategoriaLista; forma?: 'normal' | 'grande' | 'ancha'; onabrir: (id: string) => void
  } = $props()
  const f = $derived(categoria.foto)
</script>

<button type="button" class="cat {forma}" aria-haspopup="dialog" onclick={() => onabrir(categoria.id)}>
  <span class="foto">
    {#if f}
      <img src={f.src} alt="" width={f.ancho} height={f.alto} loading="lazy" decoding="async" style:object-position={f.posicion} />
    {:else}
      <span class="sin-foto"><img class="logo-img" src="/img/isotipo.jpg" alt="" width="56" height="56" />Foto próximamente</span>
    {/if}
  </span>
  <span class="pie">
    <span class="texto">
      <span class="nombre">{categoria.nombre}</span>
      <span class="desc">{categoria.descripcion}</span>
      <span class="meta"><span>{categoria.total} {categoria.total === 1 ? 'opción' : 'opciones'}</span><span>desde <b>{money(categoria.desde)}</b></span></span>
    </span>
    <span class="ir" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
    </span>
  </span>
</button>

<style>
  .cat {
    display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; padding: 0; overflow: hidden; cursor: pointer;
    text-align: left; font: inherit; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--card);
    transition: border-color var(--transicion, .25s ease);
  }
  .cat:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    .cat:hover { border-color: rgba(255, 255, 255, .22); }
    .cat:hover .foto img:not(.logo-img) { transform: scale(1.03); }
    .cat:hover .ir { background: var(--accent); border-color: var(--accent); color: #fff; }
  }

  /* foto: proporción fija en las tarjetas normales; la grande (Botellas) llena el alto de dos filas */
  .foto { position: relative; display: block; aspect-ratio: 4 / 3; overflow: hidden; background: var(--card); }
  .grande .foto { flex: 1; aspect-ratio: auto; min-height: 220px; }
  .ancha .foto { aspect-ratio: 16 / 9; }
  @media (width >= 40rem) { .ancha .foto { aspect-ratio: 16 / 7; } }
  @media (width >= 64rem) { .ancha .foto { aspect-ratio: 16 / 5; } }
  .foto > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
  /* degradado inferior: une la foto con el pie de la tarjeta */
  .foto::after { content: ""; position: absolute; inset: auto 0 0; height: 40%; background: linear-gradient(transparent, var(--card)); pointer-events: none; }
  .sin-foto {
    position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 6px;
    background: radial-gradient(120% 90% at 50% 0%, #2a1a52 0%, var(--card) 70%); color: var(--muted); font-size: .8rem;
  }

  .pie { display: flex; align-items: center; gap: 12px; padding: 12px 14px 14px; }
  .texto { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .nombre { font-size: 1.08rem; font-weight: 700; line-height: 1.25; }
  .grande .nombre { font-size: 1.4rem; }
  .desc { color: var(--muted); font-size: .86rem; line-height: 1.4; }
  .meta { display: flex; flex-wrap: wrap; gap: 0 12px; margin-top: 2px; color: var(--color-lila); font-size: .8rem; }
  .meta b { color: var(--gold); font-weight: 700; font-variant-numeric: tabular-nums; }
  .ir {
    display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 50%;
    border: 1px solid rgba(180, 92, 255, .5); color: var(--color-lila); transition: background .2s, border-color .2s, color .2s;
  }
  .ir svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  /* teléfono: tarjetas normales compactas en 2 columnas (sin descripción) */
  @media (width < 40rem) {
    .normal .desc { display: none; }
    .normal .pie { padding: 10px 10px 12px; gap: 6px; }
    .normal .nombre { font-size: .98rem; }
    .normal .ir { width: 30px; height: 30px; }
  }
</style>
