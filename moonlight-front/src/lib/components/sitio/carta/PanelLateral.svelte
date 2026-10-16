<!-- Base de los paneles del Menú (categorías y paquetes), sobre <dialog> nativo: foco atrapado, Esc, fondo inerte.
     Lateral derecho en tableta/escritorio y a pantalla completa en teléfono, con animación de entrada y salida.
     Quién lo abre o lo cierra lo decide la página: `item` (null = cerrado). El último item se conserva mientras
     dura la animación de salida, por eso el contenido se dibuja con los snippets que lo reciben. -->
<script lang="ts" generics="T extends { id: string | number }">
  import type { Snippet } from 'svelte'
  import { tick } from 'svelte'
  import { calma } from '#lib/fx/efectos.ts'

  let { item, etiquetaCerrar, idTitulo, oncerrar, oncambio, barra, children, pie }: {
    item: T | null
    etiquetaCerrar: (t: T) => string
    idTitulo: string
    oncerrar: () => void
    /** se llama al pasar de un item a otro sin cerrar (p. ej. para reiniciar pestañas) */
    oncambio?: (t: T) => void
    barra?: Snippet<[T]>
    children: Snippet<[T]>
    pie?: Snippet<[T]>
  } = $props()

  let dlg = $state<HTMLDialogElement>()
  let botonCerrar = $state<HTMLButtonElement>()
  let cuerpo = $state<HTMLDivElement>()
  let saliendo = $state(false)
  // raw: guarda la misma referencia (sin proxy) para que asignar el item actual no cuente como cambio
  // y el efecto de abajo no se repita sin fin
  let mostrado = $state.raw<T | null>(null)

  $effect(() => {
    if (!dlg) return
    if (item) {
      if (mostrado && mostrado.id !== item.id) { cuerpo?.scrollTo({ top: 0 }); oncambio?.(item) }
      mostrado = item
      if (!dlg.open) {
        saliendo = false
        dlg.showModal()
        bloquearFondo(true)
        tick().then(() => botonCerrar?.focus()) // tras dibujar el contenido
      }
    } else if (dlg.open && !saliendo) salir()
  })

  // si la página se desmonta con el panel abierto (p. ej. al ir a Reservar), el fondo vuelve a desplazarse
  $effect(() => () => bloquearFondo(false))

  function bloquearFondo(si: boolean) {
    const html = document.documentElement
    html.style.overflow = si ? 'hidden' : ''
    html.style.scrollbarGutter = si ? 'stable' : '' // sin salto lateral al ocultar la barra de desplazamiento
  }

  function salir() {
    if (!dlg) return
    if (calma) return terminar()
    saliendo = true
    const fin = (e?: AnimationEvent) => {
      if (e && e.target !== dlg) return
      dlg?.removeEventListener('animationend', fin)
      clearTimeout(t)
      terminar()
    }
    dlg.addEventListener('animationend', fin)
    const t = setTimeout(fin, 400)
  }
  function terminar() {
    saliendo = false
    dlg?.close() // el navegador devuelve el foco a la tarjeta que lo abrió
    bloquearFondo(false)
    mostrado = null
  }
</script>

<dialog bind:this={dlg} class="panel-lateral" class:saliendo aria-labelledby={idTitulo}
  oncancel={(e) => { e.preventDefault(); oncerrar() }}
  onclick={(e) => { if (e.target === dlg) oncerrar() }}>
  {#if mostrado}
    <div class="barra">
      <div class="barra-extra">{@render barra?.(mostrado)}</div>
      <button bind:this={botonCerrar} type="button" class="cerrar" aria-label={etiquetaCerrar(mostrado)} onclick={oncerrar}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
    <div class="cuerpo" bind:this={cuerpo}>{@render children(mostrado)}</div>
    {#if pie}<div class="pie">{@render pie(mostrado)}</div>{/if}
  {/if}
</dialog>

<style>
  .panel-lateral {
    position: fixed; inset: 0 0 0 auto; width: min(580px, 100vw); height: 100dvh; max-width: 100vw; max-height: 100dvh;
    margin: 0; padding: 0; border: 0; border-left: 1px solid var(--line); overflow: hidden;
    background: var(--bg-2); color: var(--text); box-shadow: -24px 0 60px rgba(5, 4, 15, .6);
  }
  .panel-lateral[open] { display: flex; flex-direction: column; animation: entra-lado .3s cubic-bezier(.2, .8, .2, 1); }
  .panel-lateral.saliendo { animation: sale-lado .22s ease-in forwards; }
  .panel-lateral::backdrop { background: rgba(5, 4, 15, .65); backdrop-filter: blur(3px); animation: velo .3s ease; }
  .panel-lateral.saliendo::backdrop { animation: velo .22s ease-in reverse forwards; }
  @media (width < 40rem) {
    .panel-lateral { width: 100vw; border-left: 0; }
    .panel-lateral[open] { animation-name: entra-abajo; }
    .panel-lateral.saliendo { animation-name: sale-abajo; }
  }
  @keyframes entra-lado { from { transform: translateX(100%); } }
  @keyframes sale-lado { to { transform: translateX(100%); } }
  @keyframes entra-abajo { from { transform: translateY(100%); } }
  @keyframes sale-abajo { to { transform: translateY(100%); } }
  @keyframes velo { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .panel-lateral[open], .panel-lateral.saliendo, .panel-lateral::backdrop { animation: none; }
  }

  .barra { display: flex; align-items: center; gap: 8px; min-height: 65px; padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--line); background: var(--bg-2); }
  .barra-extra { flex: 1; min-width: 0; }
  .cerrar {
    display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 50%;
    border: 1px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; transition: border-color .2s, background .2s;
  }
  .cerrar:hover { border-color: var(--accent); background: var(--card-2); }
  .cerrar svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
  .cerrar:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

  .cuerpo { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
  .pie {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 14px;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--bg-2);
  }

  /* ── piezas de contenido comunes a los paneles (portada, título, lista de productos, notas) ── */
  .panel-lateral :global(.portada) { position: relative; margin: 0; aspect-ratio: 16 / 9; overflow: hidden; background: #0d0a1c; }
  .panel-lateral :global(.portada img) { width: 100%; height: 100%; object-fit: cover; }
  .panel-lateral :global(.portada::after) {
    content: ""; position: absolute; inset: auto 0 0; height: 35%; background: linear-gradient(transparent, var(--bg-2)); pointer-events: none;
  }
  .panel-lateral :global(.contenido) { padding: 14px 20px 24px; }
  .panel-lateral :global(.titulo) { margin: 0; font-size: clamp(1.6rem, 1.3rem + 1.2vw, 2rem); letter-spacing: -.02em; }
  .panel-lateral :global(.desc) { margin: 4px 0 16px; color: var(--muted); }
  .panel-lateral :global(.productos) { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .panel-lateral :global(.producto) {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    border: 1px solid var(--line); border-radius: 12px; background: rgba(21, 15, 42, .6);
  }
  .panel-lateral :global(.precio) { flex: none; color: var(--gold); font-weight: 700; font-variant-numeric: tabular-nums; }
  .panel-lateral :global(.nota) { margin: 14px 0 0; color: var(--muted); font-size: .82rem; }
  .panel-lateral :global(.pie-texto) { margin: 0; color: var(--muted); font-size: .84rem; }
</style>
