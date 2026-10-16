<!-- Detalle de un paquete (sobre PanelLateral). "Agregar a mi reservación" usa las acciones existentes del
     asistente de reserva: suma el paquete al pedido anticipado (setCantidad) y, si aún no hay tamaño elegido,
     preselecciona la sala del paquete (elegirTipo). Luego lleva a /reservar. -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import type { Producto, TipoSala } from '#lib/api/types.ts'
  import PanelLateral from './PanelLateral.svelte'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { acciones } from '#lib/store/reserva.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { FOTOS_PAQUETE, lineasPaquete, MAX_LINEAS } from '#lib/utils/carta.ts'
  import { money } from '#lib/utils/formato.ts'

  let { paquetes, tipos, abierto, oncerrar }: {
    paquetes: Producto[]; tipos: TipoSala[]; abierto: number | undefined; oncerrar: () => void
  } = $props()

  const reserva = seleccionar((s) => s.reserva)
  const actual = $derived(paquetes.find((p) => p.id === abierto) ?? null)
  const tipoDe = (p: Producto) => tipos.find((t) => t.id === p.tipoSalaId)
  const capacidad = (t: TipoSala) => (t.capacidadMin === t.capacidadMax ? `${t.capacidadMax} personas` : `${t.capacidadMin} a ${t.capacidadMax} personas`)

  function agregar(p: Producto) {
    const r = $reserva
    const k = String(p.id)
    if (!(k in r.carrito) && Object.keys(r.carrito).length >= MAX_LINEAS)
      return dispatch(avisar(`Tu pedido ya tiene ${MAX_LINEAS} productos distintos, el máximo por reservación`, 'bad'))
    dispatch(acciones.setCantidad({ id: p.id, cantidad: (r.carrito[k] || 0) + 1 }))
    const t = tipoDe(p)
    if (!r.tipoSalaId && t) dispatch(acciones.elegirTipo({ id: t.id, capacidadMax: t.capacidadMax }))
    dispatch(avisar(`${p.nombre} se agregó a tu reservación`, 'ok'))
    goto('/reservar')
  }
</script>

<PanelLateral item={actual} idTitulo="panel-paquete-titulo" etiquetaCerrar={(p) => `Cerrar ${p.nombre}`} {oncerrar}>
  {#snippet barra()}<span class="barra-titulo">Paquetes</span>{/snippet}

  {#snippet children(p)}
    {@const foto = FOTOS_PAQUETE[p.nombre]}
    {@const t = tipoDe(p)}
    <figure class="portada paquete">
      {#if foto}<img src={foto.src} alt={foto.alt} width={foto.ancho} height={foto.alto} decoding="async" />{/if}
    </figure>

    <div class="contenido">
      <div class="etiquetas">
        {#if t}<span class="badge accent">Sala {t.nombre}</span>{/if}
        {#if p.alcohol}<span class="badge warn">Con botella</span><span class="badge mas18">+18</span>{:else}<span class="badge ok">Sin alcohol</span>{/if}
      </div>
      <h2 id="panel-paquete-titulo" class="titulo">{p.nombre}</h2>
      <p class="desc">
        Consumo sugerido{#if t}{' '}para Sala {t.nombre} ({capacidad(t)}){/if}. {p.alcohol ? 'Incluye una botella.' : 'Sin alcohol.'}
        No incluye la renta de la sala.
      </p>

      <h3 class="subtitulo">Incluye</h3>
      <ul class="productos">
        {#each lineasPaquete(p) as l (l)}<li class="producto incluye">{l}</li>{/each}
      </ul>

      <div class="total"><span>Precio del paquete</span><span class="precio">{money(p.precio)}</span></div>

      {#if p.alcohol}
        <p class="nota"><b class="text-bad">+18</b> Venta de bebidas alcohólicas exclusivamente a mayores de edad. Se solicitará identificación oficial.</p>
      {/if}
    </div>
  {/snippet}

  {#snippet pie(p)}
    {@const cantidad = $reserva.carrito[String(p.id)] || 0}
    <p class="pie-texto">{cantidad ? `Ya tienes ${cantidad} en tu reservación.` : 'Se suma al pedido de tu reservación.'}</p>
    <button type="button" class="btn primary" onclick={() => agregar(p)}>{cantidad ? 'Agregar otro' : 'Agregar a mi reservación'}</button>
  {/snippet}
</PanelLateral>

<style>
  .barra-titulo { padding-left: 6px; color: var(--muted); font-size: .9rem; font-weight: 600; }
  /* la foto trae su propio marco redondeado: un zoom leve lo deja fuera del recorte */
  .portada.paquete { aspect-ratio: 900 / 366; }
  .portada.paquete img { transform: scale(1.07); }
  .etiquetas { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .subtitulo { margin: 4px 0 8px; color: var(--color-lila); font-size: .95rem; }
  .producto.incluye { position: relative; padding-left: 34px; }
  .producto.incluye::before { content: ""; position: absolute; left: 15px; top: 50%; width: 7px; height: 7px; margin-top: -3.5px; border-radius: 50%; background: var(--gold); }
  .total {
    display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-top: 16px; padding: 14px;
    border: 1px solid rgba(255, 194, 61, .35); border-radius: 12px; background: rgba(255, 194, 61, .06);
  }
  .total span:first-child { color: var(--text); font-weight: 600; }
  .total .precio { font-size: 1.5rem; }
</style>
