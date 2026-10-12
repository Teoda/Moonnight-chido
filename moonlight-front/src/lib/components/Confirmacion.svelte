<script lang="ts">
  import Modal from './Modal.svelte'
  import { pregunta } from './confirmar.svelte.ts'
</script>

{#if pregunta.actual}
  {@const p = pregunta.actual}
  <Modal abierto titulo={p.titulo} onclose={() => p.responder(false)}>
    <p>{p.mensaje}</p>
    {#snippet pie()}
      <button type="button" class="btn ghost" onclick={() => p.responder(false)}>Volver</button>
      <button type="button" class="btn {p.peligro ? 'danger' : 'primary'}" onclick={() => p.responder(true)}>{p.ok}</button>
    {/snippet}
  </Modal>
{/if}
