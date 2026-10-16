<!-- Avisos (toasts) guardados en Redux: ui.avisos.
     Las ventanas (<dialog>.showModal) se dibujan en la "capa superior" del navegador, encima de cualquier z-index.
     Por eso el contenedor es un popover (también capa superior) que se vuelve a mostrar —y así queda al frente—
     cada vez que llega un aviso o se abre una ventana. Sin soporte de popover se comporta como antes. -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'

  const avisos = seleccionar((s) => s.ui.avisos)
  let caja = $state<HTMLDivElement>()

  function alFrente() {
    if (!caja || !('showPopover' in caja)) return
    if (caja.matches(':popover-open')) caja.hidePopover()
    caja.showPopover()
  }

  // al montar se abre (vacío no ocupa espacio ni bloquea clics)
  $effect(() => alFrente())

  // aviso nuevo con una ventana abierta: se trae al frente
  $effect(() => {
    if ($avisos.length && document.querySelector('dialog[open]')) alFrente()
  })

  // ventana que se abre mientras hay avisos en pantalla: se vuelven a traer al frente
  $effect(() => {
    const obs = new MutationObserver((cambios) => {
      if (cambios.some((c) => c.target instanceof HTMLDialogElement && c.target.open) && caja?.childElementCount) alFrente()
    })
    obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
    return () => obs.disconnect()
  })
</script>

<div bind:this={caja} popover="manual" class="avisos fixed top-auto right-3 bottom-3 left-3 z-[100] grid gap-2 sm:right-4 sm:bottom-4 sm:left-auto sm:w-[380px]"
  role="status" aria-live="polite">
  {#each $avisos as a (a.id)}
    <div class="toast {a.tipo}">{a.msg}</div>
  {/each}
</div>

<style>
  /* quita los estilos del navegador para [popover] (centrado, borde, fondo, relleno) */
  .avisos { margin: 0; padding: 0; border: 0; background: transparent; color: inherit; overflow: visible; width: auto; height: auto; }
  @media (width >= 40rem) { .avisos { width: 380px; } }
</style>
