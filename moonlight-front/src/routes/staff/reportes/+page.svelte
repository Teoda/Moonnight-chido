<!-- Reportes financieros semanales (solo Administración). El back genera el PDF cada domingo a las 06:00
     con la semana que terminó; aquí se consultan, se descargan y se puede ver la semana en curso. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { ReporteSemanal } from '#lib/api/types.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { money, fmtFechaHora } from '#lib/utils/formato.ts'
  import { contar, revelar } from '#lib/fx/efectos.ts'
  import { confirmar } from '#lib/components/confirmar.svelte.ts'

  let lista = $state<ReporteSemanal[] | null>(null), error = $state(''), generando = $state(false)

  async function cargar() {
    error = ''
    try { lista = await api.get<ReporteSemanal[]>('/staff/reportes') } catch (e) { error = (e as Error).message }
  }
  $effect(() => { cargar() })

  async function regenerar() {
    if (!await confirmar('Regenerar reporte', 'Se volverá a calcular el reporte de la última semana cerrada con los datos actuales y reemplazará al PDF guardado.', { ok: 'Regenerar' })) return
    generando = true
    try {
      await api.post('/staff/reportes/generar')
      dispatch(avisar('Reporte regenerado', 'ok'))
      await cargar()
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) } finally { generando = false }
  }

  const ultimo = $derived(lista?.[0] ?? null)
  const variacionTxt = (v: number | null) => (v === null ? 'nuevo' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)
  const tono = (v: number | null) => (v === null || v > 0 ? 'ok' : v < 0 ? 'bad' : '')
  const CONCEPTOS = [['Salas', 'salas'], ['Tiempo extra', 'tiempoExtra'], ['Alimentos', 'alimentos'], ['Bebidas', 'bebidas'], ['Paquetes', 'paquetes']] as const
</script>

<div class="row between">
  <h2 class="m-0">Reportes semanales</h2>
  <div class="row">
    <a class="btn sm" href="/api/staff/reportes/en-curso/pdf" download data-sveltekit-reload>Semana en curso (PDF)</a>
    <button class="btn sm" type="button" onclick={regenerar} disabled={generando}>{#if generando}<span class="spinner"></span>{/if}Regenerar última semana</button>
  </div>
</div>
<p class="subtitulo mt-2 max-w-[75ch]">
  Cada domingo a las 06:00 se genera automáticamente el PDF de la semana que terminó (de domingo a sábado, cada día con su madrugada):
  ingresos por salas, alimentos, bebidas y paquetes, descuentos, pagos pendientes, cancelaciones, métodos de pago,
  estados de cuenta y la comparación con la semana anterior.
</p>

{#if error}<div class="empty err">{error}</div>
{:else if !lista}<div class="grid-4">{#each Array(4) as _, i (i)}<div class="skeleton bajo"></div>{/each}</div>
{:else if !ultimo}
  <div class="card empty">Aún no hay reportes. El primero se genera el próximo domingo a las 06:00; mientras tanto puedes descargar la semana en curso.</div>
{:else}
  <section class="card pad-lg mt-2" use:revelar aria-labelledby="t-ultimo">
    <div class="row between">
      <div>
        <h3 id="t-ultimo" class="m-0">Última semana · {ultimo.periodo}</h3>
        <p class="muted small m-0">Generado {fmtFechaHora(ultimo.generadoEn)} · {ultimo.automatico ? 'automático' : 'manual'}</p>
      </div>
      <a class="btn primary" href="/api/staff/reportes/{ultimo.id}/pdf" download data-sveltekit-reload>Descargar PDF <span class="flecha" aria-hidden="true">↓</span></a>
    </div>
    <div class="grid-4 mt-4">
      <div><div class="muted small">Ingresos</div><div class="kpi" use:contar={{ valor: ultimo.ingresos.total, formato: (v) => money(v), dur: 1100 }}></div>
        <span class="badge {tono(ultimo.variacion)}">{variacionTxt(ultimo.variacion)} vs anterior ({money(ultimo.ingresosAnterior)})</span></div>
      <div><div class="muted small">Cobrado neto</div><div class="kpi">{money(ultimo.cobrado)}</div></div>
      <div><div class="muted small">Visitas · cancelaciones</div><div class="kpi">{ultimo.visitas} · {ultimo.cancelaciones}</div></div>
      <div><div class="muted small">Por cobrar</div><div class="kpi" class:text-bad={ultimo.pendiente > 0}>{money(ultimo.pendiente)}</div></div>
    </div>
    <div class="mt-4 grid gap-2">
      {#each CONCEPTOS as [t, k] (k)}
        {@const valor = ultimo.ingresos[k]}
        {@const max = Math.max(1, ...CONCEPTOS.map(([, c]) => ultimo.ingresos[c]))}
        <div class="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-[.9rem]">
          <span class="muted">{t}</span>
          <div class="prog m-0"><div class="h-full rounded-lg bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]" style="width: {(valor / max) * 100}%"></div></div>
          <b class="tabular-nums">{money(valor)}</b>
        </div>
      {/each}
      <p class="muted small m-0">Descuentos aplicados: {money(ultimo.ingresos.descuentos)} · Retenciones por cancelación y no-show: {money(ultimo.ingresos.retenciones)}</p>
    </div>
  </section>

  <div class="card table-wrap mt-4">
    <h3>Historial</h3>
    <table>
      <thead><tr><th>Semana</th><th>Ingresos</th><th>Vs anterior</th><th>Cobrado neto</th><th>Visitas</th><th>Cancelaciones</th><th>Por cobrar</th><th>Generado</th><th></th></tr></thead>
      <tbody>
        {#each lista as r (r.id)}
          <tr>
            <td>{r.periodo}</td>
            <td class="tabular-nums">{money(r.ingresos.total)}</td>
            <td><span class="badge {tono(r.variacion)}">{variacionTxt(r.variacion)}</span></td>
            <td class="tabular-nums">{money(r.cobrado)}</td>
            <td>{r.visitas}</td>
            <td>{r.cancelaciones}</td>
            <td class="tabular-nums" class:text-bad={r.pendiente > 0}>{money(r.pendiente)}</td>
            <td class="small muted">{fmtFechaHora(r.generadoEn)}<br />{r.automatico ? 'automático' : 'manual'}</td>
            <td><a class="btn sm" href="/api/staff/reportes/{r.id}/pdf" download data-sveltekit-reload>PDF</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
