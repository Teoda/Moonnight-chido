<!-- Mis reservaciones: estado en vivo (cuenta regresiva, progreso de la visita) y acciones del cliente. -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { api } from '#lib/api/client.ts'
  import type { Disponibilidad, ReservacionCliente } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { cargarMis } from '#lib/store/mis.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { horarioDe, lineaItem, noLaboral } from '#lib/utils/carta.ts'
  import { durTxt, falta, fmtHora, fmtRango, hoyLocal, lineas, money, num } from '#lib/utils/formato.ts'
  import { ahora, inclinar, revelar } from '#lib/fx/efectos.ts'
  import Badge from '#lib/components/Badge.svelte'
  import Modal from '#lib/components/Modal.svelte'
  import Progreso from '#lib/components/Progreso.svelte'
  import SelectorMenu from '#lib/components/SelectorMenu.svelte'
  import EstadoCuenta from '#lib/components/sitio/EstadoCuenta.svelte'
  import PagoModal, { type DatosPago } from '#lib/components/sitio/PagoModal.svelte'
  import { confirmar } from '#lib/components/confirmar.svelte.ts'
  import { pedirSesion } from '#lib/components/sitio/auth.svelte.ts'

  const cliente = seleccionar((s) => s.sesion.cliente)
  const revisada = seleccionar((s) => s.sesion.revisada.cliente)
  const mis = seleccionar((s) => s.mis)
  const cat = seleccionar((s) => s.catalogo.datos)

  // Sin sesión: se pide iniciarla y se vuelve aquí
  $effect(() => {
    if (!$revisada) return
    if (!$cliente) { goto('/'); pedirSesion(() => goto('/mis-reservaciones')) }
    else dispatch(cargarMis())
  })

  let pago = $state<DatosPago | null>(null)
  let cuenta = $state<ReservacionCliente | null>(null)

  // ── reagendar ──
  let reag = $state<ReservacionCliente | null>(null)
  let reagFecha = $state(hoyLocal())
  let reagSlots = $state<Disponibilidad | null>(null)
  let reagError = $state(''), reagElegido = $state<string | null>(null), reagCargando = $state(false)
  const durDe = (x: ReservacionCliente) => Math.round((new Date(x.fin).getTime() - new Date(x.inicio).getTime()) / 6e4)

  function abrirReagendar(x: ReservacionCliente) {
    reag = x
    const abiertos = new Set(($cat?.horarios ?? []).map((h) => h.diaSemana))
    reagFecha = Array.from({ length: 8 }, (_, i) => hoyLocal(i)).find((f) => abiertos.has(new Date(f + 'T00:00:00Z').getUTCDay())) ?? hoyLocal()
    buscarReag()
  }
  async function buscarReag() {
    if (!reag) return
    reagElegido = null; reagSlots = null; reagError = ''
    if (!horarioDe($cat?.horarios, reagFecha)) { reagError = noLaboral($cat?.horarios); return }
    reagCargando = true
    const qs = new URLSearchParams({ fecha: reagFecha, personas: String(reag.personas), duracionMin: String(durDe(reag)), tipoSalaId: String(reag.sala.tipoSalaId) })
    try { reagSlots = await api.get<Disponibilidad>('/publico/disponibilidad?' + qs) } catch (e) { reagError = (e as Error).message } finally { reagCargando = false }
  }
  async function guardarReag() {
    if (!reag || !reagElegido) return
    const fin = new Date(new Date(reagElegido).getTime() + durDe(reag) * 6e4).toISOString()
    try {
      await api.post(`/cliente/reservaciones/${reag.codigo}/reagendar`, { inicio: reagElegido, fin })
      reag = null; dispatch(avisar('Reservación reagendada', 'ok')); dispatch(cargarMis())
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) }
  }

  // ── cancelar ──
  async function cancelar(x: ReservacionCliente) {
    const reglas = $cat?.reglas
    const horas = (new Date(x.inicio).getTime() - Date.now()) / 36e5
    const msg = x.estado === 'PENDIENTE_PAGO' ? 'La reservación aún no está pagada; se liberará la sala.'
      : reglas && horas >= reglas.horasCancelacion ? `Faltan más de ${reglas.horasCancelacion} h: se reembolsa el total pagado en línea.`
      : `Faltan menos de ${reglas?.horasCancelacion ?? 24} h: se retiene una parte de lo pagado.`
    if (!(await confirmar(`Cancelar ${x.codigo}`, msg, { ok: 'Sí, cancelar', peligro: true }))) return
    try {
      const r = await api.post<{ reembolso: string; retenido: string }>(`/cliente/reservaciones/${x.codigo}/cancelar`, {})
      dispatch(avisar(num(r.reembolso) ? `Cancelada. Reembolso: ${money(r.reembolso)}${num(r.retenido) ? ` (retenido ${money(r.retenido)})` : ''}` : 'Reservación cancelada', 'ok'))
      dispatch(cargarMis())
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) }
  }

  // ── pedir a la sala ──
  let pedido = $state<ReservacionCliente | null>(null)
  let carrito = $state<Record<string, number>>({})
  const totalPedido = $derived(Object.entries(carrito).reduce((a, [id, c]) => a + num($cat?.menu.find((p) => p.id === Number(id))?.precio) * c, 0))
  async function enviarPedido() {
    if (!pedido) return
    const items = Object.entries(carrito).map(([id, cantidad]) => ({ productoId: Number(id), cantidad }))
    if (!items.length) return dispatch(avisar('Agrega al menos un producto', 'bad'))
    try {
      await api.post(`/cliente/reservaciones/${pedido.codigo}/pedir`, { items })
      pedido = null; carrito = {}; dispatch(avisar('¡Pedido enviado a la barra!', 'ok')); dispatch(cargarMis())
    } catch (e) { dispatch(avisar((e as Error).message, 'bad')) }
  }

  // ── cambiar música ──
  let musica = $state<ReservacionCliente | null>(null)
  let mGenero = $state<number | 'lista'>('lista'), mArtistas = $state<string[]>([]), mCanciones = $state(''), mError = $state('')
  function abrirMusica(x: ReservacionCliente) {
    musica = x
    mGenero = x.tematica ? x.tematica.id : 'lista'
    const prev = lineas(x.artistas)
    mArtistas = Array.from({ length: Math.max(3, prev.length) }, (_, i) => prev[i] || '')
    mCanciones = x.canciones || ''; mError = ''
  }
  async function guardarMusica() {
    if (!musica) return
    mError = ''
    const artistas = [...new Set(mArtistas.map((a) => a.trim()).filter(Boolean))]
    if (mGenero === 'lista' && artistas.length < 3) return (mError = 'Escribe al menos 3 artistas para tu lista')
    if (artistas.length && artistas.length < 3) return (mError = 'Si escribes artistas, que sean al menos 3')
    const body = { ...(mGenero !== 'lista' ? { tematicaId: mGenero } : {}), artistas, canciones: lineas(mCanciones).slice(0, 20) }
    try {
      await api.patch(`/cliente/reservaciones/${musica.codigo}/musica`, body)
      musica = null; dispatch(avisar('¡Listo! Actualizamos tu música 🎤', 'ok')); dispatch(cargarMis())
    } catch (e) { mError = (e as Error).message }
  }

  const anticipoPedido = (x: ReservacionCliente) =>
    x.pedidos.filter((p) => p.origen === 'PREORDEN' && p.estado === 'EN_ESPERA').reduce((a, p) => a + num(p.anticipo), 0)
