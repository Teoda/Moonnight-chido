<!-- Sitio de clientes: barra superior, pie y lo que corre en segundo plano (sesión, avisos de la visita). -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { slide } from 'svelte/transition'
  import { alExpirarSesion, sesionDe } from '#lib/api/client.ts'
  import type { Usuario } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { cargarCatalogo } from '#lib/store/catalogo.ts'
  import { clienteExpirado, revisarCliente, salirCliente } from '#lib/store/sesion.ts'
  import { alertar, cargarMis, olvidar, revisarTiempos } from '#lib/store/mis.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { resumenHorario } from '#lib/utils/carta.ts'
  import { fmtHora } from '#lib/utils/formato.ts'
  import Modal from '#lib/components/Modal.svelte'
  import AuthModal from '#lib/components/sitio/AuthModal.svelte'
  import EstadoCuenta from '#lib/components/sitio/EstadoCuenta.svelte'
  import { pedirSesion } from '#lib/components/sitio/auth.svelte.ts'
  import Notificaciones from '#lib/components/sitio/Notificaciones.svelte'

  let { children }: { children: Snippet } = $props()

  const cliente = seleccionar((s) => s.sesion.cliente)
  const catalogo = seleccionar((s) => s.catalogo.datos)
  const alerta = seleccionar((s) => s.mis.alerta)
  const lista = seleccionar((s) => s.mis.lista)
  let esAdmin = $state(false)
  let menu = $state(false) // menú desplegable en pantallas chicas

  // al cambiar de página se cierra el menú
  $effect(() => { void page.url.pathname; menu = false })

  // "Reservar" no va aquí: es el botón destacado "Reservar sala" de la barra
  const enlaces = [
    ['/', 'Inicio'], ['/salas', 'Salas'], ['/menu', 'Menú'],
  ] as const

  $effect(() => {
    // la sesión del cliente se cierra tras 1 h sin actividad: se avisa en lugar de fallar en silencio
    alExpirarSesion('cliente', () => {
      dispatch(clienteExpirado()); dispatch(olvidar())
      dispatch(avisar('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.', 'bad'))
    })
    dispatch(cargarCatalogo())
    dispatch(revisarCliente()).then((a) => { if (a.payload) dispatch(cargarMis({ silencioso: true })) })
    // "Panel de administración" solo aparece si en este navegador hay una sesión de Administración abierta
    // y NO hay un cliente con sesión en el sitio (las pestañas comparten cookies: un cliente nunca debe verlo)
    sesionDe<{ usuario: Usuario }>('staff').then((d) => (esAdmin = d?.usuario.rol === 'ADMIN' || d?.usuario.rol === 'SUPERADMIN'))
    // reservaciones del cliente: se revisan cada 20 s en cualquier página para poder avisarle
    const revisar = setInterval(() => { if ($cliente && !document.hidden) dispatch(cargarMis({ silencioso: true })) }, 20_000)
    const tiempos = setInterval(() => dispatch(revisarTiempos() as never), 1000) // avisos de 10 / 5 min y fin
    return () => { clearInterval(revisar); clearInterval(tiempos) }
  })

  const rAlerta = $derived($alerta ? $lista?.find((r) => r.codigo === $alerta.codigo) ?? null : null)

  async function salir() {
    await dispatch(salirCliente())
    dispatch(olvidar())
    if (['/mis-reservaciones', '/perfil'].some((r) => page.url.pathname.startsWith(r))) goto('/')
  }
  // en Reservar el pie es mínimo (solo marca): el cliente se concentra en completar su reservación
  const pieMinimo = $derived(page.url.pathname.startsWith('/reservar'))
  const activo = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href))
</script>

