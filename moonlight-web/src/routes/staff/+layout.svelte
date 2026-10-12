<!-- Panel del personal: inicio de sesión, reloj y pestañas según el rol. -->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import { alExpirarSesion } from '#lib/api/client.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { cargarCatalogo } from '#lib/store/catalogo.ts'
  import { loginStaff, revisarStaff, salirStaff, staffExpirado } from '#lib/store/sesion.ts'
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

  $effect(() => {
    alExpirarSesion('staff', () => {
      dispatch(staffExpirado())
      dispatch(avisar('Tu sesión expiró. Vuelve a entrar.', 'bad'))
    })
    dispatch(revisarStaff())
    dispatch(cargarCatalogo())
  })

  async function entrar(e: SubmitEvent) {
    e.preventDefault()
    error = ''; enviando = true
    try { await dispatch(loginStaff({ email, password })).unwrap(); password = '' } catch (x) { error = (x as Error).message } finally { enviando = false }
  }
</script>

<svelte:head><title>Moonlight · Personal</title><meta name="robots" content="noindex" /></svelte:head>

<header class="topbar">
  <div class="wrap flex min-h-16 flex-wrap items-center gap-4">
    <a class="brand" href="/staff">
      <img class="logo-img isotipo -my-1.5 -mr-0.5 -ml-2 h-[42px] w-[42px]" src="/img/isotipo.jpg" alt="" width="42" height="42" />Moonlight <small class="muted small">· personal</small>
    </a>
    <div class="flex-1"></div>
    <span class="reloj hidden sm:inline" aria-label="Hora actual">{fmtReloj($ahora)}</span>
    {#if $usuario}
      <div class="flex flex-wrap items-center gap-2">
        <span class="small hidden sm:inline">{$usuario.nombre}</span>
        <span class="badge accent">{ROLES[$usuario.rol] || $usuario.rol}</span>
        <button class="btn sm ghost" type="button" onclick={() => (cambiarPw = true)}>Contraseña</button>
        <button class="btn sm" type="button" onclick={() => dispatch(salirStaff(false))}>Salir</button>
      </div>
    {/if}
  </div>
</header>

<main class="wrap pt-7 pb-16">
  {#if !$revisada}
    <div class="empty"><span class="spinner"></span></div>
  {:else if !$usuario}
    <div class="card pad-lg mx-auto my-[8vh] max-w-[400px]">
      <img class="logo-img mx-auto -mt-1.5 mb-2 w-full max-w-[300px]" src="/img/logo.jpg" alt="Moonlight Karaoke &amp; Social Lounge" width="1000" height="607" />
      <h2 class="text-center text-[1.3rem]">Acceso del personal</h2>
      <form onsubmit={entrar}>
        <div class="field"><label for="l-email">Correo</label><input id="l-email" type="email" bind:value={email} required autocomplete="username" /></div>
        <CampoPassword id="l-pw" etiqueta="Contraseña" bind:valor={password} />
        <div class="err">{error}</div>
        <button class="btn primary w-full justify-center" type="submit" disabled={enviando}>Entrar</button>
      </form>
      <p class="muted small mt-4"><a href="/">← Volver al sitio</a></p>
    </div>
  {:else}
    <nav class="tabs mb-4.5 flex flex-wrap gap-1.5 border-b border-line" aria-label="Secciones">
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
