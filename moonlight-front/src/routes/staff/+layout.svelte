<!-- Panel del personal: inicio de sesión, reloj y pestañas según el rol. -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { slide } from 'svelte/transition'
  import { alExpirarSesion } from '#lib/api/client.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { cargarCatalogo } from '#lib/store/catalogo.ts'
  import { iniciarSesion, revisarStaff, salirStaff, staffExpirado } from '#lib/store/sesion.ts'
  import { cargarMis } from '#lib/store/mis.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { ROLES } from '#lib/utils/estados.ts'
  import { fmtReloj } from '#lib/utils/formato.ts'
  import { ahora } from '#lib/fx/efectos.ts'
  import { pestanasDe } from '#lib/components/staff/panel.svelte.ts'
  import CampoPassword from '#lib/components/CampoPassword.svelte'
  import CambiarPassword from '#lib/components/CambiarPassword.svelte'

  let { children }: { children: Snippet } = $props()

  const usuario = seleccionar((s) => s.sesion.usuario)
  const revisada = seleccionar((s) => s.sesion.revisada.staff)
  const tabs = $derived(pestanasDe($usuario?.rol))
  let email = $state(''), password = $state(''), error = $state(''), enviando = $state(false)
  let cambiarPw = $state(false)
  let menu = $state(false) // menú desplegable en pantallas chicas
  $effect(() => { void page.url.pathname; menu = false })

  $effect(() => {
    alExpirarSesion('staff', () => {
      dispatch(staffExpirado())
      dispatch(avisar('Tu sesión expiró. Vuelve a entrar.', 'bad'))
    })
    dispatch(revisarStaff())
    dispatch(cargarCatalogo())
  })

  // Inicio de sesión unificado: con credenciales del personal se entra al panel; con las de un cliente,
  // se le lleva a sus reservaciones en el sitio.
  async function entrar(e: SubmitEvent) {
    e.preventDefault()
    error = ''; enviando = true
    try {
      const r = await dispatch(iniciarSesion({ email, password })).unwrap()
      password = ''
      if (r.tipo === 'cliente') {
        dispatch(cargarMis({ silencioso: true }))
        dispatch(avisar(`Bienvenido, ${r.cliente.nombre.split(' ')[0]}`, 'ok'))
        goto('/mis-reservaciones')
      }
    } catch (x) { error = (x as Error).message } finally { enviando = false }
  }
</script>

<svelte:head><title>Moonlight · Personal</title><meta name="robots" content="noindex" /></svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') menu = false }} />

<header class="topbar">
  <div class="wrap flex min-h-16 items-center gap-4">
    <a class="brand min-w-0" href="/staff">
      <img class="logo-img isotipo -my-1.5 -mr-0.5 -ml-2 h-[42px] w-[42px]" src="/img/isotipo.jpg" alt="" width="42" height="42" />Moonlight <small class="muted small hidden sm:inline">· personal</small>
    </a>
    <div class="flex-1"></div>
    <span class="reloj hidden sm:inline" aria-label="Hora actual">{fmtReloj($ahora)}</span>
    {#if $usuario}
      <span class="badge accent">{ROLES[$usuario.rol] || $usuario.rol}</span>
      <div class="hidden items-center gap-2 md:flex">
        <span class="small">{$usuario.nombre}</span>
        <button class="btn sm ghost" type="button" onclick={() => (cambiarPw = true)}>Contraseña</button>
        <button class="btn sm" type="button" onclick={() => dispatch(salirStaff(false))}>Salir</button>
      </div>
      <button class="hamburguesa md:hidden" class:abierta={menu} type="button" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menu} aria-controls="menu-staff" onclick={() => (menu = !menu)}><span></span><span></span><span></span></button>
    {/if}
  </div>
  {#if menu && $usuario}
    <div id="menu-staff" class="menu-movil md:hidden" transition:slide={{ duration: 220 }}>
      {#if tabs.length}
        <nav class="wrap flex flex-col gap-0.5 py-2" aria-label="Secciones (móvil)">
          {#each tabs as t (t.ruta)}
            <a class="nav-link" class:active={page.url.pathname === `/staff/${t.ruta}`} href="/staff/{t.ruta}" onclick={() => (menu = false)}>{t.titulo}</a>
          {/each}
        </nav>
      {/if}
      <div class="wrap flex flex-wrap items-center gap-2 border-t border-line py-3">
        <span class="small">{$usuario.nombre}</span>
        <span class="reloj small sm:hidden">{fmtReloj($ahora)}</span>
        <div class="flex-1"></div>
        <button class="btn sm ghost" type="button" onclick={() => { menu = false; cambiarPw = true }}>Contraseña</button>
        <button class="btn sm" type="button" onclick={() => { menu = false; dispatch(salirStaff(false)) }}>Salir</button>
      </div>
    </div>
  {/if}
</header>
{#if menu}<button class="menu-velo md:hidden" type="button" aria-label="Cerrar menú" tabindex="-1" onclick={() => (menu = false)}></button>{/if}

<main class="wrap pt-7 pb-16">
  {#if !$revisada}
    <div class="empty"><span class="spinner"></span></div>
  {:else if !$usuario}
    <div class="card pad-lg mx-auto my-[8vh] max-w-[400px]">
      <img class="logo-img mx-auto -mt-1.5 mb-2 w-full max-w-[300px]" src="/img/logo.jpg" alt="Moonlight Karaoke &amp; Social Lounge" width="1000" height="607" />
      <h2 class="text-center text-[1.3rem]">Iniciar sesión</h2>
      <p class="muted small text-center">Personal o cliente: entra con tu correo y contraseña.</p>
      <form onsubmit={entrar}>
        <div class="field"><label for="l-email">Correo</label><input id="l-email" type="email" bind:value={email} required autocomplete="username" /></div>
        <CampoPassword id="l-pw" etiqueta="Contraseña" bind:valor={password} />
        <div class="err">{error}</div>
        <button class="btn primary w-full justify-center" type="submit" disabled={enviando}>Entrar</button>
      </form>
      <p class="muted small mt-4"><a href="/">← Volver al sitio</a></p>
    </div>
  {:else}
    <nav class="tabs mb-4.5 hidden flex-wrap gap-1.5 border-b border-line md:flex" aria-label="Secciones">
      {#each tabs as t (t.ruta)}
        <a href="/staff/{t.ruta}" class:on={page.url.pathname === `/staff/${t.ruta}`}>{t.titulo}</a>
      {/each}
    </nav>
    {#if !tabs.length}
      <p class="muted">Tu rol aún no tiene secciones en este panel.</p>
    {:else}
      {#key page.url.pathname}<div class="vista">{@render children()}</div>{/key}
    {/if}
  {/if}
</main>

<CambiarPassword bind:abierto={cambiarPw} ambito="staff" />
