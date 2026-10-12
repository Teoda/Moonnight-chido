<!-- Inicio: hero con el logotipo neón, pasos, tipos de sala, conócenos y ubicación. -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'
  import { conCortesia, FOTOS_TIPO, resumenHorario } from '#lib/utils/carta.ts'
  import { money, num } from '#lib/utils/formato.ts'
  import { contar, inclinar, revelar } from '#lib/fx/efectos.ts'
  import Rotador from '#lib/components/Rotador.svelte'

  const cat = seleccionar((s) => s.catalogo.datos)
  const precios = $derived($cat?.tipos.map((t) => num(t.precioHora)) ?? [])
</script>

<svelte:head><title>Moonlight · Karaoke &amp; Social Lounge</title></svelte:head>

<section class="grid items-center gap-8 pt-4 pb-8 md:grid-cols-[1.2fr_1fr] md:pt-10 md:pb-14">
  <div>
    <div class="mb-3.5 inline-flex items-center gap-2 rounded-full border border-line bg-[rgba(26,24,56,.6)] px-3.5 py-1.5 text-[.95rem] text-muted">
      <span class="dot-vivo" aria-hidden="true"></span>Esta noche suena <Rotador palabras={$cat?.tematicas.map((t) => t.nombre) ?? []} />
    </div>
    <h1 class="text-[clamp(2rem,5vw,3.4rem)]">Canta bajo la luz de <span class="neon-titila">Moonlight</span></h1>
    <p class="tagline">Karaoke &amp; Social Lounge</p>
    <p class="max-w-[52ch] text-[1.1rem] text-muted">
      Salas privadas de karaoke ambientadas con la música que tú eliges: regional, reguetón, pop, banda, rock, K-Pop y más.
      Escoge el tamaño de tu sala, tu horario y llega a cantar.
    </p>
    <div class="row">
      <a class="btn primary lg" href="/reservar">Reservar sala</a>
      <a class="btn lg" href="/salas">Ver salas</a>
    </div>
    {#if $cat}
      <div class="mt-5 flex flex-wrap gap-5 text-[.9rem] text-muted">
        <div><b class="block text-[1.2rem] text-texto">{resumenHorario($cat.horarios) || 'Por confirmar'}</b>Horario</div>
        <div>
          <b class="block text-[1.2rem] text-texto" use:contar={{ valor: $cat.tipos.length, formato: (v) => `${Math.round(v)} tamaños` }}></b>
          De {Math.min(...$cat.tipos.map((t) => t.capacidadMin))} a {Math.max(...$cat.tipos.map((t) => t.capacidadMax))} personas
        </div>
        {#if precios.length}
          <div><b class="block text-[1.2rem] text-texto" use:contar={{ valor: Math.min(...precios), formato: (v) => `desde ${money(Math.round(v))}`, dur: 1100 }}></b>por hora</div>
        {/if}
      </div>
    {/if}
  </div>
  <div class="escena relative w-full max-w-[340px] justify-self-center md:max-w-[480px]">
    <img class="logo-img logo-hero w-full" src="/img/logo.jpg" alt="Moonlight Karaoke &amp; Social Lounge" width="1000" height="607" />
    <div class="notas pointer-events-none absolute inset-0" aria-hidden="true"><span>♪</span><span>♫</span><span>♪</span><span>♬</span></div>
    <div class="eq mt-4 flex h-[46px] items-end justify-center gap-1.5" aria-hidden="true">
      {#each Array(12) as _, i (i)}<i></i>{/each}
    </div>
  </div>
</section>

<div class="grid-auto">
  <div class="card" use:revelar><h3>1 · Elige</h3><p class="muted">El tamaño de tu sala, el horario y tu música: un género o tu propia lista de artistas y canciones.</p></div>
  <div class="card" use:revelar>
    <h3>2 · Paga en línea</h3>
    <p class="muted">
      {#if $cat}Solo el {$cat.reglas.anticipoSalaPct}% de la sala y, si pides alimentos o bebidas, el {$cat.reglas.anticipoPedidoPct}% de tu pedido. El resto lo pagas al llegar.
      {:else}Un anticipo de la sala y, si quieres, de tu pedido de alimentos y bebidas.{/if}
    </p>
  </div>
  <div class="card" use:revelar><h3>3 · Llega y canta</h3><p class="muted">Da tu número de reservación en recepción. Tienes unos minutos de tolerancia.</p></div>
</div>

<div class="row between mt-11"><h2 class="m-0">Elige tu sala</h2><a href="/menu" class="btn sm">Ver la carta →</a></div>
<div class="grid-auto mt-4">
  {#if $cat}
    {#each $cat.tipos as t, i (t.id)}
      <article class="card sala" use:revelar={i} use:inclinar>
        <div class="thumb foto"><img src={FOTOS_TIPO[t.codigo] || ''} alt="Sala {t.nombre}" loading="lazy" /><span>{t.nombre}</span></div>
        <div class="row between"><h3 class="m-0">Sala {t.nombre}</h3><span class="badge accent">{t.capacidadMin}–{t.capacidadMax} personas</span></div>
        <p class="muted small">{t.descripcion || `Ideal para grupos de ${t.capacidadMin} a ${t.capacidadMax} personas.`}</p>
        {#if conCortesia($cat, t.id)}<p class="cortesia-tag">🍾 Incluye botella de cortesía a elegir</p>{/if}
        <div class="row between">
          <div class="price">{money(t.precioHora)}<small> /hora</small></div>
          <a class="btn sm primary" href="/salas?tipo={encodeURIComponent(t.nombre)}">Ver salas</a>
        </div>
      </article>
    {/each}
  {:else}
    <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
  {/if}
</div>

<section aria-labelledby="t-conocenos">
  <h2 id="t-conocenos" class="mt-11">Conócenos</h2>
  <div class="mt-4 grid items-stretch gap-4 lg:grid-cols-[1.3fr_1fr]">
    <figure class="card m-0 overflow-hidden p-0" use:revelar>
      <img class="block h-full min-h-60 w-full object-cover" src="/img/lugar/fachada.jpg" alt="Fachada de Moonlight iluminada de noche con letreros de neón" width="1200" height="675" loading="lazy" />
    </figure>
    <div class="stack">
      <article class="card" use:revelar>
        <h3 class="font-serif tracking-wider text-lila text-shadow-neon">Misión</h3>
        <p class="m-0 text-muted">Brindar entretenimiento en espacios privados con música y tecnología, ofreciendo experiencias únicas para cantar, convivir y disfrutar.</p>
      </article>
      <article class="card" use:revelar>
        <h3 class="font-serif tracking-wider text-lila text-shadow-neon">Visión</h3>
        <p class="m-0 text-muted">Ser uno de los principales referentes de entretenimiento de karaoke privado en la región, reconocidos por nuestra innovación, calidad, servicio y capacidad para crear experiencias memorables.</p>
      </article>
    </div>
  </div>

  <div class="card mt-4 scroll-mt-24" id="ubicacion">
    <div class="row between">
      <h3 class="m-0">📍 Ubicación</h3>
      <a class="btn sm primary" href="https://goo.gl/maps/VUutLXRjVrHx4v8Z6" target="_blank" rel="noopener">Cómo llegar · Google Maps</a>
    </div>
    <div class="mapa mt-3.5 aspect-[16/7] min-h-[260px] overflow-hidden rounded-[10px] border border-line">
      <iframe title="Mapa de la ubicación de Moonlight" src="https://maps.google.com/maps?q=19.024583,-98.198667&z=17&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  </div>
</section>
