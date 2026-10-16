<!-- Personal (solo súper administrador): quién está en turno, historial de turnos y llaves de acceso.
     La llave nueva se muestra una sola vez; al generarla se cierran las sesiones abiertas de esa persona. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { Usuario } from '#lib/api/types.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { ROLES } from '#lib/utils/estados.ts'
  import { fmtFecha, fmtHora, tiempoTxt } from '#lib/utils/formato.ts'
  import { ahora } from '#lib/fx/efectos.ts'
  import Modal from '../Modal.svelte'
  import { confirmar } from '../confirmar.svelte.ts'

  let { abierto = $bindable(false), yo }: { abierto?: boolean; yo: number } = $props()

  type Turno = { id: number; inicio: string; fin: string | null; terminadoPor: number | null; usuario: { id: number; nombre: string } }
  let vista = $state<'turnos' | 'llaves'>('turnos')
  let turnos = $state<{ enTurno: Turno[]; historial: Turno[] } | null>(null)
  let lista = $state<Usuario[] | null>(null)
  let error = $state('')
  let nueva = $state<{ nombre: string; llave: string } | null>(null)
  let ocupado = $state<string | null>(null) // acción en curso (evita doble clic)

  const cargarTurnos = () => api.get<{ enTurno: Turno[]; historial: Turno[] }>('/staff/turnos').then((t) => (turnos = t), (x) => (error = (x as Error).message))
  $effect(() => {
    if (!abierto) { nueva = null; return }
    error = ''
    cargarTurnos()
    api.get<Usuario[]>('/staff/personal').then((l) => (lista = l), (x) => (error = (x as Error).message))
  })

  const minutos = (t: Turno) => Math.max(0, Math.floor(((t.fin ? new Date(t.fin).getTime() : $ahora) - new Date(t.inicio).getTime()) / 60_000))
  const nombreDe = (id: number | null) => lista?.find((u) => u.id === id)?.nombre ?? 'el súper administrador'

  async function terminar(t: Turno) {
    if (!(await confirmar('Terminar turno', `¿Terminar el turno de ${t.usuario.nombre} (desde las ${fmtHora(t.inicio)})?`, { ok: 'Terminar turno' }))) return
    ocupado = `t${t.id}`
    try { await api.post(`/staff/turnos/${t.id}/terminar`); await cargarTurnos(); dispatch(avisar(`Turno de ${t.usuario.nombre} terminado`, 'ok')) }
    catch (x) { dispatch(avisar((x as Error).message, 'bad')) } finally { ocupado = null }
  }

  async function generar(u: Usuario) {
    const propia = u.id === yo
    const ok = await confirmar('Generar llave nueva', propia
      ? 'Tu llave actual dejará de funcionar. Esta sesión sigue abierta.'
      : `La llave actual de ${u.nombre} dejará de funcionar y se cerrarán sus sesiones abiertas.`, { ok: 'Generar llave' })
    if (!ok) return
    ocupado = `u${u.id}`
    try { nueva = await api.post<{ nombre: string; llave: string }>(`/staff/personal/${u.id}/llave`) }
    catch (x) { dispatch(avisar((x as Error).message, 'bad')) } finally { ocupado = null }
  }
</script>

