<!-- Tarjeta de un paquete: foto, sala, sin alcohol / con botella (+18), nombre, resumen de lo que incluye y precio.
     Es un botón: abre el panel de detalles. `abierto` resalta la tarjeta mientras su panel está visible. -->
<script lang="ts">
  import type { Producto } from '#lib/api/types.ts'
  import { FOTOS_PAQUETE, lineasPaquete } from '#lib/utils/carta.ts'
  import { money } from '#lib/utils/formato.ts'

  let { paquete, sala, abierto = false, onabrir }: {
    paquete: Producto; sala: string; abierto?: boolean; onabrir: (id: number) => void
  } = $props()

  const foto = $derived(FOTOS_PAQUETE[paquete.nombre])
  const incluye = $derived(lineasPaquete(paquete))
  const MOSTRAR = 3
</script>

<button type="button" class="paq" class:abierto class:botella={paquete.alcohol} aria-haspopup="dialog"
  aria-label="{paquete.nombre}, Sala {sala}, {money(paquete.precio)}. Ver detalles" onclick={() => onabrir(paquete.id)}>
  <span class="foto">
    {#if foto}
      <img src={foto.src} alt="" width={foto.ancho} height={foto.alto} loading="lazy" decoding="async" />
    {:else}
      <span class="sin-foto"><img class="logo-img" src="/img/isotipo.jpg" alt="" width="48" height="48" /></span>
    {/if}
  </span>

  <span class="cuerpo">
    <span class="etiquetas">
      <span class="badge accent">Sala {sala}</span>
      {#if paquete.alcohol}
        <span class="badge warn">Con botella</span><span class="badge mas18">+18</span>
      {:else}
        <span class="badge ok">Sin alcohol</span>
      {/if}
    </span>
    <span class="nombre">{paquete.nombre}</span>
    <span class="resumen">
      {incluye.slice(0, MOSTRAR).join(' · ')}{#if incluye.length > MOSTRAR}{' '}<span class="mas">y {incluye.length - MOSTRAR} más</span>{/if}
    </span>
    <span class="pie">
      <span class="precio">{money(paquete.precio)}</span>
      <span class="ver">Ver detalles<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></span>
    </span>
  </span>
</button>

<style>
  .paq {
    display: flex; flex-direction: column; width: 100%; height: 100%; padding: 0; overflow: hidden; cursor: pointer;
    text-align: left; font: inherit; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg-2);
    transition: border-color .25s, box-shadow .25s, transform .25s cubic-bezier(.2, .8, .2, 1);
  }
  .paq.botella { border-color: rgba(255, 194, 61, .3); }
  .paq:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
  /* paquete cuyo panel está abierto */
  .paq.abierto { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold), 0 16px 40px -18px rgba(255, 194, 61, .45); }
  @media (hover: hover) {
    .paq:hover { border-color: rgba(180, 92, 255, .75); box-shadow: 0 18px 40px -20px rgba(124, 58, 237, .75); transform: translateY(-3px); }
    .paq:hover .foto img:not(.logo-img) { transform: scale(1.12); }
    .paq:hover .ver { color: #fff; }
    .paq:hover .ver svg { transform: translateX(3px); }
  }

  /* las imágenes traen su propio marco redondeado: un zoom leve lo deja fuera del recorte */
  .foto { position: relative; display: block; aspect-ratio: 900 / 366; overflow: hidden; background: #0d0a1c; }
  .foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.07); transition: transform .6s cubic-bezier(.2, .8, .2, 1); }
  .foto::after { content: ""; position: absolute; inset: auto 0 0; height: 45%; background: linear-gradient(transparent, var(--bg-2)); pointer-events: none; }
  .sin-foto { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(120% 90% at 50% 0%, #2a1a52 0%, var(--card) 70%); }

  .cuerpo { display: flex; flex: 1; flex-direction: column; gap: 8px; padding: 4px 16px 16px; }
  .etiquetas { display: flex; flex-wrap: wrap; gap: 6px; }
  .nombre { font-size: 1.2rem; font-weight: 700; letter-spacing: -.01em; line-height: 1.25; }
  .resumen { color: var(--muted); font-size: .88rem; line-height: 1.5; }
  .mas { color: var(--color-lila); }
  .pie { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--line); }
  .precio { color: var(--gold); font-size: 1.35rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .ver { display: inline-flex; align-items: center; gap: 4px; color: var(--color-lila); font-size: .9rem; font-weight: 600; transition: color .2s; }
  .ver svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform .2s; }
</style>
