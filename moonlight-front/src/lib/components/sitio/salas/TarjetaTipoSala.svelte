<!-- Tarjeta de un tamaño de sala: foto, nombre, capacidad, precio, cuántas salas hay registradas y la cortesía.
     "Explorar salas" abre el panel con sus salas; "Reservar" lleva al asistente con ese tamaño elegido
     (el sistema asigna la sala libre según la disponibilidad). -->
<script lang="ts">
  import type { TipoSala } from '#lib/api/types.ts'
  import { PRESENTACION_TIPO_SALA } from '#lib/utils/carta.ts'
  import { money } from '#lib/utils/formato.ts'

  let { tipo, total, cortesia = false, abierto = false, onexplorar, onreservar }: {
    tipo: TipoSala; total: number; cortesia?: boolean; abierto?: boolean
    onexplorar: (id: number) => void; onreservar: (t: TipoSala) => void
  } = $props()

  const p = $derived(PRESENTACION_TIPO_SALA[tipo.codigo])
</script>

<article class="tipo" class:abierto>
  <div class="foto">
    {#if p}
      <img src={p.foto.src} alt={p.foto.alt} width={p.foto.ancho} height={p.foto.alto} loading="lazy" decoding="async" />
    {:else}
      <span class="sin-foto"><img class="logo-img" src="/img/isotipo.jpg" alt="" width="56" height="56" /></span>
    {/if}
  </div>

  <div class="cuerpo">
    <h2 class="nombre">Sala {tipo.nombre}</h2>
    {#if p}<p class="frase">{p.frase}</p>{/if}

    <dl class="datos">
      <div><dt>Capacidad</dt><dd>{tipo.capacidadMin}–{tipo.capacidadMax} personas</dd></div>
      <div><dt>Precio</dt><dd class="precio">{money(tipo.precioHora)} <small>/hora</small></dd></div>
      <div><dt>Salas</dt><dd>{total} {total === 1 ? 'sala' : 'salas'}</dd></div>
    </dl>
    {#if cortesia}<p class="cortesia">🍾 Incluye una botella de cortesía a elegir</p>{/if}

    <div class="acciones">
      <button type="button" class="btn" aria-haspopup="dialog" onclick={() => onexplorar(tipo.id)}>Explorar salas</button>
      <button type="button" class="btn primary" onclick={() => onreservar(tipo)}>Reservar</button>
    </div>
  </div>
</article>

<style>
  .tipo {
    display: flex; flex-direction: column; height: 100%; overflow: hidden;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--card);
    transition: border-color var(--transicion, .25s ease);
  }
  .tipo:focus-within { border-color: rgba(180, 92, 255, .6); }
  /* tamaño cuyo panel está abierto */
  .tipo.abierto { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    .tipo:hover { border-color: rgba(255, 255, 255, .22); }
    .tipo:hover .foto img:not(.logo-img) { transform: scale(1.11); }
  }

  /* las imágenes traen su propio marco redondeado: un zoom leve lo deja fuera del recorte */
  .foto { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: #0d0a1c; }
  .foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.08); transition: transform .5s ease; }
  .foto::after { content: ""; position: absolute; inset: auto 0 0; height: 45%; background: linear-gradient(transparent, var(--card)); pointer-events: none; }
  .sin-foto { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(120% 90% at 50% 0%, #2a1a52 0%, var(--card) 70%); }

  .cuerpo { display: flex; flex: 1; flex-direction: column; gap: 10px; padding: 4px 18px 18px; }
  .nombre { margin: 0; font-size: 1.45rem; letter-spacing: -.02em; }
  .frase { margin: 0; color: var(--muted); font-size: .92rem; line-height: 1.5; }
  .datos { display: grid; grid-template-columns: repeat(3, auto); justify-content: start; gap: 4px 22px; margin: 4px 0 0; }
  .datos dt { color: var(--muted); font-size: .75rem; }
  .datos dd { margin: 0; font-weight: 600; white-space: nowrap; }
  .precio { color: var(--gold); font-variant-numeric: tabular-nums; }
  .precio small { color: var(--muted); font-weight: 400; }
  .cortesia { margin: 0; color: var(--gold); font-size: .88rem; }
  .acciones { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto; padding-top: 8px; }
  .acciones .btn { justify-content: center; min-height: 44px; }
  @media (width < 25rem) { .datos { grid-template-columns: repeat(2, auto); } }
</style>
