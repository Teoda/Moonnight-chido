<!-- Salas en vivo como plano del local: arriba las alas chicas, pasillo y abajo la más grande. Al tocar una sala se ve su detalle. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { SalaStaff } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { musicaTxt } from '#lib/utils/carta.ts'
  import { falta, fmtHora } from '#lib/utils/formato.ts'
  import { ahora, cambio } from '#lib/fx/efectos.ts'
  import Badge from '#lib/components/Badge.svelte'
  import Progreso from '#lib/components/Progreso.svelte'
  import { cadaQuince, puede } from '#lib/components/staff/panel.svelte.ts'

  type Situacion = 'libre' | 'llegando' | 'ocupada' | 'limpieza' | 'mant'
  const LEYENDA: [Situacion, string][] = [['libre', 'Libre'], ['llegando', 'Por llegar'], ['ocupada', 'Ocupada'], ['limpieza', 'Limpieza'], ['mant', 'Mantenimiento']]
  const TONOS = ['#6cb6ff', '#d6a765', '#b45cff'] // luz de cada ala, de la más chica a la más grande
  const LLEGANDO_MS = 15 * 60_000

  const usuario = seleccionar((s) => s.sesion.usuario)
  let salas = $state<SalaStaff[] | null>(null), error = $state('')
  let elegida = $state<number | null>(null)
  const ops = $derived(puede($usuario?.rol, 'OPERACIONES'))

  // alas por tipo de sala, de menor a mayor capacidad; la más grande va sola abajo, del otro lado del pasillo
  const alas = $derived.by(() => {
    const porTipo = new Map<string, SalaStaff[]>()
    for (const s of salas ?? []) porTipo.set(s.tipoSala.codigo, [...(porTipo.get(s.tipoSala.codigo) ?? []), s])
    return [...porTipo.values()]
      .sort((a, b) => a[0].tipoSala.capacidadMax - b[0].tipoSala.capacidadMax)
      .map((l, i) => ({ tipo: l[0].tipoSala, tono: TONOS[i] ?? TONOS.at(-1)!, salas: l.sort((a, b) => a.numero - b.numero) }))
  })
  const arriba = $derived(alas.length > 1 ? alas.slice(0, -1) : alas)
  const abajo = $derived(alas.length > 1 ? alas.slice(-1) : [])
  const sel = $derived(salas?.find((s) => s.numero === elegida) ?? null)

  const enCurso = (s: SalaStaff) => s.reservaciones.find((r) => r.estado === 'EN_CURSO')
  const proxima = (s: SalaStaff) => s.reservaciones.find((r) => r.estado === 'CONFIRMADA')
  const titulo = (t: SalaStaff['tipoSala']) =>
    `Salas ${t.nombre.toLowerCase()}${t.nombre.endsWith('a') ? 's' : ''} (${t.capacidadMin} a ${t.capacidadMax} personas)`

  function situacion(s: SalaStaff, t: number): Situacion {
    if (s.estado === 'MANTENIMIENTO') return 'mant'
    if (s.estado === 'LIMPIEZA') return 'limpieza'
    if (enCurso(s)) return 'ocupada'
    const p = proxima(s)
    return p && new Date(p.inicio).getTime() - t < LLEGANDO_MS ? 'llegando' : 'libre'
  }

  function rotulo(s: SalaStaff, sit: Situacion, t: number) {
    if (sit === 'mant') return 'Mantenimiento'
    if (sit === 'limpieza') return 'Limpieza'
    if (sit === 'ocupada') {
      const resta = new Date(enCurso(s)!.fin).getTime() - t
      return resta > 0 ? `Quedan ${falta(resta)}` : 'Tiempo terminado'
    }
    const p = proxima(s)
    if (sit === 'llegando') {
      const resta = new Date(p!.inicio).getTime() - t
      return resta > 0 ? `Llega en ${falta(resta)}` : 'Llegando'
    }
    return p ? `Próx. ${fmtHora(p.inicio)}` : 'Libre'
  }

  const cuenta = $derived.by(() => {
    const c: Record<Situacion, number> = { libre: 0, llegando: 0, ocupada: 0, limpieza: 0, mant: 0 }
    for (const s of salas ?? []) c[situacion(s, $ahora)]++
    return c
  })

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

