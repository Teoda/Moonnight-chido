<!-- Salas en vivo como plano del edificio, por piso y a escala (medidas del plano): 3er piso premium; 2do piso medianas
     y pequeñas, separadas por el pasillo. Al tocar una sala se ve su detalle. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { SalaStaff } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { musicaTxt } from '#lib/utils/carta.ts'
  import { falta, fmtFecha, fmtHora } from '#lib/utils/formato.ts'
  import { ahora, cambio } from '#lib/fx/efectos.ts'
  import Badge from '#lib/components/Badge.svelte'
  import Progreso from '#lib/components/Progreso.svelte'
  import { cadaQuince, esSuper, puede } from '#lib/components/staff/panel.svelte.ts'

  type Situacion = 'libre' | 'llegando' | 'ocupada' | 'limpieza' | 'mant'
  const LEYENDA: [Situacion, string][] = [['libre', 'Libre'], ['llegando', 'Por llegar'], ['ocupada', 'Ocupada'], ['limpieza', 'Limpieza'], ['mant', 'Mantenimiento']]
  const LLEGANDO_MS = 15 * 60_000

  // plano del edificio: qué tipo de sala va en cada piso y fila, hacia dónde abre la puerta (al pasillo),
  // medidas en metros (ancho × fondo) y color de la luz de cada tipo, como en el plano
  type Puerta = 'abajo' | 'arriba'
  const PISOS: { nombre: string; titulo: string; filas: { tipo: string; puerta: Puerta }[] }[] = [
    { nombre: '3er piso', titulo: 'Salas premium', filas: [{ tipo: 'PREMIUM', puerta: 'abajo' }] },
    { nombre: '2do piso', titulo: 'Salas de karaoke', filas: [{ tipo: 'MEDIANA', puerta: 'abajo' }, { tipo: 'PEQUENA', puerta: 'arriba' }] },
  ]
  const MEDIDAS: Record<string, [number, number]> = { PEQUENA: [4, 5], MEDIANA: [5, 6], PREMIUM: [6, 7] }
  const TONOS: Record<string, string> = { PEQUENA: '#5ec8c0', MEDIANA: '#e8913a', PREMIUM: '#b45cff' }
  const medidas = (codigo: string) => MEDIDAS[codigo] ?? [5, 6]
  const m2 = (codigo: string) => medidas(codigo)[0] * medidas(codigo)[1]

  const usuario = seleccionar((s) => s.sesion.usuario)
  let salas = $state<SalaStaff[] | null>(null), error = $state('')
  let elegida = $state<number | null>(null)
  const ops = $derived(puede($usuario?.rol, 'OPERACIONES') && !esSuper($usuario?.rol)) // el súper administrador solo mira

  // pisos con sus filas de salas; un tipo que no esté en el plano va a un piso aparte para no perderlo
  const pisos = $derived.by(() => {
    const porTipo = new Map<string, SalaStaff[]>()
    for (const s of [...(salas ?? [])].sort((a, b) => a.numero - b.numero)) porTipo.set(s.tipoSala.codigo, [...(porTipo.get(s.tipoSala.codigo) ?? []), s])
    const fila = (tipo: string, puerta: Puerta) => ({ tipo: porTipo.get(tipo)![0].tipoSala, puerta, salas: porTipo.get(tipo)! })
    const enPlano = new Set(PISOS.flatMap((p) => p.filas.map((f) => f.tipo)))
    const otros = [...porTipo.keys()].filter((t) => !enPlano.has(t))
    return [
      ...PISOS.map((p) => ({ nombre: p.nombre, titulo: p.titulo, filas: p.filas.filter((f) => porTipo.has(f.tipo)).map((f) => fila(f.tipo, f.puerta)) })),
      ...(otros.length ? [{ nombre: 'Otras', titulo: 'Salas', filas: otros.map((t) => fila(t, 'abajo')) }] : []),
    ].filter((p) => p.filas.length)
  })
  // metros de la fila más ancha: con eso se calcula la escala (px por metro) de todo el plano
  const anchoMax = $derived(Math.max(1, ...pisos.flatMap((p) => p.filas.map((f) => f.salas.length * medidas(f.tipo.codigo)[0]))))
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

