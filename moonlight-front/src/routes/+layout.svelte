<script lang="ts">
  import '../app.css'
  import type { Snippet } from 'svelte'
  import Cielo from '#lib/components/Cielo.svelte'
  import Avisos from '#lib/components/Avisos.svelte'
  import Confirmacion from '#lib/components/Confirmacion.svelte'
  import { instalarOndas } from '#lib/fx/efectos.ts'

  let { children }: { children: Snippet } = $props()

  $effect(() => instalarOndas())
</script>

<Cielo />
{@render children()}
<Avisos />
<Confirmacion />
