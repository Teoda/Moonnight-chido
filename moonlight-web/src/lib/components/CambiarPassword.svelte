<!-- Cambiar contraseña (cliente o personal). Al cambiarla se cierran las demás sesiones. -->
<script lang="ts">
  import Modal from './Modal.svelte'
  import CampoPassword from './CampoPassword.svelte'
  import { api, type Ambito } from '#lib/api/client.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { salirStaff } from '#lib/store/sesion.ts'

  let { abierto = $bindable(false), ambito }: { abierto?: boolean; ambito: Ambito } = $props()
  let actual = $state(''), nueva = $state(''), error = $state(''), enviando = $state(false)

  async function guardar(e: SubmitEvent) {
    e.preventDefault()
    error = ''; enviando = true
    try {
      await api.post(ambito === 'cliente' ? '/cliente/cambiar-password' : '/auth/cambiar-password', { actual, nueva })
      abierto = false; actual = ''; nueva = ''
      dispatch(avisar('Contraseña actualizada. Se cerraron tus otras sesiones.', 'ok'))
    } catch (x) { error = (x as Error).message } finally { enviando = false }
  }
</script>

<Modal bind:abierto titulo={ambito === 'cliente' ? 'Cambiar contraseña' : 'Mi cuenta'}>
  <form onsubmit={guardar}>
    <CampoPassword id="cp-a" etiqueta="Contraseña actual" bind:valor={actual} />
    <CampoPassword id="cp-n" etiqueta="Nueva (mín. 10, letras y números)" bind:valor={nueva} nuevo />
    <div class="err">{error}</div>
    <div class="row">
      <button class="btn primary" type="submit" disabled={enviando}>Guardar</button>
      {#if ambito === 'staff'}
        <button class="btn danger" type="button" onclick={() => { abierto = false; dispatch(salirStaff(true)) }}>Cerrar todas mis sesiones</button>
      {/if}
    </div>
  </form>
</Modal>
