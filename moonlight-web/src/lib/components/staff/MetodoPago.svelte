<!-- Método de pago en el establecimiento (se registra si la tarjeta es de débito o de crédito). -->
<script lang="ts">
  import type { MetodoMostrador } from '#lib/api/types.ts'
  import { METODOS, METODOS_MOSTRADOR } from '#lib/utils/estados.ts'

  let { valor = $bindable('EFECTIVO'), id, clase = '' }: { valor?: MetodoMostrador; id?: string; clase?: string } = $props()
</script>

<select {id} class={clase} bind:value={valor} aria-label={id ? undefined : 'Método de pago'}>
  {#each METODOS_MOSTRADOR as m (m)}<option value={m}>{METODOS[m]}</option>{/each}
</select>
