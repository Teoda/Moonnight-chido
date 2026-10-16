<!-- Reservación en el establecimiento: para un cliente registrado (por su número de cliente) o para un cliente
     nuevo sin registro (solo nombre; teléfono opcional). Las visitas cuentan para las promociones por cliente. -->
<script lang="ts">
  import { api } from '#lib/api/client.ts'
  import type { Catalogo, MetodoMostrador } from '#lib/api/types.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { nombreBotella, tipoPara } from '#lib/utils/carta.ts'
  import { durTxt, money, numCliente } from '#lib/utils/formato.ts'
  import Modal from '../Modal.svelte'
  import MetodoPago from './MetodoPago.svelte'

  let { abierto = $bindable(false), cat, oncreada }: { abierto?: boolean; cat: Catalogo; oncreada: (codigo: string) => void } = $props()

  // valores iniciales tomados del catálogo al abrir el formulario
  const inicial = () => ({ tipo: tipoPara(cat.tipos, 2)?.id ?? cat.tipos[0]?.id, botella: cat.cortesia?.botellas[0]?.id ?? 0 })
  let nombre = $state(''), telefono = $state(''), personas = $state(2), duracionMin = $state(60)
  // ¿ya es cliente? → se busca por su número de cliente
  type Encontrado = { id: number; nombre: string; telefono: string | null; registrado: boolean; visitasMes: number; visitas: number }
  let esCliente = $state(false), numero = $state(''), encontrado = $state<Encontrado | null>(null), buscando = $state(false)

  async function buscarCliente() {
    error = ''; encontrado = null
    if (!numero.trim()) { error = 'Escribe el número de cliente'; return }
    buscando = true
    try { encontrado = await api.get<Encontrado>('/staff/clientes/' + encodeURIComponent(numero.trim())) }
    catch (x) { error = (x as Error).message } finally { buscando = false }
  }
  let tipoSalaId = $state(inicial().tipo)
  let tematicaId = $state(''), salaNumero = $state(''), metodo = $state<MetodoMostrador>('EFECTIVO')
  let ahora = $state(true), inicio = $state(''), error = $state(''), enviando = $state(false)
  let botella = $state(inicial().botella)
  const conBotella = $derived(!!cat.cortesia?.botellas.length && tipoSalaId === cat.cortesia.tipoSalaId)

  // el tamaño se sugiere por personas, pero recepción puede cambiarlo
  function cambiarPersonas() {
    const t = tipoPara(cat.tipos, personas)
    if (t) tipoSalaId = t.id
  }

  async function crear(e: SubmitEvent) {
    e.preventDefault()
    error = ''
    if (!ahora && !inicio) { error = 'Indica la fecha y hora de inicio'; return }
    if (esCliente && !encontrado) { error = 'Busca primero al cliente por su número'; return }
    const body: Record<string, unknown> = { personas, duracionMin, metodo, tipoSalaId }
    if (esCliente && encontrado) body.numeroCliente = encontrado.id
    else { body.nombre = nombre; if (telefono) body.telefono = telefono }
    if (tematicaId) body.tematicaId = Number(tematicaId)
    if (salaNumero) body.salaNumero = Number(salaNumero)
    if (conBotella) body.cortesiaProductoId = botella
    if (!ahora) body.inicio = new Date(`${inicio}:00-06:00`).toISOString() // hora de México
    enviando = true
    try {
      const r = await api.post<{ codigo: string; sala: number; cobrado: string }>('/staff/reservaciones/mostrador', body)
      abierto = false
      dispatch(avisar(`Reservación ${r.codigo} · sala ${r.sala} · cobrado ${money(r.cobrado)}`, 'ok'))
      nombre = ''; telefono = ''; numero = ''; encontrado = null; esCliente = false
      oncreada(r.codigo)
    } catch (x) { error = (x as Error).message } finally { enviando = false }
  }
</script>

