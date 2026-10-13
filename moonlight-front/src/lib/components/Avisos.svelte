<!-- Avisos (toasts) guardados en Redux: ui.avisos -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'

  const avisos = seleccionar((s) => s.ui.avisos)
</script>

<div class="fixed right-3 bottom-3 left-3 z-[100] grid gap-2 sm:right-4 sm:bottom-4 sm:left-auto sm:w-[380px]" role="status" aria-live="polite">
  {#each $avisos as a (a.id)}
    <div class="toast {a.tipo}">{a.msg}</div>
  {/each}
</div>
