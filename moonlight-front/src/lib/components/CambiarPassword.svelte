<!-- Cambiar contraseña del cliente. Al cambiarla se cierran sus demás sesiones.
     (El personal no cambia su llave: la genera Administración en "Personal".) -->
<script lang="ts">
  import Modal from './Modal.svelte'
  import CampoPassword from './CampoPassword.svelte'
  import { api } from '#lib/api/client.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'

  let { abierto = $bindable(false) }: { abierto?: boolean } = $props()
  let actual = $state(''), nueva = $state(''), error = $state(''), enviando = $state(false)

  async function guardar(e: SubmitEvent) {
    e.preventDefault()
    error = ''; enviando = true
    try {
      await api.post('/cliente/cambiar-password', { actual, nueva })
      abierto = false; actual = ''; nueva = ''
      dispatch(avisar('Contraseña actualizada. Se cerraron tus otras sesiones.', 'ok'))
    } catch (x) { error = (x as Error).message } finally { enviando = false }
  }
</script>

<Modal bind:abierto titulo="Cambiar contraseña">
  <form onsubmit={guardar}>
    <CampoPassword id="cp-a" etiqueta="Contraseña actual" bind:valor={actual} />
    <CampoPassword id="cp-n" etiqueta="Nueva (mín. 10, letras y números)" bind:valor={nueva} nuevo />
    <div class="err">{error}</div>
    <button class="btn primary" type="submit" disabled={enviando}>Guardar</button>
  </form>
</Modal>