<Modal bind:abierto titulo="Reservación en el establecimiento">
  <form id="form-mostrador" onsubmit={crear}>
    <fieldset class="quien">
      <legend>¿Ya es cliente?</legend>
      <label class="check"><input type="radio" name="m-quien" checked={esCliente} onchange={() => { esCliente = true; error = '' }} /> Sí, tiene número de cliente</label>
      <label class="check"><input type="radio" name="m-quien" checked={!esCliente} onchange={() => { esCliente = false; encontrado = null; error = '' }} /> No, es cliente nuevo</label>
    </fieldset>

    {#if esCliente}
      <div class="buscar">
        <div class="field m-0 flex-1"><label for="m-num">Número de cliente</label>
          <input id="m-num" placeholder="MC-0023" autocomplete="off" bind:value={numero} oninput={() => (encontrado = null)}
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarCliente() } }} /></div>
        <button class="btn" type="button" disabled={buscando} onclick={buscarCliente}>{buscando ? 'Buscando…' : 'Buscar'}</button>
      </div>
      {#if encontrado}
        <div class="encontrado" role="status">
          <b>{encontrado.nombre}</b> · {numCliente(encontrado.id)}{#if encontrado.telefono}{' · '}{encontrado.telefono}{/if}
          <span class="muted small block">Visitas este mes: {encontrado.visitasMes} · en total: {encontrado.visitas}</span>
        </div>
      {/if}
    {:else}
      <p class="muted small">Al terminar, ofrécele registrarse en la página: después vincula esta visita con su número de cliente en «Vincular visitas».</p>
    {/if}

    <div class="form-grid">
      {#if !esCliente}
        <div class="field"><label for="m-nombre">Nombre</label><input id="m-nombre" bind:value={nombre} required minlength="2" maxlength="120" /></div>
        <div class="field"><label for="m-tel">Teléfono (opcional)</label><input id="m-tel" type="tel" inputmode="numeric" bind:value={telefono} /></div>
      {/if}
      <div class="field"><label for="m-personas">Personas</label><input id="m-personas" type="number" min="1" max="16" required bind:value={personas} oninput={cambiarPersonas} /></div>
      <div class="field"><label for="m-dur">Duración</label>
        <select id="m-dur" bind:value={duracionMin}>{#each [60, 90, 120, 150, 180, 210, 240] as n (n)}<option value={n}>{durTxt(n)}</option>{/each}</select></div>
      <div class="field"><label for="m-tipo">Tamaño de sala</label>
        <select id="m-tipo" bind:value={tipoSalaId}>{#each cat.tipos as t (t.id)}<option value={t.id}>{t.nombre} (hasta {t.capacidadMax})</option>{/each}</select></div>
      <div class="field"><label for="m-genero">Género musical</label>
        <select id="m-genero" bind:value={tematicaId}><option value="">Lo elige en sala</option>{#each cat.tematicas as t (t.id)}<option value={String(t.id)}>{t.nombre}</option>{/each}</select></div>
      <div class="field"><label for="m-sala">Sala # (opcional)</label><input id="m-sala" type="number" min="1" bind:value={salaNumero} /></div>
      <div class="field"><label for="m-metodo">Método de pago</label><MetodoPago id="m-metodo" bind:valor={metodo} /></div>
      {#if conBotella && cat.cortesia}
        <div class="field"><label for="m-botella">🍾 Botella de cortesía (Sala Premium)</label>
          <select id="m-botella" bind:value={botella}>{#each cat.cortesia.botellas as b (b.id)}<option value={b.id}>{nombreBotella(b.nombre)}</option>{/each}</select></div>
      {/if}
    </div>
    <div class="field"><label class="check"><input type="checkbox" bind:checked={ahora} /> Iniciar ahora (la sala debe estar lista)</label></div>
    <div class="field"><label for="m-inicio">O programar para (hora de México)</label><input id="m-inicio" type="datetime-local" disabled={ahora} bind:value={inicio} /></div>
    <div class="err">{error}</div>
  </form>
  {#snippet pie()}
    <button class="btn ghost" type="button" onclick={() => (abierto = false)}>Volver</button>
    <button class="btn primary" type="submit" form="form-mostrador" disabled={enviando}>Cobrar sala y reservar</button>
  {/snippet}
</Modal>

<style>
  .quien { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0 0 14px; padding: 0; border: 0; }
  .quien legend { width: 100%; margin-bottom: 6px; color: var(--muted); font-size: .85rem; }
  .buscar { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 10px; }
  .encontrado { margin-bottom: 14px; padding: 10px 12px; border: 1px solid rgba(79, 209, 165, .45); border-radius: 10px; background: rgba(79, 209, 165, .06); }
</style>
