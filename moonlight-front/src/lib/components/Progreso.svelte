<!-- Barra de progreso de una visita en curso, con el tiempo que queda. -->
<script lang="ts">
  import { ahora } from '#lib/fx/efectos.ts'
  import { falta } from '#lib/utils/formato.ts'

  let { inicio, fin }: { inicio: string; fin: string } = $props()
  const a = $derived(new Date(inicio).getTime())
  const b = $derived(new Date(fin).getTime())
  const k = $derived(Math.min(1, Math.max(0, ($ahora - a) / (b - a))))
  const acabo = $derived($ahora >= b)
</script>

<div class="prog" class:casi={b - $ahora < 10 * 60_000}>
  <div class="prog-fill" style:width="{(k * 100).toFixed(1)}%"></div>
</div>
<span class="vivo {acabo ? 'bad' : 'accent'}">{acabo ? 'Tiempo terminado' : `Quedan ${falta(b - $ahora)}`}</span>
