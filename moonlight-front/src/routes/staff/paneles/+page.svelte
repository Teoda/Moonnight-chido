<!-- Paneles solares (solo súper administrador): los 15 paneles del techo con un marco de color según su estado.
     Por ahora con datos de ejemplo; cuando haya inversor conectado, la lista vendrá de la API. -->
<script lang="ts">
  import { fmtFecha } from '#lib/utils/formato.ts'

  type Estado = 'ok' | 'revisar' | 'reparacion'
  interface Panel { numero: number; estado: Estado; watts: number; revisado: string; nota?: string }

  const NOMINAL = 550 // W por panel
  const ESTADOS: Record<Estado, { nombre: string; texto: string }> = {
    ok: { nombre: 'Funcionando', texto: 'Funciona correctamente.' },
    revisar: { nombre: 'Posible mantenimiento', texto: 'Produce menos de lo esperado; conviene revisarlo.' },
    reparacion: { nombre: 'En reparación', texto: 'Fuera de servicio hasta que lo reparen.' },
  }

  // datos de ejemplo
  const PANELES: Panel[] = [
    { numero: 1, estado: 'ok', watts: 468, revisado: '2026-10-02' },
    { numero: 2, estado: 'ok', watts: 472, revisado: '2026-10-02' },
    { numero: 3, estado: 'ok', watts: 455, revisado: '2026-10-02' },
    { numero: 4, estado: 'revisar', watts: 301, revisado: '2026-09-18', nota: 'Suciedad acumulada: produce 35 % menos que sus vecinos.' },
    { numero: 5, estado: 'ok', watts: 461, revisado: '2026-10-02' },
    { numero: 6, estado: 'ok', watts: 470, revisado: '2026-10-02' },
    { numero: 7, estado: 'ok', watts: 466, revisado: '2026-10-02' },
    { numero: 8, estado: 'reparacion', watts: 0, revisado: '2026-10-15', nota: 'Vidrio estrellado por granizo. Técnico agendado; refacción en camino.' },
    { numero: 9, estado: 'ok', watts: 459, revisado: '2026-10-02' },
    { numero: 10, estado: 'ok', watts: 463, revisado: '2026-10-02' },
    { numero: 11, estado: 'ok', watts: 457, revisado: '2026-10-02' },
    { numero: 12, estado: 'revisar', watts: 268, revisado: '2026-09-18', nota: 'Conector con temperatura alta en la última revisión.' },
    { numero: 13, estado: 'ok', watts: 471, revisado: '2026-10-02' },
    { numero: 14, estado: 'revisar', watts: 322, revisado: '2026-09-18', nota: 'Sombra parcial por la tarde (árbol del vecino).' },
    { numero: 15, estado: 'ok', watts: 464, revisado: '2026-10-02' },
  ]

  let elegido = $state<number | null>(null)
  const sel = $derived(PANELES.find((p) => p.numero === elegido) ?? null)
  const total = PANELES.reduce((s, p) => s + p.watts, 0)
  const cuenta = (e: Estado) => PANELES.filter((p) => p.estado === e).length
  const kw = (w: number) => `${(w / 1000).toLocaleString('es-MX', { maximumFractionDigits: 2 })} kW`
</script>

<div class="row between">
  <h2>Paneles solares</h2>
  <span class="badge warn">Datos de ejemplo</span>
</div>
<p class="muted small mt-1">Así se verá el estado de los paneles del techo. Todavía no están conectados al sistema; los números de abajo son de prueba.</p>

