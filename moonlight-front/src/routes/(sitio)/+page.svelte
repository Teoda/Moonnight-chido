<!-- Inicio: hero (logo, eslogan, foto principal y reservar), cómo funciona, tipos de sala, conócenos y ubicación. -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'
  import { goto } from '$app/navigation'
  import { api } from '#lib/api/client.ts'
  import type { SalaPublica, TipoSala } from '#lib/api/types.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { acciones } from '#lib/store/reserva.ts'
  import { conCortesia, resumenHorario } from '#lib/utils/carta.ts'
  import TarjetaTipoSala from '#lib/components/sitio/salas/TarjetaTipoSala.svelte'
  import { money, num } from '#lib/utils/formato.ts'
  import { revelar } from '#lib/fx/efectos.ts'
  import ChatEnVivo from '#lib/components/sitio/ChatEnVivo.svelte'

  const cat = seleccionar((s) => s.catalogo.datos)

  // salas registradas (para contar las de cada tamaño, como en la página Salas)
  let salas = $state<SalaPublica[] | null>(null)
  $effect(() => { api.get<SalaPublica[]>('/publico/salas').then((l) => (salas = l), () => (salas = [])) })
  // mismo comportamiento que "Reservar" en Salas: elige el tamaño y busca horarios
  function reservarTipo(t: TipoSala) {
    dispatch(acciones.elegirTipo({ id: t.id, capacidadMax: t.capacidadMax }))
    goto('/reservar?buscar=1')
  }
  const precios = $derived($cat?.tipos.map((t) => num(t.precioHora)) ?? [])

  // Foto principal del hero (public/images/hero/). Vertical: el encuadre se ajusta para mostrar las caras.
  const FOTO = {
    src: '/images/hero/hero_moonlight-1122.webp', srcset: '/images/hero/hero_moonlight-640.webp 640w, /images/hero/hero_moonlight-1122.webp 1122w',
    alt: 'Yuridia y The Warning cantando y tocando en concierto bajo luces violetas', ancho: 1122, alto: 1402, posicion: '50% 28%',
  }
</script>

<svelte:head><title>Moonlight · Karaoke &amp; Social Lounge</title></svelte:head>

<section class="hero" aria-labelledby="t-hero">
  <figure class="hero-foto">
    <img src={FOTO.src} srcset={FOTO.srcset} sizes="(min-width: 64rem) 64vw, 100vw" alt={FOTO.alt} width={FOTO.ancho} height={FOTO.alto} style:object-position={FOTO.posicion} fetchpriority="high" />
  </figure>
  <div class="wrap contenido">
    <img class="logo-img logo" src="/img/logo.jpg" alt="Moonlight Karaoke &amp; Social Lounge" width="1000" height="607" />
    <h1 id="t-hero" class="eslogan"><span>Tu voz,</span> <span>tu momento,</span> <span class="ultima">tu lugar.</span></h1>
    <p class="intro">
      Salas privadas de karaoke para cantar con tu gente, con la música que tú elijas.
      Reserva tu sala y tu horario en línea y llega a cantar.
    </p>
    <div class="acciones">
      <a class="btn primary lg" href="/reservar">Reservar sala</a>
      <a class="btn lg" href="/salas">Explorar salas</a>
    </div>
  </div>
</section>

