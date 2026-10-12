<!-- Iniciar sesión o crear cuenta (cliente). -->
<script lang="ts">
  import Modal from '../Modal.svelte'
  import CampoPassword from '../CampoPassword.svelte'
  import { auth } from './auth.svelte.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { loginCliente, registrarCliente } from '#lib/store/sesion.ts'
  import { cargarMis } from '#lib/store/mis.ts'
  import { avisar } from '#lib/store/ui.ts'
  import type { Cliente } from '#lib/api/types.ts'

  let modo = $state<'login' | 'registro'>('login')
  let error = $state(''), enviando = $state(false)
  let email = $state(''), password = $state('')
  let nombre = $state(''), telefono = $state(''), aceptaPromos = $state(false)

  async function enviar(e: SubmitEvent) {
    e.preventDefault()
    error = ''; enviando = true
    try {
      const cliente: Cliente = modo === 'login'
        ? await dispatch(loginCliente({ email, password })).unwrap()
        : await dispatch(registrarCliente({ nombre, email, password, aceptaPromos, ...(telefono ? { telefono } : {}) })).unwrap()
      password = ''
      dispatch(cargarMis({ silencioso: true }))
      dispatch(avisar(`Bienvenido, ${cliente.nombre.split(' ')[0]}`, 'ok'))
      const fn = auth.despues
      auth.abierto = false; auth.despues = null
      fn?.()
    } catch (x) { error = (x as Error).message } finally { enviando = false }
  }
</script>

<Modal bind:abierto={auth.abierto} titulo="Tu cuenta Moonlight" onclose={() => (auth.despues = null)}>
  {#if auth.aviso}<p class="muted">{auth.aviso}</p>{/if}
  <div class="tabs mb-4 flex gap-1.5 border-b border-line">
    <button type="button" class={modo === 'login' ? 'text-texto! border-b-accent!' : ''} onclick={() => { modo = 'login'; error = '' }}>Iniciar sesión</button>
    <button type="button" class={modo === 'registro' ? 'text-texto! border-b-accent!' : ''} onclick={() => { modo = 'registro'; error = '' }}>Crear cuenta</button>
  </div>
  <form onsubmit={enviar}>
    {#if modo === 'registro'}
      <div class="field"><label for="r-nombre">Nombre</label><input id="r-nombre" bind:value={nombre} required minlength="2" maxlength="120" autocomplete="name" /></div>
    {/if}
    <div class="field"><label for="a-email">Correo</label><input id="a-email" type="email" bind:value={email} required autocomplete="email" /></div>
    {#if modo === 'registro'}
      <div class="field"><label for="r-tel">Teléfono (opcional, 10 dígitos)</label><input id="r-tel" type="tel" inputmode="numeric" bind:value={telefono} autocomplete="tel" /></div>
      <CampoPassword id="r-pw" etiqueta="Contraseña (mín. 10 caracteres, letras y números)" bind:valor={password} nuevo />
      <div class="field"><label class="check"><input type="checkbox" bind:checked={aceptaPromos} /> Quiero recibir promociones</label></div>
    {:else}
      <CampoPassword id="a-pw" etiqueta="Contraseña" bind:valor={password} />
    {/if}
    <div class="err">{error}</div>
    <button class="btn primary w-full justify-center" type="submit" disabled={enviando}>
      {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
    </button>
  </form>
</Modal>
