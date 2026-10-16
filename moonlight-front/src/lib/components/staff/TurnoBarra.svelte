<!-- Turno del empleado: "Iniciar turno" al llegar y "Terminar turno" al irse.
     El súper administrador ve quién está en turno y el historial en "Personal". -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { fmtHora, tiempoTxt } from '#lib/utils/formato.ts'
  import { ahora } from '#lib/fx/efectos.ts'
  import { confirmar } from '../confirmar.svelte.ts'

  type Turno = { id: number; inicio: string; fin: string | null }
  let turno = $state<Turno | null | undefined>(undefined) // undefined = cargando
  let enviando = $state(false)

  $effect(() => { api.get<Turno | null>('/staff/turno').then((t) => (turno = t ?? null), () => (turno = null)) })

  // minutos en turno, redondeados hacia abajo al minuto
  const minutos = $derived(turno ? Math.max(0, Math.floor(($ahora - new Date(turno.inicio).getTime()) / 60_000)) : 0)

  async function iniciar() {
    enviando = true
    try {
      turno = await api.post<Turno>('/staff/turno/iniciar')
      dispatch(avisar(`Turno iniciado a las ${fmtHora(turno.inicio)}`, 'ok'))
    } catch (x) { dispatch(avisar((x as Error).message, 'bad')) } finally { enviando = false }
  }

  async function terminar() {
    if (!(await confirmar('Terminar turno', `Llevas ${tiempoTxt(minutos)} en turno. ¿Terminar tu turno ahora?`, { ok: 'Terminar turno' }))) return
    enviando = true
    try {
      await api.post('/staff/turno/terminar')
      turno = null
      dispatch(avisar('Turno terminado', 'ok'))
    } catch (x) { dispatch(avisar((x as Error).message, 'bad')) } finally { enviando = false }
  }
</script>

{#if turno !== undefined}
  <div class="turno" class:activo={!!turno} role="status">
    {#if turno}
      <span class="punto" aria-hidden="true"></span>
      <span class="flex-1">En turno desde <b>{fmtHora(turno.inicio)}</b> <span class="muted">· {tiempoTxt(minutos)}</span></span>
      <button class="btn sm" type="button" disabled={enviando} onclick={terminar}>Terminar turno</button>
    {:else}
      <span class="flex-1">No has iniciado tu turno.</span>
      <button class="btn sm primary" type="button" disabled={enviando} onclick={iniciar}>Iniciar turno</button>
    {/if}
  </div>
{/if}

<style>
  .turno {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 16px; padding: 10px 14px;
    border: 1px solid rgba(255, 181, 71, .45); border-radius: 12px; background: rgba(255, 181, 71, .06); font-size: .92rem;
  }
  .turno.activo { border-color: rgba(79, 209, 165, .45); background: rgba(79, 209, 165, .06); }
  .punto { width: 9px; height: 9px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 3px rgba(79, 209, 165, .2); }
</style>
