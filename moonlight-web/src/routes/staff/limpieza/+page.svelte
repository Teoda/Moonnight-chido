<!-- Limpieza en vivo: salas por limpiar con su cronómetro; aviso sonoro cuando llega una nueva. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { TareaLimpieza } from '#lib/api/types.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { falta } from '#lib/utils/formato.ts'
  import { ahora, cambio, revelar } from '#lib/fx/efectos.ts'
  import { ding } from '#lib/fx/sonido.ts'
  import Badge from '#lib/components/Badge.svelte'
  import { cadaQuince, panel } from '#lib/components/staff/panel.svelte.ts'

  let tareas = $state<TareaLimpieza[] | null>(null), error = $state('')
  let vistas: Set<number> | null = null
  let nuevas = $state<number[]>([])

  async function cargar(forzar = false) {
    let ls: TareaLimpieza[]
    try { ls = await api.get<TareaLimpieza[]>('/staff/limpieza') } catch (e) { if (forzar) error = (e as Error).message; return }
    error = ''
    if (!cambio('limpieza', ls) && !forzar) return
    const recien = vistas && !forzar ? ls.filter((l) => !vistas!.has(l.id)) : []
    vistas = new Set(ls.map((l) => l.id))
    nuevas = recien.map((l) => l.id)
    if (recien.length) {
      if (panel.sonido) ding()
      dispatch(avisar(`Sala ${recien.map((l) => l.sala.numero).join(', ')} por limpiar`, 'ok'))
    }
    tareas = ls
  }

  async function paso(l: TareaLimpieza, accion: 'iniciar' | 'terminar') {
    try {
      await api.post(`/staff/limpieza/${l.id}/${accion}`)
      dispatch(avisar(accion === 'iniciar' ? 'Limpieza iniciada' : `Sala ${l.sala.numero} lista ✨`, 'ok'))
      cargar(true)
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) }
  }

  $effect(() => { cargar(true); return cadaQuince(() => cargar()) })
</script>

<div class="row between"><h2>Limpieza</h2><span class="vivo ok">En vivo</span></div>

{#if error}<div class="card empty err">{error}</div>
{:else if !tareas}<div class="grid-3"><div class="skeleton bajo"></div><div class="skeleton bajo"></div></div>
{:else if !tareas.length}<div class="card empty">Todas las salas están listas. ✨</div>
{:else}
  <div class="grid-3">
    {#each tareas as l, i (l.id)}
      <article class="card order" class:PREPARANDO={l.estado === 'EN_PROCESO'} class:nuevo={nuevas.includes(l.id)} use:revelar={i}>
        <div class="row between"><h3 class="m-0">Sala {l.sala.numero}</h3><Badge estado={l.estado} /></div>
        <div class="small muted">{l.reservacionId ? 'Después de una visita' : 'Después de mantenimiento'}</div>
        <p>
          <span class="vivo {l.estado === 'EN_PROCESO' ? 'accent' : 'warn'}">
            {l.estado === 'EN_PROCESO' && l.iniciadaEn ? `Limpiando hace ${falta($ahora - new Date(l.iniciadaEn).getTime())}` : `Esperando hace ${falta($ahora - new Date(l.creadaEn).getTime())}`}
          </span>
        </p>
        <div class="row">
          {#if l.estado === 'PENDIENTE'}<button class="btn sm" type="button" onclick={() => paso(l, 'iniciar')}>Iniciar</button>{/if}
          <button class="btn sm ok" type="button" onclick={() => paso(l, 'terminar')}>Sala lista</button>
        </div>
      </article>
    {/each}
  </div>
{/if}
