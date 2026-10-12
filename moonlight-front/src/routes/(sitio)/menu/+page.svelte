<!-- Carta: paquetes por tipo de sala, botellas, refrescos y botanas. -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'
  import { agruparCarta, lineasPaquete, nombreBotella, ordenGrupos } from '#lib/utils/carta.ts'
  import { money, slug } from '#lib/utils/formato.ts'
  import { inclinar, revelar } from '#lib/fx/efectos.ts'

  const cat = seleccionar((s) => s.catalogo.datos)
  const grupos = $derived($cat ? agruparCarta($cat.menu) : new Map())
  const nombres = $derived(ordenGrupos(grupos))
  const tipoCortesia = $derived($cat?.cortesia ? $cat.tipos.find((t) => t.id === $cat.cortesia!.tipoSalaId) : null)

  const ir = (g: string) => document.getElementById(`carta-${slug(g)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
</script>

<svelte:head><title>Carta · Moonlight</title></svelte:head>

<h2>Carta</h2>
<figure class="banner-foto">
  <img src="/img/lugar/bar.jpg" alt="Bar de Moonlight con barra iluminada, botellas y lounge" width="1200" height="675" loading="lazy" />
</figure>
<p class="muted">Pide por adelantado al reservar o desde tu sala durante la visita. Precios en pesos mexicanos (MXN).</p>

{#if !$cat}
  <div class="grid-3">{#each Array(3) as _, i (i)}<div class="skeleton"></div>{/each}</div>
{:else}
  <div class="chips mb-2">
    {#each nombres as g (g)}<button class="chip" type="button" onclick={() => ir(g)}>{g}</button>{/each}
  </div>

  {#each nombres as g (g)}
    <section class="mb-7 scroll-mt-24" id="carta-{slug(g)}">
      <h3 class="titulo-carta">{g}</h3>
      {#if g === 'Paquetes'}
        <p class="muted small">Consumos sugeridos por tipo de sala. No incluyen la renta de la sala.</p>
        {#if $cat.cortesia?.botellas.length}
          <p class="cortesia-tag">🍾 Toda reservación de Sala {tipoCortesia?.nombre || 'Premium'} incluye una botella de cortesía a elegir:
            {$cat.cortesia.botellas.map((b) => nombreBotella(b.nombre)).join(', ')}.</p>
        {/if}
        <div class="grid-3">
          {#each $cat.tipos as t (t.id)}
            {#each $cat.menu.filter((p) => p.categoria === 'PAQUETE' && p.tipoSalaId === t.id) as p (p.id)}
              <article class="card flex flex-col {p.alcohol ? 'border-[rgba(255,194,61,.35)]' : ''}" use:revelar use:inclinar>
                <div class="row between">
                  <span class="badge accent">Sala {t.nombre}</span>
                  {#if p.alcohol}
                    <span class="row gap-1.5"><span class="badge warn">Con botella</span><span class="badge mas18">+18</span></span>
                  {:else}
                    <span class="badge ok">Sin alcohol</span>
                  {/if}
                </div>
                <h3 class="mt-3 mb-2">{p.nombre}</h3>
                <ul class="mb-2 list-disc pl-[18px] text-[.9rem] text-muted">
                  {#each lineasPaquete(p) as l (l)}<li class="mb-1">{l}</li>{/each}
                </ul>
                <div class="price mt-auto pt-2.5 text-gold">{money(p.precio)}</div>
              </article>
            {/each}
          {/each}
        </div>
      {:else}
        <div class="grid-3">
          {#each [...grupos.get(g)] as [sub, prods] (sub)}
            <div class="card" use:revelar use:inclinar>
              {#if sub}<h3>{sub} {#if prods.some((p: { alcohol: boolean }) => p.alcohol)}<span class="badge mas18">+18</span>{/if}</h3>{/if}
              {#each prods as p (p.id)}
                <div class="menu-item"><span>{nombreBotella(p.nombre)}</span><b>{money(p.precio)}</b></div>
              {/each}
            </div>
          {/each}
        </div>
        {#if g === 'Botellas'}
          <p class="muted small mt-2">Botellas de 700–750 ml aprox. según marca. Pregunta en barra si hielo, vasos y mezcladores se cobran por separado.</p>
        {/if}
      {/if}
    </section>
  {/each}

  <p class="mt-4.5 rounded-[10px] border border-[rgba(255,107,129,.35)] bg-[rgba(255,107,129,.05)] px-3.5 py-3 text-[.88rem] text-muted">
    <b class="mr-1.5 text-bad">+18</b> Venta de bebidas alcohólicas exclusivamente a mayores de edad. Se solicitará identificación oficial.
  </p>
{/if}
