<!-- Etiqueta de estado (reservación, pedido, sala, pago...). Los estados "en movimiento" laten. -->
<script lang="ts">
  import { ESTADOS, VIVOS } from '#lib/utils/estados.ts'

  let { estado, vivo = false }: { estado: string; vivo?: boolean } = $props()
  const info = $derived(ESTADOS[estado] || [estado, ''])
</script>

<span class="badge {info[1]}" class:pulso={vivo && VIVOS.has(estado)}>{info[0]}</span>