{#snippet navegacion()}
  {#each enlaces as [href, txt] (href)}
    <a class="nav-link" class:active={activo(href)} aria-current={activo(href) ? 'page' : undefined} {href} onclick={() => (menu = false)}>{txt}</a>
  {/each}
  {#if $cliente}<a class="nav-link" class:active={activo('/mis-reservaciones')} href="/mis-reservaciones" onclick={() => (menu = false)}>Mis reservaciones</a>{/if}
{/snippet}

{#snippet cuenta()}
  {#if $cliente}
    <span class="saludo">Hola, {$cliente.nombre.split(' ')[0]}</span>
    <a class="btn sm ghost" href="/perfil" aria-current={activo('/perfil') ? 'page' : undefined} onclick={() => (menu = false)}>Mi perfil</a>
    <button class="btn sm" type="button" onclick={() => { menu = false; salir() }}>Salir</button>
  {:else}
    <button class="btn sm ghost" type="button" onclick={() => { menu = false; pedirSesion() }}>Iniciar sesión</button>
  {/if}
{/snippet}

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') menu = false }} />

<!-- .sitio: sistema visual Moonlight 2.0 del sitio de clientes (no alcanza al panel del personal) -->
<div class="sitio contents">
<header class="topbar">
  <div class="wrap barra">
    <a class="brand" href="/" aria-label="Moonlight, ir al inicio">
      <img class="logo-img isotipo" src="/img/isotipo.jpg" alt="" width="40" height="40" /><span class="brand-texto">Moonlight</span>
    </a>
    <nav class="nav-principal" aria-label="Principal">{@render navegacion()}</nav>
    <div class="barra-acciones">
      <Notificaciones />
      <div class="cuenta-escritorio">{@render cuenta()}</div>
      <a class="btn primary reservar" href="/reservar" aria-current={activo('/reservar') ? 'page' : undefined}>Reservar<span class="reservar-extra">sala</span></a>
      <button class="hamburguesa" class:abierta={menu} type="button" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menu} aria-controls="menu-movil" onclick={() => (menu = !menu)}><span></span><span></span><span></span></button>
    </div>
  </div>
  {#if menu}
    <div id="menu-movil" class="menu-movil" transition:slide={{ duration: 220 }}>
      <nav class="wrap flex flex-col gap-0.5 py-2" aria-label="Principal (móvil)">{@render navegacion()}</nav>
      <div class="wrap flex flex-wrap items-center gap-2 border-t border-line py-3">{@render cuenta()}</div>
    </div>
  {/if}
</header>
{#if menu}<button class="menu-velo" type="button" aria-label="Cerrar menú" tabindex="-1" onclick={() => (menu = false)}></button>{/if}

<main class="wrap pt-7 pb-16">
  {#key page.url.pathname}
    <div class="vista">{@render children()}</div>
  {/key}
</main>

<footer class="pie" class:minimo={pieMinimo}>
  <div class="wrap pie-grid">
    <div class="pie-marca">
      <a href="/" aria-label="Moonlight, ir al inicio"><img class="logo-img" src="/img/logo.jpg" alt="Moonlight Karaoke &amp; Social Lounge" width="1000" height="607" loading="lazy" /></a>
      <p>Salas privadas de karaoke para cantar con tu gente, con la música que tú elijas.</p>
      {#if !pieMinimo}<a class="btn primary" href="/reservar">Reservar sala</a>{/if}
    </div>

    {#if !pieMinimo}

    <nav class="pie-col" aria-labelledby="pie-explora">
      <h2 id="pie-explora">Explora</h2>
      <ul>
        <li><a href="/">Inicio</a></li>
        <li><a href="/salas">Salas</a></li>
        <li><a href="/menu">Menú</a></li>
        <li><a href="/reservar">Reservar</a></li>
      </ul>
    </nav>

    <nav class="pie-col" aria-labelledby="pie-cuenta">
      <h2 id="pie-cuenta">Tu cuenta</h2>
      <ul>
        {#if $cliente}
          <li><a href="/mis-reservaciones">Mis reservaciones</a></li>
          <li><a href="/perfil">Mi perfil</a></li>
        {:else}
          <li><button type="button" class="pie-enlace" onclick={() => pedirSesion()}>Iniciar sesión o crear cuenta</button></li>
        {/if}
      </ul>
    </nav>

    <div class="pie-col">
      <h2>Visítanos</h2>
      <dl>
        {#if resumenHorario($catalogo?.horarios)}<dt>Horario</dt><dd>{resumenHorario($catalogo?.horarios)}</dd>{/if}
        <dt>Ubicación</dt>
        <dd><a href="https://goo.gl/maps/VUutLXRjVrHx4v8Z6" target="_blank" rel="noopener">Cómo llegar en Google Maps</a></dd>
      </dl>
    </div>
    {/if}
  </div>

  {#if !pieMinimo}
  <div class="wrap pie-legal">
    <span>© {new Date().getFullYear()} Moonlight Karaoke &amp; Social Lounge</span>
    {#if esAdmin && !$cliente}<a href="/staff">Panel de administración</a>{/if}
  </div>
  {/if}
</footer>

<AuthModal />

{#if $alerta && rAlerta}
  <Modal abierto titulo={$alerta.tipo === 'tiempoTerminado' ? '⏰ Tu tiempo terminó' : '🧾 Tu cuenta se cerró'} onclose={() => dispatch(alertar(null))}>
    {#if $alerta.tipo === 'tiempoTerminado'}
      <p>Se terminó el tiempo de tu sala {rAlerta.sala.numero} ({fmtHora(rAlerta.inicio)}–{fmtHora(rAlerta.fin)}).</p>
      <p class="muted">Pasa a recepción para cerrar tu cuenta. Si la sala no tiene otra reservación, ahí también puedes pedir tiempo extra.</p>
    {:else}
      <p>¡Gracias por cantar en Moonlight! Este es el resumen de tu visita a la sala {rAlerta.sala.numero}.</p>
    {/if}
    <EstadoCuenta r={rAlerta} />
    {#snippet pie()}
      <button class="btn primary" type="button" onclick={() => dispatch(alertar(null))}>{$alerta?.tipo === 'tiempoTerminado' ? 'Entendido' : 'Listo'}</button>
    {/snippet}
  </Modal>
{/if}
</div>