<Modal bind:abierto titulo="Personal">
  <div class="vistas" role="tablist" aria-label="Personal">
    <button type="button" role="tab" aria-selected={vista === 'turnos'} onclick={() => (vista = 'turnos')}>Turnos</button>
    <button type="button" role="tab" aria-selected={vista === 'llaves'} onclick={() => (vista = 'llaves')}>Llaves de acceso</button>
  </div>

  {#if error}
    <p class="err">{error}</p>
  {:else if vista === 'turnos'}
    {#if !turnos}
      <div class="empty"><span class="spinner"></span></div>
    {:else}
      <h4 class="sub">En turno ahora</h4>
      {#if !turnos.enTurno.length}
        <p class="muted small">Nadie ha iniciado turno.</p>
      {:else}
        <ul class="lista">
          {#each turnos.enTurno as t (t.id)}
            <li>
              <span class="punto" aria-hidden="true"></span>
              <span class="flex-1"><b>{t.usuario.nombre}</b> <span class="muted small">desde {fmtHora(t.inicio)} · {tiempoTxt(minutos(t))}</span></span>
              <button class="btn sm" type="button" disabled={ocupado !== null} onclick={() => terminar(t)}>Terminar</button>
            </li>
          {/each}
        </ul>
      {/if}

      <h4 class="sub">Últimos 7 días</h4>
      {#if !turnos.historial.length}
        <p class="muted small">Aún no hay turnos registrados.</p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Empleado</th><th>Día</th><th>Entrada</th><th>Salida</th><th>Tiempo</th></tr></thead>
            <tbody>
              {#each turnos.historial as t (t.id)}
                <tr>
                  <td>{t.usuario.nombre}</td>
                  <td>{fmtFecha(t.inicio)}</td>
                  <td>{fmtHora(t.inicio)}</td>
                  <td>{#if t.fin}{fmtHora(t.fin)}{#if t.terminadoPor}<span class="muted small" title="Lo cerró {nombreDe(t.terminadoPor)}"> *</span>{/if}{:else}<span class="text-ok">En turno</span>{/if}</td>
                  <td>{tiempoTxt(minutos(t))}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if turnos.historial.some((t) => t.terminadoPor)}<p class="muted small mt-2 mb-0">* Turno terminado por el súper administrador.</p>{/if}
      {/if}
    {/if}
  {:else}
    {#if nueva}
      <div class="llave" role="status">
        <p class="m-0">Llave nueva de <b>{nueva.nombre}</b>:</p>
        <p class="numero" aria-label="Llave {nueva.llave.split('').join(' ')}">{nueva.llave.slice(0, 4)} {nueva.llave.slice(4)}</p>
        <p class="muted small m-0">Entrégasela en persona. No se vuelve a mostrar; si se pierde, genera otra.</p>
      </div>
    {/if}
    <p class="muted small">Cada persona entra al panel con su nombre y su llave de 8 números. Solo tú puedes generar llaves nuevas.</p>
    {#if !lista}
      <div class="empty"><span class="spinner"></span></div>
    {:else}
      <ul class="lista">
        {#each lista as u (u.id)}
          <li>
            <span class="flex-1">{u.nombre}{#if u.id === yo}{' '}<span class="muted small">(tú)</span>{/if}
              <span class="muted small block">{ROLES[u.rol] || u.rol}</span></span>
            <button class="btn sm" type="button" disabled={ocupado !== null} onclick={() => generar(u)}>
              {ocupado === `u${u.id}` ? 'Generando…' : 'Generar llave nueva'}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Modal>

<style>
  .vistas { display: flex; gap: 6px; margin-bottom: 14px; }
  .vistas button {
    padding: 7px 14px; border: 1px solid var(--line); border-radius: 999px; background: transparent;
    color: var(--muted); font: inherit; font-size: .88rem; cursor: pointer;
  }
  .vistas button[aria-selected='true'] { color: #fff; background: #8b2cf5; border-color: #8b2cf5; }
  .vistas button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .sub { margin: 4px 0 8px; color: var(--color-lila); font-size: .92rem; }
  .sub + * { margin-bottom: 16px; }
  .llave { margin-bottom: 16px; padding: 14px; border: 1px solid rgba(255, 194, 61, .5); border-radius: 12px; background: rgba(255, 194, 61, .07); }
  .numero { margin: 6px 0; color: var(--gold); font-family: var(--font-mono); font-size: 2rem; font-weight: 700; letter-spacing: .12em; }
  .lista { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .lista li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-2); }
  .punto { width: 9px; height: 9px; flex: none; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 3px rgba(79, 209, 165, .2); }
  td, th { white-space: nowrap; }
</style>