{#snippet ala(a: (typeof pisos)[number]['filas'][number])}
  {@const [ancho, fondo] = medidas(a.tipo.codigo)}
  <section class="ala puerta-{a.puerta}" style:--tono={TONOS[a.tipo.codigo] ?? 'var(--accent)'} style:--a={ancho} style:--f={fondo} aria-label={titulo(a.tipo)}>
    <h4 class="ala-titulo">{titulo(a.tipo)} <span>· {ancho} × {fondo} m</span></h4>
    <div class="ala-salas">
      {#each a.salas as s (s.id)}
        {@const sit = situacion(s, $ahora)}
        {@const txt = rotulo(s, sit, $ahora)}
        <button class="cuarto {sit}" type="button" aria-pressed={elegida === s.numero} aria-label="Sala {s.numero}: {txt}"
          onclick={() => (elegida = elegida === s.numero ? null : s.numero)}>
          <span class="cuarto-num">{String(s.numero).padStart(2, '0')}</span>
          {#if s.limpiezas?.length}<span class="aviso-obs" title="Limpieza dejó una observación" aria-hidden="true">!</span>{/if}
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
      <div class="escala" style:--total={anchoMax}>
        {#each pisos as p (p.nombre)}
          <section class="piso" aria-label="{p.nombre}: {p.titulo}">
            <h3 class="piso-titulo"><b>{p.nombre}</b> – {p.titulo}</h3>
            <div class="piso-salas">
              {#each p.filas as f (f.tipo.id)}{@render ala(f)}{/each}
            </div>
          </section>
        {/each}
      </div>
    </div>
  </div>

  {#if sel}
    {@const actual = enCurso(sel)}
    {@const prox = proxima(sel)}
    {@const [ancho, fondo] = medidas(sel.tipoSala.codigo)}
    {@const piso = pisos.find((p) => p.filas.some((f) => f.tipo.id === sel.tipoSala.id))}
    <div class="card detalle mt-4">
      <div class="row between flex-nowrap items-start">
        <h3 class="m-0 min-w-0">Sala {sel.numero} <span class="muted small font-normal">· {sel.tipoSala.nombre} ({sel.tipoSala.capacidadMin}–{sel.tipoSala.capacidadMax} personas)
          · {ancho.toFixed(2)} × {fondo.toFixed(2)} m ({m2(sel.tipoSala.codigo)} m²){piso ? ` · ${piso.nombre}` : ''}</span></h3>
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
      {#if sel.limpiezas?.[0]}
        {@const o = sel.limpiezas[0]}
        <div class="obs mt-3">
          <p class="small m-0"><b>Observación de limpieza</b> <span class="muted">· {fmtFecha(o.terminadaEn)} {fmtHora(o.terminadaEn)}{o.realizadaPor ? ` · ${o.realizadaPor.nombre}` : ''}</span></p>
          <p class="small m-0 mt-1">{o.observaciones}</p>
        </div>
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
  /* escala real: --m son los px de un metro, calculados para que la fila más ancha llene el plano */
  .lienzo { --muro: #2a2342; --piso: #120e1d; padding: 16px; container-type: inline-size; }
  .escala { --m: calc((100cqi - 40px) / var(--total)); display: grid; gap: 18px; }
  .piso { display: grid; justify-items: center; gap: 12px; }
  .piso + .piso { padding-top: 18px; border-top: 1px dashed var(--line); }
  .piso-titulo {
    justify-self: start; margin: 0; padding: 4px 14px; border: 1px solid color-mix(in oklab, var(--accent) 55%, transparent); border-radius: 999px;
    color: var(--text); font-size: .78rem; font-weight: 500; letter-spacing: .1em; text-transform: uppercase;
  }
  .piso-titulo b { color: var(--accent-2); font-weight: 800; }
  .piso-salas { display: grid; justify-items: center; row-gap: calc(var(--m) * 1.75); } /* pasillo de 1.5 a 2 m */
  .ala { display: grid; justify-items: center; }
  .ala-titulo {
    margin: 0 0 6px; color: var(--tono); font-size: .7rem; font-weight: 700; letter-spacing: .14em; text-align: center; text-transform: uppercase;
    text-shadow: 0 0 10px color-mix(in oklab, var(--tono) 60%, transparent);
  }
  .ala-titulo span { color: var(--muted); font-weight: 500; text-shadow: none; }
  .ala-salas { display: flex; gap: 4px; border: 4px solid var(--muro); border-radius: 6px; background: var(--muro); }

  /* cada cuarto: puerta hacia el pasillo, pantalla en el muro del fondo y sillón con mesa al centro */
  .cuarto {
    position: relative; display: flex; flex-direction: column; justify-content: space-between; align-items: stretch;
    width: calc(var(--m) * var(--a)); aspect-ratio: var(--a) / var(--f); padding: 6px; border: 0; border-radius: 2px; color: var(--text); font: inherit; text-align: left; cursor: pointer;
    background:
      radial-gradient(70% 55% at 50% 52%, color-mix(in oklab, var(--luz) 26%, transparent), transparent 75%),
      linear-gradient(color-mix(in oklab, var(--tono) 10%, var(--piso)), var(--piso));
    transition: box-shadow .2s, filter .2s;
  }
  .puerta-arriba .cuarto { flex-direction: column-reverse; }
  .cuarto::after { content: ""; position: absolute; left: 32%; right: 32%; height: 4px; bottom: -4px; background: var(--piso); }
  .puerta-arriba .cuarto::after { bottom: auto; top: -4px; }
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
  .puerta-arriba .pantalla { top: auto; bottom: 4px; }
  .sillon {
    position: absolute; left: 50%; top: 52%; width: 52%; height: 32%; transform: translate(-50%, -50%);
    border: 4px solid color-mix(in oklab, var(--tono) 35%, #3a2f55); border-top: 0; border-radius: 0 0 10px 10px;
  }
  .puerta-arriba .sillon { top: 48%; width: 42%; border-top: 4px solid color-mix(in oklab, var(--tono) 35%, #3a2f55); border-bottom: 0; border-radius: 10px 10px 0 0; }
  .mesa {
    position: absolute; left: 50%; top: 30%; width: 44%; height: 36%; transform: translateX(-50%); border-radius: 3px;
    background: color-mix(in oklab, var(--luz) 70%, #fff); box-shadow: 0 0 10px var(--luz), 0 0 22px color-mix(in oklab, var(--luz) 50%, transparent);
  }
  .puerta-arriba .mesa { top: 34%; }

  .ocupada .mesa { animation: latir 2.4s ease-in-out infinite; }
  .limpieza .mesa, .mant .mesa { box-shadow: none; opacity: .6; }
  .mant { background: repeating-linear-gradient(135deg, rgba(255, 107, 129, .1) 0 6px, transparent 6px 14px), var(--piso); }
  .mant .sillon, .mant .pantalla { opacity: .35; }

  .detalle { border-color: var(--line); }
  .aviso-obs {
    position: absolute; top: 6px; right: 6px; z-index: 1; display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%;
    background: var(--warn); color: #1a1205; font-size: .7rem; font-weight: 800; box-shadow: 0 0 8px var(--warn);
  }
  .puerta-arriba .aviso-obs { top: auto; bottom: 6px; }
  .obs { padding: 10px 12px; border: 1px solid rgba(255, 181, 71, .45); border-radius: 10px; background: rgba(255, 181, 71, .07); }
  @keyframes latir { 50% { opacity: .55; box-shadow: 0 0 4px var(--luz); } }
  /* (al final para ganarle a las reglas de arriba) teléfono: sin deslizar a los lados; cada fila se vuelve una cuadrícula de 3 salas que llena el ancho
     (se pierde la escala entre tipos, pero cada sala conserva su proporción) */
  @media (width < 48rem) {
    .lienzo { padding: 12px; }
    .piso, .piso-salas, .ala { justify-items: stretch; }
    .piso-salas { row-gap: 18px; }
    .ala-salas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; padding: 3px; border: 0; background: none; }
    .cuarto { width: auto; outline: 3px solid var(--muro); }
    .cuarto::after { display: none; }
  }
</style>
