<!-- Conócenos: la presentación de la empresa como tríptico (3 paneles × 3 tarjetas) con lo que dice el documento y,
     cuando existe en el sistema, el enlace "Ver en el sistema". Las secciones del personal piden iniciar sesión y, al
     entrar, quedan en esa sección (?acceso=super abre el login en Súper administración).
     "Presentar" muestra una tarjeta a la vez en pantalla completa, con las flechas o deslizando, y un reloj de 5 min. -->
<script lang="ts">
  import { ahora } from '#lib/fx/efectos.ts'

  type Tarjeta = {
    titulo: string; texto: string; puntos: string[]; img: string; alt: string
    enlace?: { href: string; txt: string; acceso?: 'Súper administración' | 'Personal' }; pronto?: boolean
  }
  const PANELES: { titulo: string; lema: string; tarjetas: Tarjeta[] }[] = [
    {
      titulo: 'La empresa', lema: 'Quiénes somos',
      tarjetas: [
        {
          titulo: 'Karaoke privado, a tu manera', img: '/img/conocenos/exterior.webp', alt: 'Exterior del establecimiento Moonlight',
          texto: 'Moonlight es un concepto de entretenimiento con experiencias de karaoke privadas, cómodas y personalizadas para amigos, parejas y familias.',
          puntos: ['15 salas privadas: 5 pequeñas (1–4), 4 medianas (5–8) y 6 premium (9–16)', 'Bar y área social, recepción y sala de espera', 'Ambientes temáticos: Pop, Rock, Retro, K-Pop y Premium Lounge'],
          enlace: { href: '/salas', txt: 'Ver las salas' },
        },
        {
          titulo: 'Misión, visión y valores', img: '/img/conocenos/interior.webp', alt: 'Interior del establecimiento Moonlight',
          texto: 'Brindar entretenimiento en espacios privados con música y tecnología, y ser referente del karaoke privado en la región por nuestra innovación, calidad y servicio.',
          puntos: ['Respeto, innovación y responsabilidad', 'Discreción y confidencialidad de nuestros clientes', 'Precios y promociones claros, sin publicidad engañosa'],
        },
        {
          titulo: 'Imagen corporativa', img: '/img/conocenos/logotipo.webp', alt: 'Logotipo y colores corporativos de Moonlight',
          texto: 'Una marca sofisticada y alegre, con colores que cuentan quiénes somos.',
          puntos: ['Negro: elegancia y exclusividad', 'Morado: creatividad, música y personalidad', 'Dorado: experiencia premium · Verde: compromiso ambiental y social'],
        },
      ],
    },
    {
      titulo: 'La experiencia', lema: 'Lo que vive el cliente',
      tarjetas: [
        {
          titulo: 'Reserva en línea', img: '/img/conocenos/sis-reservar.webp', alt: 'Captura del asistente de reservación de Moonlight',
          texto: 'El cliente elige el tamaño de sala, el día, la hora disponible y su género musical, y paga el anticipo en línea.',
          puntos: ['Horarios disponibles en tiempo real', 'La sala se ambienta con la música elegida', 'Número de reservación para llegar directo'],
          enlace: { href: '/reservar', txt: 'Ir a Reservar' },
        },
        {
          titulo: 'Carta y promociones', img: '/img/conocenos/sis-menu.webp', alt: 'Captura de la carta de alimentos y bebidas',
          texto: 'Alimentos, bebidas y paquetes con precios claros; se pueden pedir al reservar o desde la sala.',
          puntos: ['50 % en alimentos al acumular 4 visitas en el mes', 'Happy Hour en las horas de menos consumo', 'Botella de cortesía en las salas premium'],
          enlace: { href: '/menu', txt: 'Ver la carta' },
        },
        {
          titulo: 'Zona comunitaria y eventos', img: '/img/conocenos/salas-doc.webp', alt: 'Salas de karaoke de Moonlight', pronto: true,
          texto: 'Un espacio para presentaciones, competencias y rankings de karaoke, con artistas y músicos de la región.',
          puntos: ['Eventos y presentaciones especiales', 'Competencias y rankings de karaoke', 'Contenido en redes: retos, canciones y salas temáticas'],
        },
      ],
    },
    {
      titulo: 'Nuestro compromiso', lema: 'Responsabilidad social y ambiental',
      tarjetas: [
        {
          titulo: 'Paneles solares', img: '/img/conocenos/sis-paneles.webp', alt: 'Captura del monitoreo de los 15 paneles solares',
          texto: 'Paneles solares que aprovechan la energía del sol para generar parte de la electricidad del establecimiento.',
          puntos: ['Energía renovable y menor consumo de la red', 'Monitoreo de cada panel: funcionando, revisión o reparación', 'Reparaciones incluidas en el reporte semanal'],
          enlace: { href: '/staff/paneles?acceso=super', txt: 'Ver los paneles', acceso: 'Súper administración' },
        },
        {
          titulo: 'Moonlight por las patitas', img: '/img/conocenos/sis-patitas.webp', alt: 'Captura del seguimiento de vidrio reciclado y donaciones',
          texto: '"Tu noche también puede ayudar a una patita." El vidrio se recicla y parte de lo obtenido se dona para alimentar, rescatar y cuidar perros en situación de calle.',
          puntos: ['Consumo → separación → reciclaje → apoyo a perritos', 'Kilos reciclados y donaciones de cada semana', 'Involucra a clientes y trabajadores'],
          enlace: { href: '/staff/patitas?acceso=super', txt: 'Ver patitas', acceso: 'Súper administración' },
        },
        {
          titulo: 'Con nuestros colaboradores', img: '/img/conocenos/sis-horario.webp', alt: 'Captura del horario del personal por turnos',
          texto: 'Un ambiente laboral respetuoso, con horarios organizados y las herramientas para atender mejor.',
          puntos: ['Horario en dos turnos, una persona por área', 'Plano de salas en vivo y limpieza con observaciones', 'Acceso personal con llave para cada colaborador'],
          enlace: { href: '/staff/horario', txt: 'Ver el horario', acceso: 'Personal' },
        },
      ],
    },
  ]
  const DIAPOS = PANELES.flatMap((p, pi) => p.tarjetas.map((t) => ({ ...t, panel: p.titulo, pi })))
  const DURACION_MS = 5 * 60_000

  // ── modo presentación ──
  let presentando = $state(false), actual = $state(0), inicio = $state(0)
  let escenario = $state<HTMLElement>()
  const restante = $derived(Math.max(0, DURACION_MS - ($ahora - inicio)))
  const reloj = $derived(`${Math.floor(restante / 60_000)}:${String(Math.floor((restante % 60_000) / 1000)).padStart(2, '0')}`)

  async function presentar(desde = 0) {
    actual = desde; inicio = Date.now(); presentando = true
    await Promise.resolve()
    try { await escenario?.requestFullscreen?.() } catch { /* sin pantalla completa: se ve igual a toda la ventana */ }
  }
  function salir() {
    presentando = false
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }
  const ir = (n: number) => (actual = Math.min(DIAPOS.length - 1, Math.max(0, n)))
  function tecla(e: KeyboardEvent) {
    if (!presentando) return
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(actual + 1) }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(actual - 1) }
    else if (e.key === 'Home') ir(0)
    else if (e.key === 'End') ir(DIAPOS.length - 1)
    else if (e.key === 'Escape') salir()
  }
  // deslizar en el teléfono
  let x0 = 0
  const tocar = (e: PointerEvent) => (x0 = e.clientX)
  const soltar = (e: PointerEvent) => { const dx = e.clientX - x0; if (Math.abs(dx) > 50) ir(actual + (dx < 0 ? 1 : -1)) }
