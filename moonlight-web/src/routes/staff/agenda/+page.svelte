<!-- Agenda del día (incluye la madrugada). Recepción puede abrir una reservación con un clic. -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { api } from '#lib/api/client.ts'
  import type { ReservacionStaff } from '#lib/api/types.ts'
  import { seleccionar } from '#lib/store/index.ts'
  import { musicaTxt } from '#lib/utils/carta.ts'
  import { fmtHora, hoyLocal } from '#lib/utils/formato.ts'
  import Badge from '#lib/components/Badge.svelte'
  import { puede, recepcion } from '#lib/components/staff/panel.svelte.ts'

  const usuario = seleccionar((s) => s.sesion.usuario)
  let fecha = $state(hoyLocal())
  let lista = $state<ReservacionStaff[] | null>(null), error = $state(''), cargando = $state(false)
  const abrir = $derived(puede($usuario?.rol, 'RECEPCION', 'OPERACIONES'))

  async function cargar() {
    const desde = new Date(`${fecha || hoyLocal()}T00:00:00-06:00`)
    const hasta = new Date(desde.getTime() + 30 * 36e5) // incluye la madrugada
    cargando = true; error = ''
    try { lista = await api.get<ReservacionStaff[]>(`/staff/reservaciones?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`) }
    catch (e) { error = (e as Error).message } finally { cargando = false }
  }
  $effect(() => { void fecha; cargar() })

  function verEnRecepcion(c: string) { recepcion.codigo = c; goto('/staff/recepcion') }
</script>

<div class="row between">
  <h2>Agenda</h2>
  <div class="row"><input class="w-auto" type="date" bind:value={fecha} aria-label="Fecha" /><button class="btn" type="button" onclick={cargar}>Actualizar</button></div>
</div>
<div class="card table-wrap">
  {#if cargando && !lista}<div class="empty"><span class="spinner"></span></div>
  {:else if error}<div class="empty err">{error}</div>
  {:else if lista && !lista.length}<div class="empty">Sin reservaciones ese día.</div>
  {:else if lista}
    <table>
      <thead><tr><th>Horario</th><th>Código</th><th>Cliente</th><th>Sala</th><th>Personas</th><th>Música</th><th>Canal</th><th>Estado</th></tr></thead>
      <tbody>
        {#each lista as r (r.id)}
          <tr class:click={abrir} onclick={abrir ? () => verEnRecepcion(r.codigo) : undefined}>
            <td>{fmtHora(r.inicio)}–{fmtHora(r.fin)}</td><td><code>{r.codigo}</code></td>
            <td>{r.cliente.nombre}</td><td>{r.sala.numero}</td><td>{r.personas}</td><td class="small">{musicaTxt(r)}</td>
            <td class="small muted">{r.canal === 'WEB' ? 'En línea' : 'Sin registro'}</td><td><Badge estado={r.estado} /></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
