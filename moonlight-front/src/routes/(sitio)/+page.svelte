<!-- Inicio: hero con el logotipo neón, pasos, tipos de sala, conócenos y ubicación. -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'
  import { conCortesia, FOTOS_TIPO, resumenHorario } from '#lib/utils/carta.ts'
  import { money, num } from '#lib/utils/formato.ts'
  import { contar, inclinar, revelar } from '#lib/fx/efectos.ts'
  import Rotador from '#lib/components/Rotador.svelte'

  const cat = seleccionar((s) => s.catalogo.datos)
  const precios = $derived($cat?.tipos.map((t) => num(t.precioHora)) ?? [])
  // sala que "recomienda" la vista previa del asistente: la que admite 8 personas, o la de en medio
  const recomendada = $derived($cat?.tipos.find((t) => t.capacidadMin <= 8 && 8 <= t.capacidadMax) ?? $cat?.tipos[Math.floor(($cat?.tipos.length ?? 0) / 2)])
  const personas = $derived(recomendada ? Math.min(Math.max(8, recomendada.capacidadMin), recomendada.capacidadMax) : 8)
</script>

<svelte:head><title>Moonlight · Karaoke &amp; Social Lounge</title></svelte:head>

<section class="relative grid grid-cols-[minmax(0,1fr)] items-center gap-10 pt-4 pb-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:pt-10 md:pb-14">
  <div class="hero-glow" aria-hidden="true"><span></span><span></span><span></span></div>
  <div>
    <div class="mb-3.5 inline-flex items-center gap-2 rounded-full border border-line bg-card/60 px-3.5 py-1.5 text-[.95rem] text-muted backdrop-blur-sm">
      <span class="dot-vivo" aria-hidden="true"></span>Esta noche suena <Rotador palabras={$cat?.tematicas.map((t) => t.nombre) ?? []} />
    </div>
    <h1 class="text-[clamp(2.2rem,5.4vw,3.8rem)] font-bold tracking-tight">Canta bajo la luz de <span class="neon-titila">Moonlight</span></h1>
    <p class="tagline">Karaoke &amp; Social Lounge</p>
    <p class="subtitulo max-w-[52ch]">
      Salas privadas de karaoke ambientadas con la música que tú eliges: regional, reguetón, pop, banda, rock, K-Pop y más.
      Escoge el tamaño de tu sala, tu horario y llega a cantar.
    </p>
    <div class="row">
      <a class="btn primary lg" href="/reservar">Reservar sala <span class="flecha" aria-hidden="true">→</span></a>
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
  <div class="flex w-full max-w-[340px] flex-col items-center gap-6 justify-self-center sm:max-w-[400px] md:max-w-[440px]">
    <div class="escena relative w-full max-w-[380px]">
      <img class="logo-img logo-hero w-full" src="/img/logo.jpg" alt="Moonlight Karaoke &amp; Social Lounge" width="1000" height="607" />
      <div class="notas pointer-events-none absolute inset-0" aria-hidden="true"><span>♪</span><span>♫</span><span>♪</span><span>♬</span></div>
    </div>

    <!-- vista previa flotante: maqueta del asistente de reservas (ilustrativa, con precios reales del catálogo) -->
    <figure class="ventana m-0 w-full max-w-[360px]" aria-label="Vista previa: el asistente de Moonlight recomienda una sala">
      <div class="ventana-barra" aria-hidden="true">
        <i></i><i></i><i></i>
        <span class="ml-1 min-w-0 flex-1 truncate rounded-md bg-fondo-2 px-2.5 py-1 text-[.72rem] text-muted">moonlight · asistente de reservas</span>
        <span class="eq flex h-3.5 items-end gap-0.5">{#each Array(5) as _, i (i)}<i></i>{/each}</span>
      </div>
      <div class="flex flex-col gap-2 p-3" aria-hidden="true">
        <p class="burbuja yo m-0">Somos {personas} el viernes a las 9 pm 🎤 ¿qué sala nos recomiendas?</p>
        <p class="burbuja ia m-0">
          {#if recomendada}
            Les queda perfecta la <b>Sala {recomendada.nombre}</b> ({recomendada.capacidadMin}–{recomendada.capacidadMax} personas) por
            <b class="text-gold">{money(recomendada.precioHora)}/h</b>. ¿La ambientamos con {$cat?.tematicas[0]?.nombre ?? 'su música favorita'}?
          {:else}
            Tengo salas para grupos chicos, medianos y premium. ¿La ambientamos con su música favorita?
          {/if}
        </p>
        <span class="escribiendo self-start"><i></i><i></i><i></i></span>
      </div>
      <figcaption class="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5">
        <span class="text-[.8rem] font-light text-muted">Así de fácil es reservar</span>
        <a class="btn sm primary" href="/reservar">Probar <span class="flecha" aria-hidden="true">→</span></a>
      </figcaption>
    </figure>
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
