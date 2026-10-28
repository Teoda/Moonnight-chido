<!-- Moonlight por las patitas (solo súper administración): el vidrio reciclado de la semana, lo obtenido y lo donado
     a organizaciones que ayudan a perros en situación de calle. Datos simulados por la API (moonlight-db/src/patitas.ts). -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { Patitas } from '#lib/api/types.ts'
  import { fmtFecha, money } from '#lib/utils/formato.ts'
  import { tarjetas } from '#lib/fx/efectos.ts'

  let datos = $state<Patitas | null>(null), error = $state('')
  $effect(() => { api.get<Patitas>('/staff/patitas').then((d) => (datos = d), (e) => (error = (e as Error).message)) })

  const PASOS = ['Consumo', 'Separación del vidrio', 'Almacenamiento', 'Reciclaje', 'Recursos', 'Apoyo a perritos']
  const totalKg = $derived(datos?.historial.reduce((a, s) => a + s.kilos, 0) ?? 0)
  const totalDonado = $derived(datos?.historial.reduce((a, s) => a + s.donado, 0) ?? 0)
  const maxKg = $derived(Math.max(1, ...(datos?.historial.map((s) => s.kilos) ?? [])))
</script>

<div class="row between">
  <h2>Moonlight por las patitas</h2>
  {#if datos?.simulado}<span class="badge warn">Datos de ejemplo</span>{/if}
</div>
<p class="muted small mt-1 max-w-[70ch]">"Tu noche también puede ayudar a una patita." El vidrio de las botellas se separa y se vende al reciclador; parte de lo obtenido se dona a organizaciones locales de alimentación, rescate y cuidado de perros en situación de calle. Todavía no se registra en el sistema; los números son de prueba.</p>

<ol class="pasos" aria-label="Cómo funciona">
  {#each PASOS as p, i (p)}<li><span>{i + 1}</span>{p}</li>{/each}
</ol>

{#if error}<div class="card empty err">{error}</div>
{:else if !datos}<div class="skeleton bajo"></div>
{:else}
  <div class="kpis">
    <div class="card dato"><span class="small muted">Vidrio esta semana</span><b>{datos.semana.kilos} kg</b></div>
    <div class="card dato"><span class="small muted">Obtenido esta semana</span><b>{money(datos.semana.obtenido)}</b></div>
    <div class="card dato verde"><span class="small muted">Donado esta semana</span><b>{money(datos.semana.donado)}</b></div>
    <div class="card dato"><span class="small muted">Últimas 8 semanas</span><b>{totalKg} kg · {money(totalDonado)}</b></div>
  </div>

  <div class="contenido">
    <div class="card">
      <h3>Vidrio reciclado por semana</h3>
      <div class="barras" role="img" aria-label="Kilos de vidrio reciclados en las últimas 8 semanas">
        {#each datos.historial as s (s.desde)}
          <div class="barra"><b>{s.kilos}</b><i style:height="{(s.kilos / maxKg) * 100}%"></i><span>{fmtFecha(s.desde).replace(/^\S+\s/, '')}</span></div>
        {/each}
      </div>
    </div>

    <div class="card table-wrap">
      <h3>Movimientos de esta semana</h3>
      {#if !datos.semana.entregas.length && !datos.semana.donaciones.length}<p class="muted small m-0">Aún no hay movimientos esta semana.</p>
      {:else}
        <table use:tarjetas>
          <thead><tr><th>Fecha</th><th>Movimiento</th><th class="text-right">Kilos</th><th class="text-right">Monto</th></tr></thead>
          <tbody>
            {#each datos.semana.entregas as e (e.fecha)}
              <tr><td>{fmtFecha(e.fecha)}</td><td>Entrega de vidrio al reciclador</td><td class="text-right">{e.kilos}</td><td class="text-right tabular-nums">{money(e.obtenido)}</td></tr>
            {/each}
            {#each datos.semana.donaciones as d (d.fecha)}
              <tr><td>{fmtFecha(d.fecha)}</td><td>🐾 Donación a {d.organizacion} ({d.destino})</td><td class="text-right">-</td><td class="text-right tabular-nums">{money(d.monto)}</td></tr>
            {/each}
          </tbody>
        </table>
        <p class="muted small mt-2 mb-0">También aparece en el reporte semanal (PDF).</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .pasos { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; padding: 0; list-style: none; }
  .pasos li { display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg-2); font-size: .85rem; }
  .pasos span { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: color-mix(in oklab, var(--ok) 25%, transparent); color: var(--ok); font-size: .75rem; font-weight: 800; }
  .kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr)); }
  .dato { display: grid; gap: 2px; padding: 12px 16px; }
  .dato b { font-size: 1.35rem; }
  .dato.verde { border-color: color-mix(in oklab, var(--ok) 50%, transparent); }
  .dato.verde b { color: var(--ok); }
  .contenido { display: grid; gap: 16px; margin-top: 16px; }
  @media (width >= 64rem) { .contenido { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: start; } }
  .barras { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); align-items: end; gap: 8px; height: 200px; }
  .barra { display: grid; grid-template-rows: auto 1fr auto; justify-items: center; gap: 4px; height: 100%; font-size: .72rem; }
  .barra b { font-weight: 600; }
  .barra i { align-self: end; width: 100%; max-width: 34px; border-radius: 6px 6px 2px 2px; background: linear-gradient(var(--ok), color-mix(in oklab, var(--ok) 45%, transparent)); }
  .barra span { color: var(--muted); white-space: nowrap; }
</style>
