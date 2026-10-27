<!-- Paneles solares (solo súper administración): los 15 paneles del techo con un marco de color según su estado
     y las reparaciones de la semana. Los datos vienen de la API, que por ahora los simula (moonlight-db/src/paneles.ts). -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { EstadoPanel, PanelesSolares } from '#lib/api/types.ts'
  import { fmtFecha, money } from '#lib/utils/formato.ts'
  import { tarjetas } from '#lib/fx/efectos.ts'

  const ESTADOS: Record<EstadoPanel, { nombre: string; texto: string }> = {
    ok: { nombre: 'Funcionando', texto: 'Funciona correctamente.' },
    revisar: { nombre: 'Posible mantenimiento', texto: 'Produce menos de lo esperado; conviene revisarlo.' },
    reparacion: { nombre: 'En reparación', texto: 'Fuera de servicio hasta que lo reparen.' },
  }

  let datos = $state<PanelesSolares | null>(null), error = $state('')
  let elegido = $state<number | null>(null)
  $effect(() => { api.get<PanelesSolares>('/staff/paneles').then((d) => (datos = d), (e) => (error = (e as Error).message)) })

  const paneles = $derived(datos?.paneles ?? [])
  const nominal = $derived(datos?.nominal ?? 0)
  const sel = $derived(paneles.find((p) => p.numero === elegido) ?? null)
  const total = $derived(paneles.reduce((s, p) => s + p.watts, 0))
  const cuenta = (e: EstadoPanel) => paneles.filter((p) => p.estado === e).length
  const kw = (w: number) => `${(w / 1000).toLocaleString('es-MX', { maximumFractionDigits: 2 })} kW`
</script>

