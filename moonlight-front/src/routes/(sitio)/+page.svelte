<!-- Inicio: hero con el logotipo neón, pasos, tipos de sala, conócenos y ubicación. -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'
  import { conCortesia, FOTOS_TIPO, resumenHorario } from '#lib/utils/carta.ts'
  import { money, num } from '#lib/utils/formato.ts'
  import { contar, inclinar, revelar } from '#lib/fx/efectos.ts'
  import Rotador from '#lib/components/Rotador.svelte'
  import ChatEnVivo from '#lib/components/sitio/ChatEnVivo.svelte'

  const cat = seleccionar((s) => s.catalogo.datos)
  const precios = $derived($cat?.tipos.map((t) => num(t.precioHora)) ?? [])
</script>

<svelte:head><title>Moonlight · Karaoke &amp; Social Lounge</title></svelte:head>

<section class="relative grid grid-cols-[minmax(0,1fr)] items-center gap-10 pt-4 pb-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:pt-10 md:pb-14">
  <div class="hero-glow" aria-hidden="true"><span></span><span></span><span></span></div>
  <div>
    <div class="animate-fade-in-up mb-3.5 inline-flex items-center gap-2 rounded-full border border-line bg-card/60 px-3.5 py-1.5 text-[.95rem] text-muted backdrop-blur-sm">
      <span class="dot-vivo" aria-hidden="true"></span>Esta noche suena <Rotador palabras={$cat?.tematicas.map((t) => t.nombre) ?? []} />
    </div>
    <h1 class="animate-fade-in-up text-[clamp(2.2rem,5.4vw,3.8rem)] font-bold tracking-tight" style="--d: 80ms">Canta bajo la luz de <span class="neon-titila">Moonlight</span></h1>
    <p class="tagline animate-fade-in-up" style="--d: 160ms">Karaoke &amp; Social Lounge</p>
    <p class="subtitulo animate-fade-in-up max-w-[52ch]" style="--d: 240ms">
      Salas privadas de karaoke ambientadas con la música que tú eliges: regional, reguetón, pop, banda, rock, K-Pop y más.
      Escoge el tamaño de tu sala, tu horario y llega a cantar.
    </p>
    <div class="row animate-fade-in-up" style="--d: 320ms">
      <a class="btn primary lg" href="/reservar">Reservar sala <span class="flecha" aria-hidden="true">→</span></a>
      <a class="btn lg" href="/salas">Ver salas</a>
    </div>
    {#if $cat}
      <div class="animate-fade-in-up mt-5 flex flex-wrap gap-5 text-[.9rem] text-muted" style="--d: 400ms">
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
  <div class="flex w-full max-w-[340px] flex-col items-center gap-6 justify-self-center sm:max-w-[400px] md:max-w-[440px]">
    <div class="escena relative w-full max-w-[380px]">
      <img class="logo-img logo-hero w-full" src="/img/logo.jpg" alt="Moonlight Karaoke &amp; Social Lounge" width="1000" height="607" />
      <div class="notas pointer-events-none absolute inset-0" aria-hidden="true"><span>♪</span><span>♫</span><span>♪</span><span>♬</span></div>
    </div>

    <div class="animate-fade-in-up w-full max-w-[360px]" style="--d: 450ms"><ChatEnVivo /></div>
  </div>
</section>

<section aria-labelledby="t-como" class="mt-6">
  <h2 id="t-como">Cómo funciona</h2>
  <p class="subtitulo mb-5 max-w-[60ch]">De la idea a cantar en tres pasos, sin filas ni llamadas.</p>
  <div class="grid-4">
    <article class="gradient-border-card" use:revelar>
      <span class="icono-card" aria-hidden="true">🎶</span>
      <h3>1 · Elige</h3>
      <p class="m-0 text-muted">El tamaño de tu sala, el horario y tu música: un género o tu propia lista de artistas y canciones.</p>
    </article>
    <article class="gradient-border-card" use:revelar>
      <span class="icono-card" aria-hidden="true">💳</span>
      <h3>2 · Paga en línea</h3>
      <p class="m-0 text-muted">
        {#if $cat}Solo el {$cat.reglas.anticipoSalaPct}% de la sala y, si pides alimentos o bebidas, el {$cat.reglas.anticipoPedidoPct}% de tu pedido. El resto lo pagas al llegar.
        {:else}Un anticipo de la sala y, si quieres, de tu pedido de alimentos y bebidas.{/if}
      </p>
    </article>
    <article class="gradient-border-card" use:revelar>
      <span class="icono-card" aria-hidden="true">🎤</span>
      <h3>3 · Llega y canta</h3>
      <p class="m-0 text-muted">Da tu número de reservación en recepción. Tienes unos minutos de tolerancia.</p>
    </article>
    <article class="gradient-border-card" use:revelar>
      <span class="icono-card" aria-hidden="true">🍹</span>
      <h3>+ Pide a tu sala</h3>
      <p class="m-0 text-muted">Agrega alimentos y bebidas al reservar y te los llevamos a tu sala.</p>
    </article>
  </div>
</section>

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
  <div class="mt-4 grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
    <figure class="card m-0 overflow-hidden p-0" use:revelar>
      <img class="block h-full min-h-60 w-full object-cover" src="/img/lugar/fachada.jpg" alt="Fachada de Moonlight iluminada de noche con letreros de neón" width="1200" height="675" loading="lazy" />
    </figure>
    <div class="stack">
      <article class="card" use:revelar>
        <h3 class="text-[1.2rem] font-bold tracking-tight text-lila text-shadow-neon">Misión</h3>
        <p class="m-0 text-muted">Brindar entretenimiento en espacios privados con música y tecnología, ofreciendo experiencias únicas para cantar, convivir y disfrutar.</p>
      </article>
      <article class="card" use:revelar>
        <h3 class="text-[1.2rem] font-bold tracking-tight text-lila text-shadow-neon">Visión</h3>
        <p class="m-0 text-muted">Ser uno de los principales referentes de entretenimiento de karaoke privado en la región, reconocidos por nuestra innovación, calidad, servicio y capacidad para crear experiencias memorables.</p>
      </article>
    </div>
  </div>

  <div class="card mt-4 scroll-mt-24" id="ubicacion">
    <div class="row between">
      <h3 class="m-0">📍 Ubicación</h3>
      <a class="btn sm primary" href="https://goo.gl/maps/VUutLXRjVrHx4v8Z6" target="_blank" rel="noopener">Cómo llegar · Google Maps</a>
    </div>
    <div class="mapa mt-3.5 aspect-[4/3] sm:aspect-[16/7] sm:min-h-[260px] overflow-hidden rounded-[10px] border border-line">
      <iframe title="Mapa de la ubicación de Moonlight" src="https://maps.google.com/maps?q=19.024583,-98.198667&z=17&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  </div>
</section>