</script>

<svelte:head>
  <title>Conócenos · Moonlight</title>
  <meta name="description" content="Moonlight Karaoke & Social Lounge: quiénes somos, la experiencia y nuestro compromiso social y ambiental." />
</svelte:head>
<svelte:window onkeydown={tecla} />
<svelte:document onfullscreenchange={() => { if (!document.fullscreenElement && presentando) presentando = false }} />

{#snippet enlace(t: Tarjeta)}
  {#if t.enlace}
    <a class="btn sm primary ver" href={t.enlace.href} data-sveltekit-reload={t.enlace.acceso ? true : undefined}>
      {t.enlace.txt} <span class="flecha" aria-hidden="true">→</span>
    </a>
    {#if t.enlace.acceso}<span class="candado" title="Pide iniciar sesión">🔒 {t.enlace.acceso}</span>{/if}
  {:else if t.pronto}<span class="badge warn">Próximamente</span>{/if}
{/snippet}

<header class="intro">
  <p class="lema">Tu voz, tu momento, tu lugar</p>
  <h1 class="titulo-pagina">Conócenos</h1>
  <p class="muted max-w-[62ch]">Moonlight Karaoke &amp; Social Lounge en tres partes: quiénes somos, la experiencia que vive el cliente y nuestro compromiso. Donde veas <b>Ver en el sistema</b>, puedes abrirlo y comprobarlo.</p>
  <button class="btn primary" type="button" onclick={() => presentar()}>▶ Presentar</button>
</header>

<div class="triptico">
  {#each PANELES as p, pi (p.titulo)}
    <section class="panel" aria-labelledby="panel-{pi}">
      <p class="panel-num">{pi + 1}</p>
      <h2 id="panel-{pi}" class="panel-titulo">{p.titulo}<small>{p.lema}</small></h2>
      {#each p.tarjetas as t, ti (t.titulo)}
        <article class="tarjeta">
          <button class="foto" type="button" aria-label="Presentar desde: {t.titulo}" onclick={() => presentar(pi * 3 + ti)}>
            <img src={t.img} alt={t.alt} loading="lazy" width="640" height="400" />
          </button>
          <div class="cuerpo">
            <h3>{t.titulo}</h3>
            <p>{t.texto}</p>
            <ul>{#each t.puntos as x (x)}<li>{x}</li>{/each}</ul>
            <div class="acciones">{@render enlace(t)}</div>
          </div>
        </article>
      {/each}
    </section>
  {/each}
</div>

{#if presentando}
  {@const d = DIAPOS[actual]}
  <div class="escenario" bind:this={escenario} role="dialog" tabindex="-1" aria-modal="true" aria-label="Presentación de Moonlight" onpointerdown={tocar} onpointerup={soltar}>
    <div class="barra-pres">
      <span class="pres-panel">{d.pi + 1} · {d.panel}</span>
      <span class="reloj" class:poco={restante < 60_000} aria-label="Tiempo restante">{reloj}</span>
      <button class="x" type="button" aria-label="Salir de la presentación" onclick={salir}>×</button>
    </div>
    {#key actual}
      <article class="diapo">
        <img src={d.img} alt={d.alt} />
        <div class="diapo-texto">
          <h2>{d.titulo}</h2>
          <p>{d.texto}</p>
          <ul>{#each d.puntos as x (x)}<li>{x}</li>{/each}</ul>
          <div class="acciones">{@render enlace(d)}</div>
        </div>
      </article>
    {/key}
    <div class="nav-pres">
      <button class="btn" type="button" onclick={() => ir(actual - 1)} disabled={actual === 0} aria-label="Anterior">←</button>
      <div class="puntos" aria-hidden="true">{#each DIAPOS as _, i (i)}<i class:on={i === actual} class:corte={i % 3 === 0 && i > 0}></i>{/each}</div>
      <span class="small muted">{actual + 1} / {DIAPOS.length}</span>
      <button class="btn" type="button" onclick={() => ir(actual + 1)} disabled={actual === DIAPOS.length - 1} aria-label="Siguiente">→</button>
    </div>
  </div>
{/if}

<style>
  .intro { display: grid; justify-items: start; gap: 6px; margin-bottom: 28px; }
  .lema { margin: 0; color: var(--gold); font-size: .78rem; font-weight: 600; letter-spacing: .28em; text-transform: uppercase; }
  .intro .titulo-pagina { margin-bottom: 0; }
  .intro .btn { margin-top: 10px; }

  /* tríptico: tres columnas en computadora (con un pliegue entre paneles), una debajo de otra en teléfono */
  .triptico { display: grid; gap: 22px; }
  @media (width >= 64rem) {
    .triptico { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); }
    .panel + .panel { border-left: 1px dashed var(--line); }
  }
  .panel { position: relative; display: grid; align-content: start; gap: 14px; padding: 18px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); }
  @media (width >= 64rem) { .panel { border: 0; border-radius: 0; background: none; } }
  .panel-num { position: absolute; top: 8px; right: 16px; margin: 0; color: color-mix(in oklab, var(--accent) 35%, transparent); font-family: var(--serif); font-size: 2.6rem; font-weight: 700; line-height: 1; }
  .panel-titulo { display: grid; margin: 0; font-size: 1.3rem; }
  .panel-titulo small { color: var(--muted); font-size: .8rem; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; }

  .tarjeta { overflow: hidden; border: 1px solid var(--line); border-radius: 12px; background: var(--bg-2); }
  .foto { display: block; width: 100%; padding: 0; border: 0; background: #000; cursor: zoom-in; }
  .foto img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; transition: transform .4s ease; }
  @media (hover: hover) and (prefers-reduced-motion: no-preference) { .foto:hover img { transform: scale(1.03); } }
  .cuerpo { display: grid; gap: 8px; padding: 14px; }
  .cuerpo h3 { margin: 0; font-size: 1.05rem; }
  .cuerpo p { margin: 0; color: var(--muted); font-size: .9rem; line-height: 1.5; }
  .cuerpo ul, .diapo-texto ul { display: grid; gap: 4px; margin: 0; padding-left: 18px; font-size: .86rem; }
  .cuerpo li::marker, .diapo-texto li::marker { color: var(--accent); }
  .acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 4px; }
  .candado { color: var(--muted); font-size: .78rem; }

  /* modo presentación */
  .escenario {
    position: fixed; inset: 0; z-index: 60; display: grid; grid-template-rows: auto 1fr auto; gap: 12px;
    padding: clamp(12px, 3vw, 32px); background: radial-gradient(120% 90% at 50% 0%, #1d1433, #07060d 70%); color: var(--text); touch-action: pan-y;
  }
  .barra-pres { display: flex; align-items: center; gap: 12px; }
  .pres-panel { flex: 1; color: var(--gold); font-size: .8rem; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; }
  .reloj { font-variant-numeric: tabular-nums; color: var(--muted); }
  .reloj.poco { color: var(--bad); }
  .diapo { display: grid; align-content: center; align-items: center; gap: clamp(14px, 3vw, 40px); min-height: 0; animation: entra .35s ease both; }
  @media (width >= 56rem) { .diapo { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); } }
  .diapo img { width: 100%; max-height: min(62vh, 640px); object-fit: contain; border-radius: 14px; box-shadow: 0 30px 80px -30px rgba(180, 92, 255, .45); }
  .diapo-texto { display: grid; gap: 12px; }
  .diapo-texto h2 { margin: 0; font-size: clamp(1.6rem, 1.1rem + 2.4vw, 3rem); line-height: 1.1; }
  .diapo-texto p { margin: 0; color: var(--muted); font-size: clamp(1rem, .9rem + .5vw, 1.25rem); line-height: 1.55; }
  .diapo-texto ul { font-size: clamp(.95rem, .85rem + .4vw, 1.15rem); gap: 6px; }
  .nav-pres { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .puntos { display: flex; gap: 6px; }
  .puntos i { width: 8px; height: 8px; border-radius: 50%; background: var(--line); }
  .puntos i.corte { margin-left: 8px; }
  .puntos i.on { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
  @media (width < 40rem) { .puntos { display: none; } .diapo img { max-height: 34vh; } }
  @keyframes entra { from { opacity: 0; transform: translateX(24px); } }
  @media (prefers-reduced-motion: reduce) { .diapo { animation: none; } }
</style>