<!-- franja informativa: datos del catálogo, separados por líneas finas -->
{#if $cat}
  <dl class="franja">
    {#if resumenHorario($cat.horarios)}<div><dt>Horario</dt><dd>{resumenHorario($cat.horarios)}</dd></div>{/if}
    <div><dt>Capacidad</dt><dd>{Math.min(...$cat.tipos.map((t) => t.capacidadMin))} a {Math.max(...$cat.tipos.map((t) => t.capacidadMax))} personas</dd></div>
    {#if precios.length}<div><dt>Precio inicial</dt><dd>Desde {money(Math.min(...precios))} por hora</dd></div>{/if}
  </dl>
{/if}

<section class="como" aria-labelledby="t-como">
  <header class="como-cabeza">
    <h2 id="t-como">Cómo funciona</h2>
    <p>Tu experiencia Moonlight comienza en tres sencillos pasos.</p>
  </header>

  <ol class="pasos">
    <li>
      <span class="num" aria-hidden="true">01</span>
      <h3>Elige tu experiencia</h3>
      <p>Selecciona el tamaño de tu sala, el horario y tu música favorita. Puedes elegir un género o crear tu propia lista de artistas y canciones.</p>
    </li>
    <li>
      <span class="num" aria-hidden="true">02</span>
      <h3>Reserva en línea</h3>
      <p>
        Confirma tu reservación pagando el {$cat?.reglas.anticipoSalaPct ?? 50}% de la sala. Si agregas alimentos o bebidas,
        anticipa el {$cat?.reglas.anticipoPedidoPct ?? 30}% del pedido y liquida el resto al llegar.
      </p>
    </li>
    <li>
      <span class="num" aria-hidden="true">03</span>
      <h3>Llega y canta</h3>
      <p>Presenta tu número de reservación en recepción, ingresa a tu sala y comienza a disfrutar de tu experiencia Moonlight.</p>
    </li>
  </ol>

  <aside class="extra" aria-labelledby="t-extra">
    <p class="extra-etiqueta">Una experiencia a tu medida</p>
    <div>
      <h3 id="t-extra">Alimentos y bebidas directamente a tu sala.</h3>
      <p>Personaliza tu reservación agregando alimentos y bebidas. Nosotros nos encargamos de llevarlos hasta tu sala.</p>
    </div>
    <a class="extra-enlace" href="/menu">Ver la carta</a>
  </aside>

  <!-- vista previa del asistente -->
  <div class="chat"><ChatEnVivo /></div>
</section>

<!-- tamaños de sala: las mismas tarjetas que la página Salas -->
<section class="salas-inicio" aria-labelledby="t-salas">
  <div class="salas-cabeza">
    <h2 id="t-salas">Elige tu sala</h2>
    <a class="enlace" href="/salas">Ver todas las salas</a>
  </div>
  {#if $cat && salas}
    <div class="salas-grid">
      {#each $cat.tipos.filter((t) => salas!.some((x) => x.tipoSalaId === t.id)) as t (t.id)}
        <TarjetaTipoSala tipo={t} total={salas.filter((x) => x.tipoSalaId === t.id).length} cortesia={conCortesia($cat, t.id)}
          onexplorar={() => goto('/salas?tipo=' + encodeURIComponent(t.nombre))} onreservar={reservarTipo} />
      {/each}
    </div>
  {:else}
    <div class="salas-grid" aria-busy="true" aria-label="Cargando salas">{#each Array(3) as _, i (i)}<div class="skeleton"></div>{/each}</div>
  {/if}
</section>

<section aria-labelledby="t-conocenos">
  <h2 id="t-conocenos" class="mt-11">Conócenos</h2>
  <div class="mt-4 grid grid-cols-[minmax(0,1fr)] items-stretch gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
    <figure class="card m-0 overflow-hidden p-0" use:revelar>
      <img class="block h-full min-h-60 w-full object-cover" src="/img/lugar/fachada.jpg" alt="Fachada de Moonlight iluminada de noche con letreros de neón" width="1200" height="675" loading="lazy" />
    </figure>
    <div class="stack">
      <article class="card" use:revelar>
        <h3 class="text-[1.2rem] font-bold tracking-tight text-lila">Misión</h3>
        <p class="m-0 text-muted">Brindar entretenimiento en espacios privados con música y tecnología, ofreciendo experiencias únicas para cantar, convivir y disfrutar.</p>
      </article>
      <article class="card" use:revelar>
        <h3 class="text-[1.2rem] font-bold tracking-tight text-lila">Visión</h3>
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

<style>
  /* ── hero: foto a todo lo ancho de la pantalla, integrada con degradados oscuros y luz violeta ── */
  .hero {
    position: relative; isolation: isolate; overflow: hidden; display: flex; align-items: center;
    margin: -28px calc(50% - 50vw) 0; /* sale del contenedor de <main> y se pega a la barra superior */
    min-height: clamp(560px, 88svh, 760px);
  }
  /* la foto es vertical: se limita su ancho para que en pantallas anchas no se amplíe de más y no corte las caras */
  .hero-foto { position: absolute; inset: 0 0 0 auto; z-index: -2; width: min(64%, 1000px); margin: 0; }
  /* pantallas muy anchas: la foto se acerca al contenido y se funde también por la derecha */
  @media (width >= 100rem) {
    .hero-foto { right: calc((100vw - 1600px) / 2); -webkit-mask-image: linear-gradient(90deg, transparent, #000 30%, #000 80%, transparent); mask-image: linear-gradient(90deg, transparent, #000 30%, #000 80%, transparent); }
  }
  .hero-foto img { width: 100%; height: 100%; object-fit: cover; animation: acercar 1.6s cubic-bezier(.2, .7, .2, 1) both; }
  /* fundido: del fondo (izquierda) a la foto, abajo hacia el contenido siguiente, y un resplandor violeta */
  .hero::before {
    content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(60% 70% at 72% 40%, rgba(139, 44, 245, .22), transparent 70%),
      linear-gradient(90deg, var(--bg) 0%, var(--bg) 34%, rgba(7, 6, 14, .82) 46%, rgba(7, 6, 14, .25) 70%, rgba(7, 6, 14, .35) 100%),
      linear-gradient(180deg, rgba(7, 6, 14, .35) 0%, transparent 25%, transparent 70%, var(--bg) 100%);
  }
  .contenido { position: relative; padding-block: 48px 56px; }
  .contenido > * { max-width: 34rem; animation: entrar .9s cubic-bezier(.2, .7, .2, 1) both; }
  .logo { width: min(300px, 70%); height: auto; margin: 0 0 18px -6px; }
  .eslogan {
    margin: 0; color: #fff; font-weight: 700; letter-spacing: -.035em; line-height: 1;
    font-size: clamp(2.9rem, 1.6rem + 5vw, 5.4rem); animation-delay: 80ms !important;
  }
  .eslogan span { display: block; }
  .ultima {
    display: inline-block !important; /* el degradado abarca solo las palabras, no todo el ancho */
    padding-bottom: .08em; /* que el degradado no corte los descendentes */
    background: linear-gradient(92deg, #c084fc 0%, #b45cff 35%, #e04ff0 75%, #f472d0 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .intro { margin: 22px 0 0; max-width: 46ch; color: #d9cff0; font-size: clamp(1.02rem, .96rem + .3vw, 1.18rem); line-height: 1.6; animation-delay: 160ms !important; }
  .acciones { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; animation-delay: 220ms !important; }

  @keyframes acercar { from { transform: scale(1.06); opacity: 0; } }
  @keyframes entrar { from { opacity: 0; transform: translateY(14px); } }
  @media (prefers-reduced-motion: reduce) { .hero-foto img, .contenido > * { animation: none; } }

  /* ── tableta ── */
  @media (width < 64rem) {
    .hero-foto { width: 100%; }
    .hero::before {
      background:
        radial-gradient(70% 50% at 70% 25%, rgba(139, 44, 245, .22), transparent 70%),
        linear-gradient(180deg, rgba(7, 6, 14, .45) 0%, rgba(7, 6, 14, .7) 45%, rgba(7, 6, 14, .94) 72%, var(--bg) 100%);
    }
  }
  /* ── teléfono: foto arriba como fondo; logo, eslogan y reservar visibles sin bajar ── */
  @media (width < 40rem) {
    .hero { min-height: auto; align-items: flex-end; }
    .hero-foto { height: 56%; inset: 0 0 auto 0; -webkit-mask-image: linear-gradient(#000 55%, transparent); mask-image: linear-gradient(#000 55%, transparent); }
    /* las caras quedan arriba, libres; logo, eslogan y reservar debajo, visibles sin desplazarse */
    .contenido { padding-block: 232px 36px; text-align: center; }
    .contenido > * { margin-inline: auto; }
    .logo { width: min(160px, 46%); margin: 0 auto 10px; }
    .eslogan { font-size: clamp(2.35rem, 1.3rem + 6.4vw, 3.2rem); }
    .intro { margin-top: 16px; font-size: 1rem; }
    .acciones { flex-direction: column; margin-top: 22px; }
    .acciones .btn { justify-content: center; }
  }
  /* teléfonos de pantalla corta: todo más compacto para que «Reservar sala» se vea sin desplazarse */
  @media (width < 40rem) and (height < 740px) {
    .contenido { padding-top: 150px; }
    .logo { width: min(128px, 38%); margin-bottom: 6px; }
    .eslogan { font-size: clamp(2.1rem, 1.2rem + 5.6vw, 2.6rem); }
    .intro { margin-top: 10px; font-size: .94rem; line-height: 1.5; }
    .acciones { margin-top: 16px; gap: 10px; }
  }

  /* ── franja informativa ── */
  .franja {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 0 clamp(56px, 8vw, 96px);
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  }
  .franja > div { padding: 20px 24px; }
  .franja > div + div { border-left: 1px solid var(--line); }
  .franja > div:first-child { padding-left: 0; }
  .franja dt { color: var(--muted); font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .franja dd { margin: 6px 0 0; color: #fff; font-size: 1.05rem; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* ── cómo funciona: proceso editorial numerado ── */
  .como { margin-bottom: clamp(56px, 8vw, 96px); }
  .como-cabeza { max-width: 40rem; margin-bottom: clamp(36px, 5vw, 56px); }
  .como-cabeza h2 { margin: 0; font-size: clamp(2.2rem, 1.6rem + 2.6vw, 3.4rem); letter-spacing: -.035em; line-height: 1.05; }
  .como-cabeza p { margin: 14px 0 0; color: var(--muted); font-size: clamp(1.02rem, .96rem + .3vw, 1.2rem); }

  .pasos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
  .pasos li { padding: 28px 32px 8px; }
  .pasos li:first-child { padding-left: 0; }
  .pasos li + li { border-left: 1px solid var(--line); }
  .num {
    display: block; color: var(--accent); font-size: clamp(3.4rem, 2.6rem + 3vw, 5rem); font-weight: 700; line-height: 1;
    letter-spacing: -.04em; font-variant-numeric: tabular-nums; opacity: .85; transition: opacity .3s ease, color .3s ease;
  }
  .pasos h3 { margin: 22px 0 10px; color: var(--text); font-size: .9rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; transition: color .3s ease; }
  .pasos p { margin: 0; max-width: 34ch; color: var(--muted); line-height: 1.65; }
  @media (hover: hover) {
    .pasos li:hover .num { opacity: 1; color: var(--violeta-claro); }
    .pasos li:hover h3 { color: #fff; }
  }
  @media (prefers-reduced-motion: reduce) { .num, .pasos h3 { transition: none; } }

  /* servicio complementario: discreto, a todo lo ancho, no como un cuarto paso */
  .extra {
    display: grid; grid-template-columns: 14rem minmax(0, 1fr) auto; align-items: baseline; gap: 12px 40px;
    margin-top: clamp(40px, 6vw, 64px); padding: 28px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  }
  .extra-etiqueta { margin: 0; color: var(--violeta-claro); font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .extra h3 { margin: 0; font-size: clamp(1.15rem, 1rem + .6vw, 1.45rem); letter-spacing: -.01em; }
  .extra div p { margin: 8px 0 0; max-width: 60ch; color: var(--muted); }
  .extra-enlace { color: var(--color-lila); font-weight: 600; text-decoration: none; white-space: nowrap; border-bottom: 1px solid rgba(180, 92, 255, .5); }
  .extra-enlace:hover { color: #fff; border-bottom-color: #fff; }
  .extra-enlace:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; border-radius: 2px; }
  .chat { width: 100%; max-width: 380px; margin-top: clamp(40px, 6vw, 64px); }

  /* tableta: pasos en una columna con el número a un lado */
  @media (width < 64rem) {
    .pasos { grid-template-columns: minmax(0, 1fr); }
    .pasos li { display: grid; grid-template-columns: 7rem minmax(0, 1fr); column-gap: 24px; padding: 28px 0; }
    .pasos li + li { border-left: 0; border-top: 1px solid var(--line); }
    .pasos .num { grid-row: span 2; }
    .pasos h3 { margin-top: 6px; }
    .pasos p { max-width: 60ch; }
    .extra { grid-template-columns: minmax(0, 1fr) auto; }
    .extra-etiqueta { grid-column: 1 / -1; }
  }
  /* teléfono: todo en vertical, separadores horizontales */
  @media (width < 40rem) {
    .franja { grid-template-columns: minmax(0, 1fr); }
    .franja > div, .franja > div:first-child { padding: 14px 0; }
    .franja > div + div { border-left: 0; border-top: 1px solid var(--line); }
    .pasos li { display: block; padding: 28px 0 30px; }
    .pasos h3 { margin-top: 16px; }
    .extra { grid-template-columns: minmax(0, 1fr); }
  }
  /* teléfono en horizontal y pantallas muy bajas: logo y eslogan compactos para que se vean el eslogan y los botones */
  @media (width >= 40rem) and (height < 560px) {
    .hero { min-height: auto; }
    .contenido { padding-block: 28px 32px; }
    .logo { width: min(150px, 30%); margin-bottom: 10px; }
    .eslogan { font-size: clamp(2.2rem, 1.4rem + 3vw, 3rem); }
    .intro { margin-top: 12px; }
    .acciones { margin-top: 18px; }
  }

  /* ── elige tu sala ── */
  .salas-inicio { margin-bottom: var(--espacio-seccion, 80px); }
  .salas-cabeza { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 20px; margin-bottom: 24px; }
  .salas-cabeza h2 { margin: 0; }
  .enlace { color: var(--color-lila); font-weight: 600; text-decoration: none; border-bottom: 1px solid rgba(180, 92, 255, .5); }
  .enlace:hover { color: #fff; border-bottom-color: #fff; }
  .salas-grid { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
  .salas-grid .skeleton { min-height: 420px; }
  @media (width >= 40rem) { .salas-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (width >= 64rem) { .salas-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
