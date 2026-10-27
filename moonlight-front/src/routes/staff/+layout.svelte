<!-- Panel del personal: inicio de sesión, reloj y pestañas según el rol. -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { slide } from 'svelte/transition'
  import { alExpirarSesion } from '#lib/api/client.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { cargarCatalogo } from '#lib/store/catalogo.ts'
  import { api } from '#lib/api/client.ts'
  import { iniciarPersonal, revisarStaff, salirStaff, staffExpirado } from '#lib/store/sesion.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { ROLES } from '#lib/utils/estados.ts'
  import { fmtReloj } from '#lib/utils/formato.ts'
  import { ahora } from '#lib/fx/efectos.ts'
  import { esSuper, pestanasDe } from '#lib/components/staff/panel.svelte.ts'
  import Personal from '#lib/components/staff/Personal.svelte'
  import TurnoBarra from '#lib/components/staff/TurnoBarra.svelte'

  let { children }: { children: Snippet } = $props()

  const usuario = seleccionar((s) => s.sesion.usuario)
  const revisada = seleccionar((s) => s.sesion.revisada.staff)
  const tabs = $derived(pestanasDe($usuario?.rol))
  // entrar escribiendo la dirección de una pestaña que el rol no ve: se va a la primera que sí
  const ruta = $derived(page.url.pathname.split('/')[2] ?? '')
  const permitida = $derived(!ruta || tabs.some((t) => t.ruta === ruta))
  $effect(() => { if ($usuario && !permitida && tabs[0]) goto(`/staff/${tabs[0].ruta}`, { replaceState: true }) })
  let error = $state(''), enviando = $state(false)
  let personal = $state(false) // ventana Personal (llaves), solo Administración
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

  // ── acceso: nombre del trabajador + llave de 8 números; atajo arriba para la súper administración ──
  let nombres = $state<{ id: number; nombre: string; super: boolean }[] | null>(null)
  let usuarioId = $state(''), llave = $state('')
  let comoSuper = $state(false)
  const visibles = $derived(nombres?.filter((n) => n.super === comoSuper) ?? [])
  function cambiarAcceso(s: boolean) { comoSuper = s; usuarioId = ''; llave = ''; error = '' }
  $effect(() => {
    if ($revisada && !$usuario && !nombres)
      api.get<{ id: number; nombre: string; super: boolean }[]>('/acceso/personal').then((l) => (nombres = l), () => (nombres = []))
  })

  async function entrar(e: SubmitEvent) {
    e.preventDefault()
    error = ''
    if (!/^\d{8}$/.test(llave)) { error = 'La llave tiene 8 números'; return }
    enviando = true
    try {
      await dispatch(iniciarPersonal({ usuarioId: Number(usuarioId), llave })).unwrap()
      llave = ''
    } catch (x) { error = (x as Error).message; llave = '' } finally { enviando = false }
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
        {#if esSuper($usuario.rol)}<button class="btn sm ghost" type="button" onclick={() => (personal = true)}>Personal</button>{/if}
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
        {#if esSuper($usuario.rol)}<button class="btn sm ghost" type="button" onclick={() => { menu = false; personal = true }}>Personal</button>{/if}
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
      <div class="acceso-tipo" role="group" aria-label="Tipo de acceso">
        <button type="button" aria-pressed={!comoSuper} onclick={() => cambiarAcceso(false)}>Personal</button>
        <button type="button" aria-pressed={comoSuper} onclick={() => cambiarAcceso(true)}>Súper administración</button>
      </div>
      <h2 class="text-center text-[1.3rem]">{comoSuper ? 'Súper administración' : 'Acceso del personal'}</h2>
      <p class="muted small text-center">Elige tu nombre y escribe tu llave de 8 números.</p>
      <form onsubmit={entrar}>
        <div class="field">
          <label for="l-nombre">{comoSuper ? 'Administradora' : 'Trabajador'}</label>
          <select id="l-nombre" bind:value={usuarioId} required disabled={!nombres}>
            <option value="" disabled>{nombres ? 'Elige tu nombre' : 'Cargando…'}</option>
            {#each visibles as n (n.id)}<option value={String(n.id)}>{n.nombre}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="l-llave">Llave de acceso</label>
          <input id="l-llave" class="llave" type="password" inputmode="numeric" autocomplete="off" maxlength="8" required
            value={llave} oninput={(e) => (llave = e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 8))} />
        </div>
        <div class="err" role="alert">{error}</div>
        <button class="btn primary w-full justify-center" type="submit" disabled={enviando || !usuarioId || llave.length !== 8}>Entrar</button>
      </form>
      <p class="muted small mt-4 text-center">¿Eres cliente? <a href="/">Entra desde el sitio</a>.</p>
    </div>
  {:else}
    {#if !esSuper($usuario.rol)}<TurnoBarra />{/if}
    <nav class="tabs mb-4.5 hidden flex-wrap gap-1.5 border-b border-line md:flex" aria-label="Secciones">
      {#each tabs as t (t.ruta)}
        <a href="/staff/{t.ruta}" class:on={page.url.pathname === `/staff/${t.ruta}`}>{t.titulo}</a>
      {/each}
    </nav>
    {#if !tabs.length}
      <p class="muted">Tu rol aún no tiene secciones en este panel.</p>
    {:else if permitida}
      {#key page.url.pathname}<div class="vista">{@render children()}</div>{/key}
    {/if}
  {/if}
</main>

{#if esSuper($usuario?.rol)}<Personal bind:abierto={personal} yo={$usuario.id} />{/if}

<style>
  .llave { letter-spacing: .35em; font-size: 1.2rem; font-variant-numeric: tabular-nums; }
  .acceso-tipo { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 4px 0 16px; padding: 4px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg-2); }
  .acceso-tipo button {
    padding: 8px 6px; border: 0; border-radius: 9px; background: none; color: var(--muted); font: inherit; font-size: .88rem; font-weight: 600; cursor: pointer;
    transition: background .2s, color .2s;
  }
  .acceso-tipo button:hover { color: var(--text); }
  .acceso-tipo button[aria-pressed='true'] { background: linear-gradient(90deg, var(--accent), var(--accent-2)); color: #fff; }
</style>
