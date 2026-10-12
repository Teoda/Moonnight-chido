<!-- /staff lleva a la primera pestaña que el rol puede ver. -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { seleccionar } from '#lib/store/index.ts'
  import { pestanasDe } from '#lib/components/staff/panel.svelte.ts'

  const usuario = seleccionar((s) => s.sesion.usuario)
  $effect(() => {
    const primera = pestanasDe($usuario?.rol)[0]
    if (primera) goto(`/staff/${primera.ruta}`, { replaceState: true })
  })
</script>
