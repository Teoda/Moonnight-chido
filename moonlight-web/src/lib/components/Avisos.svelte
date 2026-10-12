<!-- Avisos (toasts) guardados en Redux: ui.avisos -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'

  const avisos = seleccionar((s) => s.ui.avisos)
</script>

<div class="fixed right-4 bottom-4 z-[100] grid max-w-[min(380px,calc(100%-32px))] gap-2" role="status" aria-live="polite">
  {#each $avisos as a (a.id)}
    <div class="toast {a.tipo}">{a.msg}</div>
  {/each}
</div>