<div class="resumen">
  <div class="card dato"><span class="small muted">Produciendo ahora</span><b>{kw(total)}</b><span class="small muted">de {kw(NOMINAL * PANELES.length)} posibles</span></div>
  <ul class="leyenda" aria-label="Estado de los paneles">
    {#each Object.entries(ESTADOS) as [k, e] (k)}<li class={k}><i aria-hidden="true"></i>{e.nombre} <b>{cuenta(k as Estado)}</b></li>{/each}
  </ul>
</div>

<div class="techo" role="group" aria-label="Paneles del techo">
  {#each PANELES as p (p.numero)}
    <button class="panel {p.estado}" type="button" aria-pressed={elegido === p.numero}
      aria-label="Panel {p.numero}: {ESTADOS[p.estado].nombre}, {p.watts} W" onclick={() => (elegido = elegido === p.numero ? null : p.numero)}>
      <span class="celdas" aria-hidden="true"></span>
      <span class="panel-num">{String(p.numero).padStart(2, '0')}</span>
    </button>
  {/each}
</div>

{#if sel}
  <div class="card detalle mt-4 {sel.estado}">
    <div class="row between">
      <h3 class="m-0">Panel {sel.numero}</h3>
      <button class="x" type="button" aria-label="Cerrar detalle" onclick={() => (elegido = null)}>×</button>
    </div>
    <p class="estado-txt mt-2 mb-0"><i aria-hidden="true"></i><b>{ESTADOS[sel.estado].nombre}</b></p>
    <p class="small muted mt-1 mb-2">{ESTADOS[sel.estado].texto}</p>
    <div class="prog" aria-hidden="true"><div class="prog-fill" style:width="{(sel.watts / NOMINAL * 100).toFixed(0)}%"></div></div>
    <p class="small m-0">Produciendo <b>{sel.watts} W</b> de {NOMINAL} W · Última revisión: {fmtFecha(sel.revisado + 'T12:00:00')}</p>
    {#if sel.nota}<p class="small muted mt-2 mb-0">{sel.nota}</p>{/if}
  </div>
{:else}
  <p class="small muted mt-3">Toca un panel para ver cuánto produce, su última revisión y notas.</p>
{/if}

<style>
  .ok { --luz: var(--ok); }
  .revisar { --luz: var(--warn); }
  .reparacion { --luz: var(--bad); }

  .resumen { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin: 16px 0; }
  .dato { display: grid; gap: 2px; padding: 12px 16px; }
  .dato b { font-size: 1.5rem; }
  .leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; font-size: .88rem; color: var(--muted); }
  .leyenda li { display: flex; align-items: center; gap: 6px; }
  .leyenda i, .estado-txt i { width: 10px; height: 10px; border-radius: 3px; background: var(--luz); box-shadow: 0 0 8px var(--luz); }
  .leyenda b { color: var(--text); }
  .estado-txt { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }

  /* el techo: 3 filas de 5 paneles sobre la lámina */
  .techo {
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: clamp(6px, 1.6vw, 14px); max-width: 720px;
    padding: clamp(10px, 2.5vw, 22px); border: 1px solid var(--line); border-radius: var(--radius);
    background: repeating-linear-gradient(90deg, #15121f 0 22px, #1b1728 22px 24px), #15121f;
  }
  /* cada panel: marco de aluminio, celdas azules y por fuera el recubrimiento de color del estado */
  .panel {
    position: relative; aspect-ratio: 5 / 8; padding: 3px; border: 3px solid var(--luz); border-radius: 6px; cursor: pointer;
    background: linear-gradient(135deg, #c9ccd6, #8a8f9e); font: inherit;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), 0 0 14px color-mix(in oklab, var(--luz) 55%, transparent);
    transition: transform .2s, box-shadow .2s;
  }
  .celdas {
    position: absolute; inset: 3px; border-radius: 2px;
    background:
      linear-gradient(125deg, rgba(255, 255, 255, .22), transparent 40%),
      repeating-linear-gradient(0deg, transparent 0 calc(16.66% - 1px), rgba(200, 215, 255, .35) calc(16.66% - 1px) 16.66%),
      repeating-linear-gradient(90deg, transparent 0 calc(33.33% - 1px), rgba(200, 215, 255, .35) calc(33.33% - 1px) 33.33%),
      linear-gradient(160deg, #1f3f8f, #0e1f52);
  }
  .reparacion .celdas { filter: grayscale(.7) brightness(.6); }
  .reparacion .celdas::after { content: "✕"; position: absolute; inset: 0; display: grid; place-items: center; color: var(--bad); font-size: 1.6rem; font-weight: 700; }
  .panel-num {
    position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); padding: 1px 6px; border-radius: 4px;
    background: rgba(0, 0, 0, .6); color: #fff; font-size: .72rem; font-weight: 700;
  }
  .panel.revisar { animation: aviso 2.4s ease-in-out infinite; }
  .panel:hover { transform: translateY(-3px); }
  .panel:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .panel[aria-pressed='true'] { transform: translateY(-3px); box-shadow: 0 0 0 2px var(--text), 0 0 22px var(--luz); }

  .detalle { max-width: 720px; border-left: 4px solid var(--luz); }
  .prog-fill { background: var(--luz); }
  @keyframes aviso { 50% { box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), 0 0 4px color-mix(in oklab, var(--luz) 30%, transparent); } }
</style>