{#snippet ala(a: (typeof alas)[number], lado: 'arriba' | 'abajo')}
  <section class="ala {lado}" style:--tono={a.tono} style:flex-grow={a.salas.length} aria-label={titulo(a.tipo)}>
    <h3 class="ala-titulo">{titulo(a.tipo)}</h3>
    <div class="ala-salas" style:--n={a.salas.length}>
      {#each a.salas as s (s.id)}
        {@const sit = situacion(s, $ahora)}
        {@const txt = rotulo(s, sit, $ahora)}
        <button class="cuarto {sit}" type="button" aria-pressed={elegida === s.numero} aria-label="Sala {s.numero}: {txt}"
          onclick={() => (elegida = elegida === s.numero ? null : s.numero)}>
          <span class="cuarto-num">{String(s.numero).padStart(2, '0')}</span>
          <span class="pantalla" aria-hidden="true"></span>
          <span class="sillon" aria-hidden="true"><span class="mesa"></span></span>
          <span class="cuarto-txt">{txt}</span>
        </button>
      {/each}
    </div>
  </section>
{/snippet}

<div class="row between">
  <h2>Salas</h2>
  <div class="row"><span class="vivo ok">En vivo</span><button class="btn sm" type="button" onclick={() => cargar(true)}>Actualizar</button></div>
</div>

{#if error}<div class="card empty err">{error}</div>
{:else if !salas}<div class="skeleton plano-cargando"></div>
{:else}
  <ul class="leyenda" aria-label="Resumen">
    {#each LEYENDA as [k, nombre] (k)}<li class={k}><i aria-hidden="true"></i>{nombre} <b>{cuenta[k]}</b></li>{/each}
  </ul>

  <div class="plano" role="group" aria-label="Plano de salas">
    <div class="lienzo">
      <div class="fila">{#each arriba as a (a.tipo.id)}{@render ala(a, 'arriba')}{/each}</div>
      {#if abajo.length}
        <div class="pasillo" aria-hidden="true"><span>Pasillo</span></div>
        <div class="fila">{#each abajo as a (a.tipo.id)}{@render ala(a, 'abajo')}{/each}</div>
      {/if}
    </div>
  </div>
  <p class="small muted mt-2 md:hidden">Desliza el plano hacia los lados para ver todas las salas.</p>

  {#if sel}
    {@const actual = enCurso(sel)}
    {@const prox = proxima(sel)}
    <div class="card detalle mt-4">
      <div class="row between">
        <h3 class="m-0">Sala {sel.numero} <span class="muted small font-normal">· {sel.tipoSala.nombre} ({sel.tipoSala.capacidadMin}–{sel.tipoSala.capacidadMax} personas)</span></h3>
        <button class="x" type="button" aria-label="Cerrar detalle" onclick={() => (elegida = null)}>×</button>
      </div>
      <div class="my-2"><Badge estado={sel.estado} /> {#if actual}<span class="badge accent pulso">Ocupada</span>{/if}</div>
      {#if actual}
        <p class="small m-0 mb-1">Visita <b>{actual.codigo}</b> · {fmtHora(actual.inicio)}–{fmtHora(actual.fin)}</p>
        <div class="small text-lila">🎤 {musicaTxt(actual)}</div>
        <Progreso inicio={actual.inicio} fin={actual.fin} />
      {/if}
      {#if prox}
        {@const resta = new Date(prox.inicio).getTime() - $ahora}
        <p class="small muted mt-2 mb-0">{resta > 0 ? `Próxima en ${falta(resta)} (${fmtHora(prox.inicio)})` : 'Llegando'} · {prox.codigo} · 🎤 {musicaTxt(prox)}</p>
      {:else}
        <p class="small muted mt-2 mb-0">Sin próximas reservaciones</p>
      {/if}
      {#if ops && sel.estado !== 'LIMPIEZA'}
        <button class="btn sm mt-3 {sel.estado === 'MANTENIMIENTO' ? 'ok' : 'danger'}" type="button" onclick={() => mantenimiento(sel)}>
          {sel.estado === 'MANTENIMIENTO' ? 'Reactivar' : 'Poner en mantenimiento'}
        </button>
      {/if}
    </div>
  {:else}
    <p class="small muted mt-3">Toca una sala para ver su visita, la próxima reservación y las acciones.</p>
  {/if}
{/if}

<style>
  /* colores de cada situación: la luz dentro del cuarto */
  .libre { --luz: var(--ok); }
  .llegando { --luz: var(--info); }
  .ocupada { --luz: var(--accent-2); }
  .limpieza { --luz: var(--warn); }
  .mant { --luz: var(--bad); }

  .leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 4px 0 14px; padding: 0; list-style: none; font-size: .88rem; color: var(--muted); }
  .leyenda li { display: flex; align-items: center; gap: 6px; }
  .leyenda i { width: 10px; height: 10px; border-radius: 3px; background: var(--luz); box-shadow: 0 0 8px var(--luz); }
  .leyenda b { color: var(--text); }

  /* el plano no se encoge de más: en teléfono se desliza a los lados */
  .plano { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: #07060d; }
  .plano-cargando { height: 340px; border-radius: var(--radius); }
  .lienzo { --muro: #2a2342; --piso: #120e1d; min-width: 880px; padding: 14px; }
  .fila { display: flex; gap: 14px; }
  .ala { flex: 1 1 0; min-width: 0; }
  .ala-titulo {
    margin: 0 0 6px; color: var(--tono); font-size: .7rem; font-weight: 700; letter-spacing: .14em; text-align: center; text-transform: uppercase;
    text-shadow: 0 0 10px color-mix(in oklab, var(--tono) 60%, transparent);
  }
  .ala-salas {
    display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 4px;
    border: 4px solid var(--muro); border-radius: 6px; background: var(--muro);
  }

  .pasillo {
    position: relative; display: grid; place-items: center; height: 54px; margin: 0 -14px; color: rgba(255, 255, 255, .22);
    background: radial-gradient(circle, rgba(255, 210, 150, .55) 0 2px, rgba(255, 190, 120, .12) 3px 9px, transparent 10px) center / 120px 100% repeat-x, var(--piso);
  }
  .pasillo span { padding: 0 10px; background: var(--piso); font-size: .7rem; letter-spacing: .3em; text-transform: uppercase; }

  /* cada cuarto: puerta hacia el pasillo, pantalla en el muro del fondo y sillón con mesa al centro */
  .cuarto {
    position: relative; display: flex; flex-direction: column; justify-content: space-between; align-items: stretch;
    aspect-ratio: 4 / 5; padding: 6px; border: 0; border-radius: 2px; color: var(--text); font: inherit; text-align: left; cursor: pointer;
    background:
      radial-gradient(70% 55% at 50% 52%, color-mix(in oklab, var(--luz) 26%, transparent), transparent 75%),
      linear-gradient(color-mix(in oklab, var(--tono) 10%, var(--piso)), var(--piso));
    transition: box-shadow .2s, filter .2s;
  }
  .abajo .cuarto { aspect-ratio: 6 / 5; flex-direction: column-reverse; }
  .cuarto::after { content: ""; position: absolute; left: 32%; right: 32%; height: 4px; bottom: -4px; background: var(--piso); }
  .abajo .cuarto::after { bottom: auto; top: -4px; }
  .cuarto:hover { filter: brightness(1.25); }
  .cuarto:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; z-index: 1; }
  .cuarto[aria-pressed='true'] { box-shadow: inset 0 0 0 2px var(--luz), 0 0 18px color-mix(in oklab, var(--luz) 45%, transparent); z-index: 1; }

  .cuarto-num { z-index: 1; font-weight: 800; font-size: .95rem; letter-spacing: .04em; text-shadow: 0 1px 3px #000; }
  .cuarto-txt {
    z-index: 1; overflow: hidden; color: var(--luz); font-size: .68rem; font-weight: 600; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap;
    text-shadow: 0 1px 3px #000;
  }
  .pantalla {
    position: absolute; left: 26%; right: 26%; top: 4px; height: 3px; border-radius: 2px;
    background: var(--tono); box-shadow: 0 0 8px var(--tono); opacity: .8;
  }
  .abajo .pantalla { top: auto; bottom: 4px; }
  .sillon {
    position: absolute; left: 50%; top: 52%; width: 52%; height: 32%; transform: translate(-50%, -50%);
    border: 4px solid color-mix(in oklab, var(--tono) 35%, #3a2f55); border-top: 0; border-radius: 0 0 10px 10px;
  }
  .abajo .sillon { top: 48%; width: 42%; border-top: 4px solid color-mix(in oklab, var(--tono) 35%, #3a2f55); border-bottom: 0; border-radius: 10px 10px 0 0; }
  .mesa {
    position: absolute; left: 50%; top: 30%; width: 44%; height: 36%; transform: translateX(-50%); border-radius: 3px;
    background: color-mix(in oklab, var(--luz) 70%, #fff); box-shadow: 0 0 10px var(--luz), 0 0 22px color-mix(in oklab, var(--luz) 50%, transparent);
  }
  .abajo .mesa { top: 34%; }

  .ocupada .mesa { animation: latir 2.4s ease-in-out infinite; }
  .limpieza .mesa, .mant .mesa { box-shadow: none; opacity: .6; }
  .mant { background: repeating-linear-gradient(135deg, rgba(255, 107, 129, .1) 0 6px, transparent 6px 14px), var(--piso); }
  .mant .sillon, .mant .pantalla { opacity: .35; }

  .detalle { border-color: var(--line); }
  @keyframes latir { 50% { opacity: .55; box-shadow: 0 0 4px var(--luz); } }
</style>
