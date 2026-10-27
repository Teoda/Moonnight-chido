<!-- Horario del personal: cada día abierto con sus dos turnos y una persona por área (Planta baja y Salas).
     El súper administrador asigna a cada lugar; el resto del personal lo ve y encuentra resaltado su turno. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { AreaTrabajo, HorarioPersonal } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { AREAS, DIAS, momentoOperativo, turnoEnCurso } from '#lib/utils/horario.ts'
  import { ahora } from '#lib/fx/efectos.ts'
  import { confirmar } from '#lib/components/confirmar.svelte.ts'
  import { esSuper } from '#lib/components/staff/panel.svelte.ts'

  const usuario = seleccionar((s) => s.sesion.usuario)
  const editar = $derived(esSuper($usuario?.rol))
  let h = $state<HorarioPersonal | null>(null), error = $state(''), guardando = $state('')

  async function cargar() {
    try { h = await api.get<HorarioPersonal>('/staff/horario'); error = '' } catch (e) { error = (e as Error).message }
  }
  $effect(() => { cargar() })

  const quien = (dia: number, turno: number, area: AreaTrabajo) =>
    h?.asignaciones.find((a) => a.diaSemana === dia && a.turno === turno && a.area === area)?.usuario ?? null
  const ocupadoEseDia = (dia: number, id: number) => !!h?.asignaciones.some((a) => a.diaSemana === dia && a.usuario.id === id)
  const ahoraOp = $derived(momentoOperativo($ahora))
  const enCurso = $derived(h ? turnoEnCurso(h, ahoraOp.min) : null)

  // turnos y horas por persona en la semana, y lugares que faltan por cubrir
  const resumen = $derived.by(() => {
    if (!h) return { personas: [], vacios: 0 }
    const personas = h.personal.map((p) => ({ ...p, turnos: h!.asignaciones.filter((a) => a.usuario.id === p.id).length }))
    return { personas, vacios: h.dias.length * h.turnos.length * h.areas.length - h.asignaciones.length }
  })

  async function asignar(dia: number, turno: number, area: AreaTrabajo, valor: string) {
    const clave = `${dia}-${turno}-${area}`
    guardando = clave
    try {
      await api.patch('/staff/horario', { diaSemana: dia, turno, area, usuarioId: valor ? Number(valor) : null })
      await cargar()
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')); await cargar() } finally { guardando = '' }
  }

  async function repartir() {
    if (!await confirmar('Repartir parejo', 'Se reemplazará todo el horario por un reparto parejo entre el personal (nadie repite turno el mismo día).', { ok: 'Repartir' })) return
    try {
      await api.post('/staff/horario/propuesta')
      dispatch(avisar('Horario repartido', 'ok'))
      await cargar()
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) }
  }
</script>

<div class="row between">
  <h2 class="m-0">Horario del personal</h2>
  {#if editar && h}<button class="btn sm" type="button" onclick={repartir}>Repartir parejo</button>{/if}
</div>
{#if h}
  <p class="subtitulo mt-2 max-w-[75ch]">
    {h.turnos.map((t) => `Turno ${t.n}: ${t.inicio}–${t.fin}`).join(' · ')}. En cada turno hay una persona en
    <b>Planta baja</b> (recepción y bar) y otra en <b>Salas</b> (pisos 2 y 3).{editar ? ' Elige a la persona de cada lugar.' : ''}
  </p>
{/if}

{#if error}<div class="card empty err">{error}</div>
{:else if !h}<div class="semana">{#each Array(6) as _, i (i)}<div class="skeleton bajo"></div>{/each}</div>
{:else}
  {#if editar}
    <div class="card resumen">
      <div class="row between"><h3 class="m-0">Resumen de la semana</h3>
        {#if resumen.vacios}<span class="badge warn">{resumen.vacios} lugar(es) sin asignar</span>{:else}<span class="badge ok">Todo cubierto</span>{/if}
      </div>
      <ul>
        {#each resumen.personas as p (p.id)}<li><b>{p.nombre}</b> <span class="muted">{p.turnos} turno(s) · {p.turnos * h.horasTurno} h</span></li>{/each}
      </ul>
    </div>
  {/if}

  <div class="semana">
    {#each h.dias as dia (dia)}
      {@const hoy = dia === ahoraOp.dia}
      <section class="card dia" class:hoy aria-labelledby="dia-{dia}">
        <div class="row between"><h3 id="dia-{dia}" class="m-0">{DIAS[dia]}</h3>{#if hoy}<span class="badge accent">Hoy</span>{/if}</div>
        {#each h.turnos as t (t.n)}
          <div class="turno" class:actual={hoy && enCurso === t.n}>
            <p class="turno-titulo">Turno {t.n} <span>{t.inicio}–{t.fin}</span>{#if hoy && enCurso === t.n}<span class="vivo accent">En curso</span>{/if}</p>
            {#each h.areas as area (area)}
              {@const u = quien(dia, t.n, area)}
              <div class="lugar" class:mio={u?.id === $usuario?.id}>
                <span class="area">{AREAS[area].nombre}<small>{AREAS[area].detalle}</small></span>
                {#if editar}
                  <select aria-label="{DIAS[dia]}, turno {t.n}, {AREAS[area].nombre}" value={u ? String(u.id) : ''}
                    disabled={guardando === `${dia}-${t.n}-${area}`} onchange={(e) => asignar(dia, t.n, area, e.currentTarget.value)}>
                    <option value="">Sin asignar</option>
                    {#each h.personal as p (p.id)}
                      <option value={String(p.id)} disabled={p.id !== u?.id && ocupadoEseDia(dia, p.id)}>{p.nombre}{p.id !== u?.id && ocupadoEseDia(dia, p.id) ? ' (ya tiene turno)' : ''}</option>
                    {/each}
                  </select>
                {:else}
                  <b class="persona" class:vacio={!u}>{u ? u.nombre : 'Sin asignar'}{#if u?.id === $usuario?.id} <span class="badge ok">Tú</span>{/if}</b>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </section>
    {/each}
  </div>
{/if}

<style>
  .semana { display: grid; gap: 14px; margin-top: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
  .dia { display: grid; gap: 12px; align-content: start; }
  .dia.hoy { border-color: color-mix(in oklab, var(--accent) 60%, transparent); box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 35%, transparent); }
  .turno { display: grid; gap: 6px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg-2); }
  .turno.actual { border-color: color-mix(in oklab, var(--accent-2) 55%, transparent); }
  .turno-titulo { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0; font-size: .8rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .turno-titulo > span:first-child { color: var(--muted); font-weight: 500; letter-spacing: 0; }
  .lugar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); align-items: center; gap: 8px; padding: 6px 8px; border-radius: 9px; }
  .lugar.mio { background: color-mix(in oklab, var(--ok) 12%, transparent); box-shadow: inset 3px 0 0 var(--ok); }
  .area { display: grid; font-size: .88rem; }
  .area small { color: var(--muted); font-size: .74rem; }
  .persona { min-width: 0; overflow-wrap: anywhere; text-align: right; font-size: .92rem; }
  .persona.vacio { color: var(--warn); font-weight: 500; }
  .lugar select { width: 100%; min-width: 0; padding: 6px 8px; font-size: .88rem; }

  .resumen { margin-top: 16px; }
  .resumen ul { display: grid; gap: 4px 18px; margin: 10px 0 0; padding: 0; list-style: none; font-size: .9rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); }
</style>