<div class="row between">
  <h2>Paneles solares</h2>
  {#if datos?.simulado}<span class="badge warn">Datos de ejemplo</span>{/if}
</div>
<p class="muted small mt-1">Estado de los paneles del techo. Todavía no están conectados al sistema; los números son de prueba.</p>

{#if error}<div class="card empty err">{error}</div>
{:else if !datos}<div class="skeleton techo-cargando"></div>
{:else}
  <div class="resumen">
    <div class="card dato"><span class="small muted">Produciendo ahora</span><b>{kw(total)}</b><span class="small muted">de {kw(nominal * paneles.length)} posibles</span></div>
    <ul class="leyenda" aria-label="Estado de los paneles">
      {#each Object.entries(ESTADOS) as [k, e] (k)}<li class={k}><i aria-hidden="true"></i>{e.nombre} <b>{cuenta(k as EstadoPanel)}</b></li>{/each}
    </ul>
  </div>

  <div class="contenido">
  <div class="techo" role="group" aria-label="Paneles del techo">
    {#each paneles as p (p.numero)}
      <button class="panel {p.estado}" type="button" aria-pressed={elegido === p.numero}
        aria-label="Panel {p.numero}: {ESTADOS[p.estado].nombre}, {p.watts} W" onclick={() => (elegido = elegido === p.numero ? null : p.numero)}>
        <span class="celdas" aria-hidden="true"></span>
        <span class="panel-num">{String(p.numero).padStart(2, '0')}</span>
      </button>
    {/each}
  </div>

  <aside class="lateral">
  {#if sel}
    {@const reps = datos.reparaciones.filter((r) => r.panel === sel.numero)}
    <div class="card detalle {sel.estado}">
      <div class="row between">
        <h3 class="m-0">Panel {sel.numero}</h3>
        <button class="x" type="button" aria-label="Cerrar detalle" onclick={() => (elegido = null)}>×</button>
      </div>
      <p class="estado-txt mt-2 mb-0"><i aria-hidden="true"></i><b>{ESTADOS[sel.estado].nombre}</b></p>
      <p class="small muted mt-1 mb-2">{ESTADOS[sel.estado].texto}</p>
      <div class="prog" aria-hidden="true"><div class="prog-fill" style:width="{(sel.watts / nominal * 100).toFixed(0)}%"></div></div>
      <p class="small m-0">Produciendo <b>{sel.watts} W</b> de {nominal} W · Última revisión: {fmtFecha(sel.revisado + 'T12:00:00')}</p>
      {#if sel.nota}<p class="small muted mt-2 mb-0">{sel.nota}</p>{/if}
      {#each reps as r (r.fecha)}<p class="small mt-2 mb-0">🔧 {r.tipo} · {r.detalle} · {r.estado} · {money(r.costo)}</p>{/each}
    </div>
  {:else}
    <div class="card atencion">
      <h3 class="m-0">Requieren atención</h3>
      <p class="small muted mt-1">Toca un panel para ver cuánto produce, su última revisión y notas.</p>
      <ul>
        {#each paneles.filter((p) => p.estado !== 'ok') as p (p.numero)}
          <li class={p.estado}>
            <button type="button" onclick={() => (elegido = p.numero)}>
              <i aria-hidden="true"></i><span><b>Panel {p.numero}</b> · {ESTADOS[p.estado].nombre}</span>
              {#if p.nota}<span class="nota small muted">{p.nota}</span>{/if}
            </button>
          </li>
        {:else}<li class="small muted">Todos los paneles funcionan correctamente.</li>{/each}
      </ul>
    </div>
  {/if}
  </aside>
  </div>

  <div class="card table-wrap mt-4 reparaciones">
    <h3>Reparaciones y mantenimiento de esta semana</h3>
    {#if !datos.reparaciones.length}<p class="muted small m-0">Sin reparaciones esta semana.</p>
    {:else}
      <table use:tarjetas>
        <thead><tr><th>Panel</th><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th class="text-right">Costo</th></tr></thead>
        <tbody>
          {#each datos.reparaciones as r (r.fecha)}
            <tr><td>{r.panel}</td><td>{fmtFecha(r.fecha)}</td><td>{r.tipo}</td><td>{r.detalle}</td><td>{r.estado}</td><td class="text-right tabular-nums">{money(r.costo)}</td></tr>
          {/each}
          <tr><td colspan="5"><b>Total</b></td><td class="text-right tabular-nums"><b>{money(datos.reparaciones.reduce((a, r) => a + r.costo, 0))}</b></td></tr>
        </tbody>
      </table>
      <p class="muted small mt-2 mb-0">También aparecen en el reporte semanal (PDF).</p>
    {/if}
  </div>
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
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: clamp(6px, 1.6vw, 14px); align-content: start;
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

  .detalle { border-left: 4px solid var(--luz); }
  .techo-cargando { height: 420px; border-radius: var(--radius); }

  /* computadora: techo a la izquierda y columna lateral fija con el detalle; en pantallas chicas, uno debajo del otro */
  .contenido { display: grid; gap: 16px; }
  @media (width >= 64rem) {
    .contenido { grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); align-items: start; }
    .lateral { position: sticky; top: 16px; }
    .panel { aspect-ratio: 5 / 7; }
  }
  .atencion ul { display: grid; gap: 6px; margin: 12px 0 0; padding: 0; list-style: none; }
  .atencion button {
    display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 8px; width: 100%; padding: 8px 10px;
    border: 1px solid var(--line); border-left: 3px solid var(--luz); border-radius: 10px; background: var(--bg-2); color: var(--text);
    font: inherit; font-size: .9rem; text-align: left; cursor: pointer; transition: background .15s;
  }
  .atencion button:hover { background: var(--card-2); }
  .atencion button i { width: 10px; height: 10px; border-radius: 3px; background: var(--luz); box-shadow: 0 0 8px var(--luz); }
  .atencion .nota { grid-column: 2; }
  .prog-fill { background: var(--luz); }
  @keyframes aviso { 50% { box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), 0 0 4px color-mix(in oklab, var(--luz) 30%, transparent); } }
</style>
