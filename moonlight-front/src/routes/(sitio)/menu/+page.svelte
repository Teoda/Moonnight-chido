<!-- Carta: Paquetes siempre visibles (lo que más se quiere vender) y debajo las categorías como tarjetas
     visuales; cada una abre un panel con sus productos. Todo sale del catálogo del API; las categorías solo
     deciden cómo se agrupan las secciones (utils/carta.ts → CATEGORIAS_CARTA). -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { cargarCatalogo } from '#lib/store/catalogo.ts'
  import { CATEGORIAS_CARTA, nombreBotella, type CategoriaCarta } from '#lib/utils/carta.ts'
  import { num, slug } from '#lib/utils/formato.ts'
  import TarjetaCategoria, { type CategoriaLista } from '#lib/components/sitio/carta/TarjetaCategoria.svelte'
  import PanelCategoria from '#lib/components/sitio/carta/PanelCategoria.svelte'
  import TarjetaPaquete from '#lib/components/sitio/carta/TarjetaPaquete.svelte'
  import PanelPaquete from '#lib/components/sitio/carta/PanelPaquete.svelte'

  const cat = seleccionar((s) => s.catalogo.datos)
  const estado = seleccionar((s) => s.catalogo.estado)
  const tipoCortesia = $derived($cat?.cortesia ? $cat.tipos.find((t) => t.id === $cat.cortesia!.tipoSalaId) : null)

  // categorías con sus productos (en el orden del catálogo); las vacías no se muestran.
  // Una sección nueva que no esté en CATEGORIAS_CARTA aparece como categoría propia (sin foto) para no perder productos.
  const categorias = $derived.by((): CategoriaLista[] => {
    if (!$cat) return []
    const menu = $cat.menu.filter((p) => p.categoria !== 'PAQUETE')
    const usadas = new Set(CATEGORIAS_CARTA.flatMap((c) => c.secciones))
    const extra = [...new Set(menu.map((p) => p.seccion))].filter((s) => !usadas.has(s))
      .map((s): CategoriaCarta => ({ id: slug(s), nombre: s.split(' · ').pop() || s, descripcion: s.split(' · ')[0], secciones: [s] }))
    return [...CATEGORIAS_CARTA, ...extra].map((c) => {
      const grupos = c.secciones
        .map((seccion) => {
          const [grupo, sub = grupo] = seccion.split(' · ')
          // con pestañas o una sola sección se usa el subgrupo ("Tequila"); si junta varias, el grupo ("Botanas")
          return { seccion, titulo: c.pestanas || c.secciones.length === 1 ? sub : grupo, productos: menu.filter((p) => p.seccion === seccion) }
        })
        .filter((g) => g.productos.length)
      const precios = grupos.flatMap((g) => g.productos.map((p) => num(p.precio)))
      return { ...c, grupos, total: precios.length, desde: precios.length ? Math.min(...precios) : 0 }
    }).filter((c) => c.total)
  })
  const forma = (i: number, total: number) => (i === 0 ? 'grande' : i === total - 1 && total % 2 === 0 ? 'ancha' : 'normal')

  // panel abierto = estado del historial: el botón "atrás" lo cierra y no se sale de la página
  const abierta = $derived(page.state.categoria)
  // shallow: solo cambia el estado del historial (sin navegar, sin mover el scroll ni el foco)
  const abrir = (id: string) => goto('', { state: { categoria: id }, shallow: true })
  const cambiar = (id: string) => goto('', { state: { categoria: id }, shallow: true, replace: true })
  const cerrar = () => history.back()

  // paquetes ordenados por sala (Pequeña → Premium) y, dentro de cada una, en el orden del catálogo
  const paquetes = $derived($cat ? $cat.tipos.flatMap((t) => $cat.menu.filter((p) => p.categoria === 'PAQUETE' && p.tipoSalaId === t.id)) : [])
  const paqueteAbierto = $derived(page.state.paquete)
  const abrirPaquete = (id: number) => goto('', { state: { paquete: id }, shallow: true })
</script>

<svelte:head><title>Carta · Moonlight</title></svelte:head>

