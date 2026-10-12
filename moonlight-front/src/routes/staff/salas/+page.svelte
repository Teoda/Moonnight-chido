<!-- Salas en vivo: estado, visita en curso con su progreso y música, y la próxima reservación. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { SalaStaff } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { musicaTxt } from '#lib/utils/carta.ts'
  import { falta } from '#lib/utils/formato.ts'
  import { ahora, cambio, inclinar, revelar } from '#lib/fx/efectos.ts'
  import Badge from '#lib/components/Badge.svelte'
  import Progreso from '#lib/components/Progreso.svelte'
  import { cadaQuince, puede } from '#lib/components/staff/panel.svelte.ts'

  const usuario = seleccionar((s) => s.sesion.usuario)
  let salas = $state<SalaStaff[] | null>(null), error = $state('')
  const ops = $derived(puede($usuario?.rol, 'OPERACIONES'))

  async function cargar(forzar = false) {
    try {
      const l = await api.get<SalaStaff[]>('/staff/salas')
      error = ''
      if (cambio('salas', l) || forzar) salas = l
    } catch (e) { if (forzar) error = (e as Error).message }
  }

  async function mantenimiento(s: SalaStaff) {
    const activo = s.estado !== 'MANTENIMIENTO'
    try {
      await api.post(`/staff/salas/${s.numero}/mantenimiento`, { activo })
      dispatch(avisar(activo ? `Sala ${s.numero} en mantenimiento: no se puede reservar` : `Sala ${s.numero} pasó a limpieza; quedará lista cuando la limpien`, 'ok'))
      cargar(true)
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) }
  }

  $effect(() => { cargar(true); return cadaQuince(() => cargar()) })
</script>

<div class="row between">
  <h2>Salas</h2>
  <div class="row"><span class="vivo ok">En vivo</span><button class="btn sm" type="button" onclick={() => cargar(true)}>Actualizar</button></div>
</div>

{#if error}<div class="card empty err">{error}</div>
{:else if !salas}<div class="grid-4">{#each Array(8) as _, i (i)}<div class="skeleton bajo"></div>{/each}</div>
{:else}
  <div class="grid-4">
    {#each salas as s, i (s.id)}
      {@const actual = s.reservaciones.find((r) => r.estado === 'EN_CURSO')}
      {@const prox = s.reservaciones.find((r) => r.estado === 'CONFIRMADA')}
      <div class="card sala-tile {s.estado}" class:ocupada={!!actual} use:revelar={i} use:inclinar>
        <div class="num">{s.numero}</div>
        <div class="small muted">{s.tipoSala.nombre}</div>
        <div class="my-2"><Badge estado={s.estado} /> {#if actual}<span class="badge accent pulso">Ocupada</span>{/if}</div>
        {#if actual}
          <div class="small mb-2 text-lila">🎤 {musicaTxt(actual)}</div>
          <Progreso inicio={actual.inicio} fin={actual.fin} />
        {/if}
        {#if prox}
          {@const resta = new Date(prox.inicio).getTime() - $ahora}
          <div class="small muted">{resta > 0 ? `Próxima en ${falta(resta)} · ${prox.codigo}` : `Llegando: ${prox.codigo}`} · 🎤 {musicaTxt(prox)}</div>
        {:else}
          <div class="small muted">Sin próximas</div>
        {/if}
        {#if ops && s.estado !== 'LIMPIEZA'}
          <button class="btn sm mt-2.5 {s.estado === 'MANTENIMIENTO' ? 'ok' : 'danger'}" type="button" onclick={() => mantenimiento(s)}>
            {s.estado === 'MANTENIMIENTO' ? 'Reactivar' : 'Mantenimiento'}
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}
