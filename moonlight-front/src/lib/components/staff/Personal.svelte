<!-- Personal (solo Administración): lista de trabajadores y "Generar llave nueva".
     La llave nueva se muestra una sola vez; al generarla se cierran las sesiones abiertas de esa persona. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { Usuario } from '#lib/api/types.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import Modal from '../Modal.svelte'
  import { confirmar } from '../confirmar.svelte.ts'

  let { abierto = $bindable(false), yo }: { abierto?: boolean; yo: number } = $props()

  let lista = $state<Usuario[] | null>(null)
  let error = $state('')
  let nueva = $state<{ nombre: string; llave: string } | null>(null)
  let generando = $state<number | null>(null)

  $effect(() => {
    if (!abierto) { nueva = null; return }
    error = ''
    api.get<Usuario[]>('/staff/personal').then((l) => (lista = l), (x) => (error = (x as Error).message))
  })

  async function generar(u: Usuario) {
    const propia = u.id === yo
    const ok = await confirmar('Generar llave nueva', propia
      ? 'Tu llave actual dejará de funcionar. Esta sesión sigue abierta.'
      : `La llave actual de ${u.nombre} dejará de funcionar y se cerrarán sus sesiones abiertas.`, { ok: 'Generar llave' })
    if (!ok) return
    generando = u.id
    try { nueva = await api.post<{ nombre: string; llave: string }>(`/staff/personal/${u.id}/llave`) }
    catch (x) { dispatch(avisar((x as Error).message, 'bad')) }
    finally { generando = null }
  }
</script>

<Modal bind:abierto titulo="Personal">
  {#if nueva}
    <div class="llave" role="status">
      <p class="m-0">Llave nueva de <b>{nueva.nombre}</b>:</p>
      <p class="numero" aria-label="Llave {nueva.llave.split('').join(' ')}">{nueva.llave.slice(0, 4)} {nueva.llave.slice(4)}</p>
      <p class="muted small m-0">Entrégasela en persona. No se vuelve a mostrar; si se pierde, genera otra.</p>
    </div>
  {/if}

  <p class="muted small">Cada trabajador entra al panel con su nombre y su llave de 8 números. Nadie puede cambiar su propia llave: solo se genera una nueva aquí.</p>
  {#if error}
    <p class="err">{error}</p>
  {:else if !lista}
    <div class="empty"><span class="spinner"></span></div>
  {:else}
    <ul class="lista">
      {#each lista as u (u.id)}
        <li>
          <span class="flex-1">{u.nombre}{#if u.id === yo}{' '}<span class="muted small">(tú)</span>{/if}</span>
          <button class="btn sm" type="button" disabled={generando !== null} onclick={() => generar(u)}>
            {generando === u.id ? 'Generando…' : 'Generar llave nueva'}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</Modal>

<style>
  .llave { margin-bottom: 16px; padding: 14px; border: 1px solid rgba(255, 194, 61, .5); border-radius: 12px; background: rgba(255, 194, 61, .07); }
  .numero { margin: 6px 0; color: var(--gold); font-family: var(--font-mono); font-size: 2rem; font-weight: 700; letter-spacing: .12em; }
  .lista { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .lista li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-2); }
</style>