<h2 class="mb-1">Carta</h2>
<p class="muted">Pide por adelantado al reservar o desde tu sala durante la visita. Precios en pesos mexicanos (MXN).</p>

{#if !$cat && $estado === 'error'}
  <div class="aviso" role="alert">
    <p class="font-bold">No pudimos cargar la carta.</p>
    <p class="muted">Revisa tu conexión a internet e inténtalo de nuevo.</p>
    <button class="btn" type="button" onclick={() => dispatch(cargarCatalogo())}>Reintentar</button>
  </div>
{:else if !$cat}
  <div class="categorias mt-6" aria-busy="true" aria-label="Cargando la carta">
    {#each Array(6) as _, i (i)}<div class="skeleton {i === 0 ? 'grande' : ''} {i === 5 ? 'ancha' : ''}"></div>{/each}
  </div>
{:else}
  <!-- ── Paquetes: siempre visibles y primero ── -->
  <section class="mb-10" aria-labelledby="t-paquetes">
    <h3 id="t-paquetes" class="titulo-carta">Paquetes</h3>
    <p class="muted small">Consumos sugeridos por tipo de sala. No incluyen la renta de la sala.</p>
    {#if $cat.cortesia?.botellas.length}
      <p class="cortesia-tag">🍾 Toda reservación de Sala {tipoCortesia?.nombre || 'Premium'} incluye una botella de cortesía a elegir:
        {$cat.cortesia.botellas.map((b) => nombreBotella(b.nombre)).join(', ')}.</p>
    {/if}
    <div class="paquetes">
      {#each paquetes as p (p.id)}
        <TarjetaPaquete paquete={p} sala={$cat.tipos.find((t) => t.id === p.tipoSalaId)?.nombre ?? ''}
          abierto={paqueteAbierto === p.id} onabrir={abrirPaquete} />
      {/each}
    </div>
  </section>

  <!-- ── Categorías ── -->
  <section aria-labelledby="t-explora">
    <h3 id="t-explora" class="titulo-carta">Explora la carta</h3>
    <p class="muted small">Elige una categoría para ver sus productos y precios.</p>
    <div class="categorias">
      {#each categorias as c, i (c.id)}
        {@const f = forma(i, categorias.length)}
        <div class="celda {f}"><TarjetaCategoria categoria={c} forma={f} onabrir={abrir} /></div>
      {/each}
    </div>
  </section>

  <p class="mt-6 rounded-[10px] border border-[rgba(255,107,129,.35)] bg-[rgba(255,107,129,.05)] px-3.5 py-3 text-[.88rem] text-muted">
    <b class="mr-1.5 text-bad">+18</b> Venta de bebidas alcohólicas exclusivamente a mayores de edad. Se solicitará identificación oficial.
  </p>

  <PanelCategoria {categorias} {abierta} oncambiar={cambiar} oncerrar={cerrar} />
  <PanelPaquete {paquetes} tipos={$cat.tipos} abierto={paqueteAbierto} oncerrar={cerrar} />
{/if}

<style>
  /* paquetes: 1 columna en teléfono, 2 en tableta, 3 en escritorio (6 paquetes = 3 × 2, filas de igual altura) */
  .paquetes { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
  @media (width >= 40rem) { .paquetes { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (width >= 64rem) { .paquetes { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

  /* categorías: Botellas es la protagonista (2×2 en escritorio, todo el ancho en tableta y teléfono);
     la última ocupa todo el ancho cuando sobra espacio. Teléfono: 2 columnas compactas. */
  .categorias { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 12px; }
  .grande, .ancha { grid-column: 1 / -1; }
  .categorias .skeleton { min-height: 180px; }
  .categorias .skeleton.grande { min-height: 260px; }
  @media (width >= 40rem) { .categorias { gap: 16px; } }
  @media (width >= 64rem) {
    .categorias { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .grande { grid-column: span 2; grid-row: span 2; }
  }

  .aviso { margin-top: 24px; padding: 28px 20px; border: 1px dashed var(--line); border-radius: var(--radius); background: var(--bg-2); text-align: center; }
  .aviso p { margin: 0 0 6px; }
</style>
