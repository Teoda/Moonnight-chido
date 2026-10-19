<!-- Mi perfil: datos de la cuenta del cliente, tarjetas guardadas (ver y eliminar) y cambio de contraseña. -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { api } from '#lib/api/client.ts'
  import type { TarjetaGuardada } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { tarjetaTxt } from '#lib/utils/tarjeta.ts'
  import { numCliente } from '#lib/utils/formato.ts'
  import CambiarPassword from '#lib/components/CambiarPassword.svelte'
  import { confirmar } from '#lib/components/confirmar.svelte.ts'
  import { pedirSesion } from '#lib/components/sitio/auth.svelte.ts'

  const cliente = seleccionar((s) => s.sesion.cliente)
  const revisada = seleccionar((s) => s.sesion.revisada.cliente)

  let tarjetas = $state<TarjetaGuardada[] | null>(null)
  let errorTarjetas = $state('')
  let cambiarPw = $state(false)

  // Sin sesión: se pide iniciarla y se vuelve aquí
  $effect(() => {
    if (!$revisada) return
    if (!$cliente) { goto('/'); pedirSesion(() => goto('/perfil')) }
    else cargarTarjetas()
  })

  async function cargarTarjetas() {
    errorTarjetas = ''
    try { tarjetas = await api.get<TarjetaGuardada[]>('/cliente/tarjetas') }
    catch (x) { errorTarjetas = (x as Error).message }
  }

  async function eliminar(t: TarjetaGuardada) {
    if (!(await confirmar('Eliminar tarjeta', `¿Eliminar ${tarjetaTxt(t)}?`, { ok: 'Eliminar', peligro: true }))) return
    try {
      await api.delete(`/cliente/tarjetas/${t.id}`)
      tarjetas = tarjetas?.filter((x) => x.id !== t.id) ?? null
      dispatch(avisar('Tarjeta eliminada', 'ok'))
    } catch (x) { dispatch(avisar((x as Error).message, 'bad')) }
  }

  const vence = (t: TarjetaGuardada) => `${String(t.mesExp).padStart(2, '0')}/${String(t.anioExp).slice(-2)}`
</script>

<svelte:head><title>Mi perfil · Moonlight</title></svelte:head>

<div class="row between mb-4">
  <h1 class="titulo-pagina m-0">Mi perfil</h1>
  <a class="btn sm" href="/mis-reservaciones">Mis reservaciones</a>
</div>

{#if !$cliente}
  <div class="grid-2"><div class="skeleton bajo"></div><div class="skeleton bajo"></div></div>
{:else}
  <div class="perfil">
    <section class="card" aria-labelledby="t-datos">
      <h3 id="t-datos">Datos de la cuenta</h3>
      <dl class="datos">
        <dt>Número de cliente</dt><dd class="numero">{numCliente($cliente.id)}</dd>
        <dt>Nombre</dt><dd>{$cliente.nombre}</dd>
        <dt>Correo</dt><dd>{$cliente.email ?? '—'}</dd>
      </dl>
      <p class="muted small mt-3 mb-0">Si reservas directamente en Moonlight, da tu número de cliente en recepción para que esa visita cuente en tus promociones.</p>
    </section>

    <section class="card" aria-labelledby="t-seguridad">
      <h3 id="t-seguridad">Contraseña</h3>
      <p class="muted small">Al cambiarla se cierran tus sesiones abiertas en otros dispositivos.</p>
      <button class="btn" type="button" onclick={() => (cambiarPw = true)}>Cambiar contraseña</button>
    </section>

    <section class="card tarjetas" aria-labelledby="t-tarjetas">
      <h3 id="t-tarjetas">Tarjetas guardadas</h3>
      {#if errorTarjetas}
        <p class="err m-0">No se pudieron cargar tus tarjetas: {errorTarjetas}</p>
        <button class="btn sm mt-3" type="button" onclick={cargarTarjetas}>Reintentar</button>
      {:else if !tarjetas}
        <div class="skeleton bajo"></div>
      {:else if !tarjetas.length}
        <p class="muted m-0">
          No tienes tarjetas guardadas. Al pagar el anticipo de una reservación, marca
          «Guardar esta tarjeta para mis próximas reservaciones» y aparecerá aquí.
        </p>
      {:else}
        <ul class="lista">
          {#each tarjetas as t (t.id)}
            <li>
              <span class="marca">{t.marca}</span>
              <span class="num">•••• {t.ultimos4}</span>
              <span class="muted small">Vence {vence(t)}</span>
              <button class="btn sm danger ml-auto" type="button" aria-label="Eliminar {tarjetaTxt(t)}" onclick={() => eliminar(t)}>Eliminar</button>
            </li>
          {/each}
        </ul>
        <p class="muted small mt-3 mb-0">Solo guardamos la marca, los últimos 4 dígitos y el vencimiento.</p>
      {/if}
    </section>
  </div>
{/if}

<CambiarPassword bind:abierto={cambiarPw} />

<style>
  .perfil { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
  .datos { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 16px; margin: 0; }
  .datos dt { color: var(--muted); }
  .datos dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .datos .numero { color: var(--gold); font-weight: 700; letter-spacing: .04em; font-variant-numeric: tabular-nums; }
  .lista { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .lista li {
    display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 10px 12px;
    border: 1px solid var(--line); border-radius: 10px; background: var(--bg-2);
  }
  .marca { font-weight: 700; }
  .num { font-variant-numeric: tabular-nums; letter-spacing: .04em; }
  /* tableta y escritorio: datos y contraseña a la izquierda, tarjetas a la derecha */
  @media (width >= 48rem) {
    .perfil { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: start; }
    .tarjetas { grid-column: 2; grid-row: 1 / span 2; }
  }
</style>
