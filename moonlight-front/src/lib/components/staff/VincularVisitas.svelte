<!-- Vincular visitas: un cliente que reservó en el establecimiento sin cuenta y después se registró en la página.
     Con el número de reservación de esa visita y su número de cliente, todas las visitas de ese registro de
     mostrador pasan a su cuenta (y cuentan para sus promociones). -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { numCliente } from '#lib/utils/formato.ts'
  import Modal from '../Modal.svelte'

  let { abierto = $bindable(false) }: { abierto?: boolean } = $props()
  let codigo = $state(''), numero = $state(''), error = $state(''), enviando = $state(false)

  async function vincular(e: SubmitEvent) {
    e.preventDefault()
    error = ''; enviando = true
    try {
      const r = await api.post<{ movidas: number; cliente: { id: number; nombre: string; visitasMes: number } }>(
        '/staff/clientes/vincular', { codigo: codigo.trim(), numero: numero.trim() })
      dispatch(avisar(`${r.movidas} ${r.movidas === 1 ? 'visita vinculada' : 'visitas vinculadas'} a ${r.cliente.nombre} (${numCliente(r.cliente.id)})`, 'ok'))
      codigo = ''; numero = ''; abierto = false
    } catch (x) { error = (x as Error).message } finally { enviando = false }
  }
</script>

<Modal bind:abierto titulo="Vincular visitas a un cliente">
  <p class="muted small">
    Para quien reservó aquí sin cuenta y después se registró en la página. Usa el número de reservación de esa
    visita y el número de cliente que aparece en «Mi perfil». Se pasan a su cuenta todas sus visitas sin registro.
  </p>
  <form id="form-vincular" onsubmit={vincular}>
    <div class="form-grid">
      <div class="field"><label for="v-codigo">Número de reservación</label>
        <input id="v-codigo" placeholder="ML1A2B3C4D" autocomplete="off" required bind:value={codigo} /></div>
      <div class="field"><label for="v-numero">Número de cliente</label>
        <input id="v-numero" placeholder="MC-0023" autocomplete="off" required bind:value={numero} /></div>
    </div>
    <div class="err" role="alert">{error}</div>
  </form>
  {#snippet pie()}
    <button class="btn ghost" type="button" onclick={() => (abierto = false)}>Volver</button>
    <button class="btn primary" type="submit" form="form-vincular" disabled={enviando}>Vincular visitas</button>
  {/snippet}
</Modal>