</script>

<svelte:head><title>Mis reservaciones · Moonlight</title></svelte:head>

<div class="row between">
  <h2>Mis reservaciones</h2>
  <div class="row">
    {#if $mis.hora}<span class="text-xs text-muted">Actualizado hace {Math.max(0, Math.round(($ahora - $mis.hora) / 1000))} s</span>{/if}
    <button class="btn sm" type="button" onclick={() => dispatch(cargarMis())}>Actualizar</button>
  </div>
</div>

{#if $mis.estado === 'cargando' && !$mis.lista}
  <div class="grid-2"><div class="skeleton bajo"></div><div class="skeleton bajo"></div></div>
{:else if $mis.error && !$mis.lista}
  <div class="empty err">{$mis.error}</div>
{:else if $mis.lista && !$mis.lista.length}
  <div class="card empty">Aún no tienes reservaciones. <a href="/reservar">Reserva tu primera sala</a></div>
{:else if $mis.lista}
  <div class="grid-2">
    {#each $mis.lista as x, i (x.codigo)}
      {@const vivos = x.pedidos.filter((p) => p.estado !== 'CANCELADO')}
      {@const artistas = lineas(x.artistas)}
      <article class="card" class:flash={$mis.flash.includes(x.codigo)} use:revelar={i} use:inclinar>
        <div class="row between">
          <code class="font-mono text-[1.1rem] tracking-[.08em] text-gold">{x.codigo}</code>
          <Badge estado={x.estado} vivo />
        </div>
        <h3 class="mt-2.5">{fmtRango(x.inicio, x.fin)}</h3>
        <p class="muted small">Sala {x.sala.numero} ({x.sala.tipoSala.nombre}) · {x.personas} personas · {money(x.subtotalSala)}</p>
        <p class="mb-2 text-[.9rem] text-lila">🎤 {x.tematica ? x.tematica.nombre : 'Mi propia lista'}{#if artistas.length}<span class="muted"> · {artistas.join(', ')}</span>{/if}</p>

        {#if x.estado === 'PENDIENTE_PAGO' && x.expiraEn}
          {@const resta = new Date(x.expiraEn).getTime() - $ahora}
          <p><span class="vivo {resta < 5 * 60_000 ? 'bad' : 'warn'}">{resta > 0 ? `Paga en ${falta(resta)} o se libera la sala` : 'Tiempo de pago vencido'}</span></p>
        {:else if x.estado === 'CONFIRMADA'}
          {@const resta = new Date(x.inicio).getTime() - $ahora}
          <p><span class="vivo {resta < 0 ? 'warn' : 'ok'}">{resta > 0 ? `Faltan ${falta(resta)}` : `¡Ya es hora! Tienes ${$cat?.reglas.toleranciaMin ?? 10} min de tolerancia`}</span></p>
        {:else if x.estado === 'EN_CURSO'}
          <div>
            <Progreso inicio={x.inicio} fin={x.fin} />
            {#if $ahora >= new Date(x.fin).getTime()}<p class="mt-1.5 small font-semibold text-bad">⏰ Tu tiempo terminó: pasa a recepción para cerrar tu cuenta.</p>{/if}
          </div>
        {/if}

        {#if x.canal === 'WEB' && ['CONFIRMADA', 'PENDIENTE_PAGO'].includes(x.estado) && num(x.subtotalSala) > num(x.anticipoSala)}
          <p class="small muted">Anticipo en línea {money(x.anticipoSala)} · pagas {money(num(x.subtotalSala) - num(x.anticipoSala))} en recepción al llegar</p>
        {/if}
        {#if x.tiempoPerdidoMin}<p class="small muted">Llegaste {x.retrasoMin} min tarde; se perdieron {x.tiempoPerdidoMin} min.</p>{/if}
        {#if vivos.length}
          <div class="small">
            {#each vivos as p (p.id)}
              <div class="row mb-1.5"><Badge estado={p.estado} vivo /><span class="muted">{p.items.map(lineaItem).join(', ')}</span></div>
            {/each}
          </div>
        {/if}

        <div class="row mt-3">
          {#if x.estado === 'PENDIENTE_PAGO'}
            <button class="btn sm primary" type="button" onclick={() => (pago = {
              codigo: x.codigo, sala: x.sala.numero, totalSala: x.subtotalSala, anticipoSala: x.anticipoSala,
              anticipo: anticipoPedido(x), monto: num(x.anticipoSala) + anticipoPedido(x), expiraEn: x.expiraEn,
            })}>Pagar</button>
          {/if}
          {#if x.estado === 'CONFIRMADA'}<button class="btn sm" type="button" onclick={() => abrirReagendar(x)}>Reagendar</button>{/if}
          {#if x.estado === 'PENDIENTE_PAGO' || x.estado === 'CONFIRMADA'}<button class="btn sm danger" type="button" onclick={() => cancelar(x)}>Cancelar</button>{/if}
          {#if x.estado === 'EN_CURSO'}<button class="btn sm primary" type="button" onclick={() => { pedido = x; carrito = {} }}>Pedir a mi sala</button>{/if}
          {#if ['PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO'].includes(x.estado)}<button class="btn sm" type="button" onclick={() => abrirMusica(x)}>🎤 Cambiar música</button>{/if}
          {#if x.estado !== 'PENDIENTE_PAGO'}<button class="btn sm" type="button" onclick={() => (cuenta = x)}>🧾 Estado de cuenta</button>{/if}
        </div>
      </article>
    {/each}
  </div>
{/if}

<PagoModal bind:pago onpagado={() => { dispatch(avisar('¡Pago recibido! Tu reservación está confirmada.', 'ok')); dispatch(cargarMis()) }} />

{#if cuenta}
  <Modal abierto titulo="Estado de cuenta · {cuenta.codigo}" onclose={() => (cuenta = null)}>
    <EstadoCuenta r={cuenta} />
    {#snippet pie()}<button class="btn primary" type="button" onclick={() => (cuenta = null)}>Cerrar</button>{/snippet}
  </Modal>
{/if}

{#if reag}
  <Modal abierto titulo="Reagendar {reag.codigo}" onclose={() => (reag = null)}>
    <p class="muted small">Se conserva la duración ({durTxt(durDe(reag))}) y el tipo de sala.</p>
    <label for="reag-fecha">Nueva fecha</label>
    <input id="reag-fecha" type="date" min={hoyLocal()} max={hoyLocal(60)} bind:value={reagFecha} onchange={buscarReag} />
    <div class="mt-3.5">
      {#if reagCargando}<span class="spinner"></span>
      {:else if reagError}<p class="dia-cerrado">{reagError}</p>
      {:else if reagSlots && (reagSlots.cerrado || !reagSlots.slots.length)}<p class="muted">{reagSlots.cerrado ? noLaboral($cat?.horarios) : 'Sin horarios libres ese día.'}</p>
      {:else if reagSlots}
        <div class="chips">
          {#each reagSlots.slots as s (s.inicio)}
            <button type="button" class="chip" class:selected={reagElegido === s.inicio} onclick={() => (reagElegido = s.inicio)}>{fmtHora(s.inicio)}</button>
          {/each}
        </div>
      {/if}
    </div>
    {#snippet pie()}
      <button class="btn ghost" type="button" onclick={() => (reag = null)}>Volver</button>
      <button class="btn primary" type="button" disabled={!reagElegido} onclick={guardarReag}>Reagendar</button>
    {/snippet}
  </Modal>
{/if}

{#if pedido && $cat}
  <Modal abierto titulo="Pedido a sala {pedido.sala.numero}" onclose={() => (pedido = null)}>
    <p class="muted small">Se cobra al cerrar tu cuenta.</p>
    <SelectorMenu menu={$cat.menu} tipos={$cat.tipos} tipoSalaId={pedido.sala.tipoSalaId} cantidades={carrito}
      oncambiar={(id, c) => { const n = { ...carrito }; if (c) n[id] = c; else delete n[id]; carrito = n }} />
    <p class="mt-3">Total: <b>{money(totalPedido)}</b></p>
    {#snippet pie()}
      <button class="btn ghost" type="button" onclick={() => (pedido = null)}>Volver</button>
      <button class="btn primary" type="button" onclick={enviarPedido}>Enviar pedido</button>
    {/snippet}
  </Modal>
{/if}

{#if musica && $cat}
  <Modal abierto titulo="Tu música · {musica.codigo}" onclose={() => (musica = null)}>
    <p class="muted small">Elige un género o tu propia lista (mínimo 3 artistas).</p>
    <div class="chips">
      {#each [...$cat.tematicas.map((t) => ({ id: t.id as number | 'lista', nombre: t.nombre })), { id: 'lista' as const, nombre: '✍️ Mi propia lista' }] as g (g.id)}
        <button type="button" class="chip" class:selected={mGenero === g.id} onclick={() => (mGenero = g.id)}>{g.nombre}</button>
      {/each}
    </div>
    <label class="mt-3.5" for="m-artista-0">Artistas favoritos</label>
    <div class="my-1.5 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
      {#each mArtistas as _, i (i)}
        <input id="m-artista-{i}" type="text" maxlength="80" placeholder="Artista {i + 1}" aria-label="Artista {i + 1}" bind:value={mArtistas[i]} />
      {/each}
    </div>
    <label class="mt-3" for="m-canciones">Canciones (una por línea)</label>
    <textarea id="m-canciones" rows="3" maxlength="2400" bind:value={mCanciones}></textarea>
    <div class="err">{mError}</div>
    {#snippet pie()}
      <button class="btn ghost" type="button" onclick={() => (musica = null)}>Volver</button>
      <button class="btn primary" type="button" onclick={guardarMusica}>Guardar</button>
    {/snippet}
  </Modal>
{/if}
