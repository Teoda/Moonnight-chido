<!-- Finanzas: ingresos netos, reservaciones por estado y pagos por tipo y método. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { Kpis } from '#lib/api/types.ts'
  import { estadoTxt, metodoTxt } from '#lib/utils/estados.ts'
  import { money } from '#lib/utils/formato.ts'
  import { contar, inclinar, revelar } from '#lib/fx/efectos.ts'
  import Badge from '#lib/components/Badge.svelte'

  let k = $state<Kpis | null>(null), error = $state('')
  async function cargar() {
    k = null; error = ''
    try { k = await api.get<Kpis>('/staff/kpis') } catch (e) { error = (e as Error).message }
  }
  $effect(() => { cargar() })
</script>

<div class="row between"><h2>Finanzas</h2><button class="btn sm" type="button" onclick={cargar}>Actualizar</button></div>

{#if error}<div class="empty err">{error}</div>
{:else if !k}<div class="grid-4">{#each Array(4) as _, i (i)}<div class="skeleton bajo"></div>{/each}</div>
{:else}
  <div class="grid-4">
    <div class="card" use:revelar use:inclinar><div class="muted small">Ingresos netos</div><div class="kpi" use:contar={{ valor: Number(k.ingresosNetos), dur: 1200 }}></div></div>
    {#each Object.entries(k.reservacionesPorEstado) as [e, n] (e)}
      <div class="card" use:revelar use:inclinar><div class="muted small">{estadoTxt(e)}</div><div class="kpi" use:contar={{ valor: n, formato: (v) => String(Math.round(v)), dur: 900 }}></div></div>
    {/each}
  </div>
  <div class="card table-wrap mt-4">
    <h3>Pagos por tipo y método</h3>
    <table>
      <thead><tr><th>Tipo</th><th>Método</th><th>Estado</th><th>Monto</th></tr></thead>
      <tbody>
        {#each k.pagos as p, i (i)}
          <tr><td>{p.tipo.replace(/_/g, ' ').toLowerCase()}</td><td>{metodoTxt(p.metodo)}</td><td><Badge estado={p.estado} /></td><td>{money(p.monto)}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
