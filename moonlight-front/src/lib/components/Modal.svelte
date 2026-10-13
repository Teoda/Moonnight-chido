<!-- Diálogo nativo (<dialog>): accesible, con fondo difuminado y cierre con Esc. -->
<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    abierto = $bindable(false),
    titulo,
    children,
    pie,
    onclose,
    dialogo = $bindable(),
  }: {
    abierto?: boolean
    titulo: string
    children: Snippet
    pie?: Snippet
    onclose?: () => void
    dialogo?: HTMLDialogElement
  } = $props()

  $effect(() => {
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  })

  function cerrar() {
    abierto = false
    onclose?.()
  }
</script>

<dialog
  bind:this={dialogo}
  class="modal"
  oncancel={(e) => { e.preventDefault(); cerrar() }}
  aria-labelledby="dlg-titulo"
>
  {#if abierto}
    <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
      <h3 id="dlg-titulo" class="m-0">{titulo}</h3>
      <button type="button" class="x" aria-label="Cerrar" onclick={cerrar}>×</button>
    </div>
    <div class="max-h-[calc(100dvh-170px)] overflow-auto p-4 sm:max-h-[70vh] sm:p-5">{@render children()}</div>
    {#if pie}
      <div class="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 sm:px-5 sm:py-3.5">{@render pie()}</div>
    {/if}
  {/if}
</dialog>
