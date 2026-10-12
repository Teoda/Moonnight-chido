<!--
  Selector de productos con cantidades, agrupado por sección (desplegables).
  Controlado: recibe `cantidades` y avisa cada cambio con `oncambiar`. Si se indica `tipoSalaId`,
  los paquetes de ese tipo de sala se resaltan y van primero.
-->
<script lang="ts">
  import type { Producto, TipoSala } from '#lib/api/types.ts'
  import { agruparCarta, lineasPaquete, MAX_LINEAS } from '#lib/utils/carta.ts'
  import { money } from '#lib/utils/formato.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { dispatch } from '#lib/store/index.ts'

  let {
    menu, tipos = [], tipoSalaId = null, cantidades, oncambiar,
  }: {
    menu: Producto[]; tipos?: TipoSala[]; tipoSalaId?: number | null
    cantidades: Record<string, number>; oncambiar: (id: number, cantidad: number) => void
  } = $props()

  const grupos = $derived(agruparCarta(menu))
  const nombreTipo = (id: number | null) => tipos.find((t) => t.id === id)?.nombre ?? ''

  function cambiar(p: Producto, delta: number) {
    const actual = cantidades[p.id] || 0
    const nuevo = Math.max(0, Math.min(20, actual + delta))
    if (nuevo && !actual && Object.keys(cantidades).length >= MAX_LINEAS)
      return dispatch(avisar(`Máximo ${MAX_LINEAS} productos distintos por pedido`, 'bad'))
    oncambiar(p.id, nuevo)
  }
  const elegidos = (prods: Producto[]) => prods.reduce((a, p) => a + (cantidades[p.id] || 0), 0)
  const ordenar = (prods: Producto[]) =>
    tipoSalaId ? [...prods].sort((a, b) => Number(b.tipoSalaId === tipoSalaId) - Number(a.tipoSalaId === tipoSalaId)) : prods
</script>

<div>
  {#each [...grupos] as [grupo, subs] (grupo)}
    {@const n = elegidos([...subs.values()].flat())}
    <details class="grupo-carta" open={grupo === 'Paquetes' && !!tipoSalaId}>
      <summary>
        <span>{grupo}</span>
        {#if n}<span class="badge accent ml-auto">{n} elegido{n === 1 ? '' : 's'}</span>{/if}
      </summary>
      {#each [...subs] as [sub, prods] (sub)}
        {#if sub}<div class="sub-carta">{sub}</div>{/if}
        <div class="lista-carta">
          {#each grupo === 'Paquetes' ? ordenar(prods) : prods as p (p.id)}
            {@const mio = !!tipoSalaId && p.tipoSalaId === tipoSalaId}
            <div class="menu-item" class:elegido={(cantidades[p.id] || 0) > 0} class:recomendado={mio}>
              <div>
                <div class="nombre-prod">
                  {p.nombre}
                  {#if p.alcohol}<span class="badge mas18" title="Venta solo a mayores de edad">+18</span>{/if}
                  {#if p.tipoSalaId && tipos.length}
                    <span class="badge ml-1.5 align-[2px] text-[.62rem]" class:ok={mio}>{mio ? 'Para tu sala' : `Sala ${nombreTipo(p.tipoSalaId)}`}</span>
                  {/if}
                </div>
                {#if p.categoria === 'PAQUETE'}<div class="muted small">{lineasPaquete(p).join(' · ')}</div>{/if}
                <div class="small text-gold">{money(p.precio)}</div>
              </div>
              <div class="qty">
                <button type="button" aria-label="Quitar {p.nombre}" onclick={() => cambiar(p, -1)}>−</button>
                <span>{cantidades[p.id] || 0}</span>
                <button type="button" aria-label="Agregar {p.nombre}" onclick={() => cambiar(p, 1)}>+</button>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </details>
  {/each}
</div>
