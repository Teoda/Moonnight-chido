<!-- Asistente de reserva: 1. sala y horario · 2. música · 3. alimentos y bebidas · 4. confirmar y pagar.
     Todo lo elegido vive en Redux (slice "reserva"), así se conserva al cambiar de página. -->
<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { tick } from 'svelte'
  import { api } from '#lib/api/client.ts'
  import type { NuevaReservacion } from '#lib/api/types.ts'
  import { dispatch, seleccionar } from '#lib/store/index.ts'
  import { acciones, buscarHorarios, itemsCarrito, musicaElegida, totales } from '#lib/store/reserva.ts'
  import { cargarMis } from '#lib/store/mis.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { conCortesia, FOTOS_TIPO, horarioDe, nombreBotella, noLaboral, tipoPara } from '#lib/utils/carta.ts'
  import { durTxt, fmtFecha, fmtHora, hoyLocal, money } from '#lib/utils/formato.ts'
  import { confeti, contar } from '#lib/fx/efectos.ts'
  import SelectorMenu from '#lib/components/SelectorMenu.svelte'
  import PagoModal, { type DatosPago } from '#lib/components/sitio/PagoModal.svelte'
  import Modal from '#lib/components/Modal.svelte'
  import { pedirSesion } from '#lib/components/sitio/auth.svelte.ts'

  const cat = seleccionar((s) => s.catalogo.datos)
  const r = seleccionar((s) => s.reserva)
  const cliente = seleccionar((s) => s.sesion.cliente)

  let pago = $state<DatosPago | null>(null)
  let exito = $state<{ codigo: string; sala: number | null } | null>(null)
  let dlgExito = $state<HTMLDialogElement>()
  let reservando = $state(false)
  let pasoMusica = $state<HTMLElement>()

  const tipoActual = $derived($cat?.tipos.find((t) => t.id === $r.tipoSalaId))
  const hd = $derived(horarioDe($cat?.horarios, $r.fecha))
  const t = $derived(totales($r, $cat))
  const musica = $derived(musicaElegida($r))
  const conHora = $derived(!!$r.slot)
  const hechos = $derived({ 1: true, 2: conHora, 3: conHora && !!$r.genero, 4: conHora && !!$r.genero } as Record<number, boolean>)
  const avance = $derived(!$r.slot ? '20%' : !$r.genero ? '45%' : t.pedido ? '100%' : '80%')
  const generos = $derived([...($cat?.tematicas.map((x) => ({ id: x.id as number | 'lista', nombre: x.nombre })) ?? []), { id: 'lista' as const, nombre: '✍️ Mi propia lista' }])
  const duraciones = $derived($cat ? Array.from({ length: Math.floor((240 - 60) / $cat.reglas.pasoMin) + 1 }, (_, i) => 60 + i * $cat.reglas.pasoMin) : [120])

  // Al tener el catálogo: primer día abierto y tamaño sugerido por personas (si aún no se eligió)
  let preparado = false
  $effect(() => {
    if (!$cat || preparado) return
    preparado = true
    const abiertos = new Set($cat.horarios.map((x) => x.diaSemana))
    if (!horarioDe($cat.horarios, $r.fecha)) {
      for (let i = 0; i < 8; i++) {
        const f = hoyLocal(i)
        if (abiertos.has(new Date(f + 'T00:00:00Z').getUTCDay())) { dispatch(acciones.setFecha(f)); break }
      }
    }
    if (!$r.tipoSalaId) {
      const tp = tipoPara($cat.tipos, $r.personas) ?? $cat.tipos[0]
      if (tp) dispatch(acciones.elegirTipo({ id: tp.id, capacidadMax: tp.capacidadMax }))
    }
    if (page.url.searchParams.has('buscar')) buscar()
  })

  // Botella de cortesía: se elige una por defecto si la sala la incluye; se quita si no
  $effect(() => {
    const incluye = conCortesia($cat, $r.tipoSalaId)
    const botellas = $cat?.cortesia?.botellas ?? []
    if (!incluye && $r.cortesiaId !== null) dispatch(acciones.elegirCortesia(null))
    if (incluye && !botellas.some((b) => b.id === $r.cortesiaId)) dispatch(acciones.elegirCortesia(botellas[0].id))
  })

  function buscar() {
    dispatch(buscarHorarios())
  }
  function elegirTipo(id: number, capacidadMax: number) {
    dispatch(acciones.elegirTipo({ id, capacidadMax }))
    if ($r.busqueda) buscar()
  }
  function cambiarFecha(f: string) {
    dispatch(acciones.setFecha(f))
    if (!horarioDe($cat?.horarios, f)) dispatch(acciones.sinHorarios(noLaboral($cat?.horarios)))
    else if ($r.busqueda) buscar()
  }
  function cambiarPersonas(n: number) {
    dispatch(acciones.setPersonas(n))
    // si ya no caben, se sugiere el siguiente tamaño
    if ($cat && tipoActual && n > tipoActual.capacidadMax) {
      const tp = tipoPara($cat.tipos, n)
      if (tp) { dispatch(acciones.elegirTipo({ id: tp.id, capacidadMax: tp.capacidadMax })); dispatch(avisar(`Para ${n} personas te sugerimos la Sala ${tp.nombre}`)) }
    }
    if ($r.busqueda) buscar()
  }
  async function elegirSlot(inicio: string) {
    dispatch(acciones.elegirSlot(inicio))
    if (!$r.genero) { await tick(); setTimeout(() => pasoMusica?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }
  }

  async function reservar() {
    if (!$r.slot || !$r.busqueda) return dispatch(avisar('Elige un horario', 'bad'))
    if (musica.error !== undefined) {
      pasoMusica?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return dispatch(avisar(musica.error, 'bad'))
    }
    if (!$cliente) return pedirSesion(reservar, 'Inicia sesión o crea tu cuenta para reservar')
    const b = $r.busqueda
    const items = itemsCarrito($r)
    const body = {
      personas: b.personas, tipoSalaId: b.tipoSalaId, inicio: $r.slot,
      fin: new Date(new Date($r.slot).getTime() + b.duracionMin * 6e4).toISOString(),
      ...musica.datos,
      ...(items.length ? { items } : {}),
      ...($r.cortesiaId ? { cortesiaProductoId: $r.cortesiaId } : {}),
    }
    reservando = true
    try {
      const x = await api.post<NuevaReservacion>('/cliente/reservaciones', body)
      dispatch(acciones.reservado())
      buscar()
      pago = { codigo: x.codigo, sala: x.sala, monto: x.aPagarEnLinea, totalSala: x.totalSala, anticipoSala: x.anticipoSala, anticipo: x.anticipoPedido, expiraEn: x.expiraEn }
    } catch (e) {
      dispatch(avisar((e as Error).message, 'bad'))
      buscar() // el horario pudo ocuparse: se refresca
    } finally { reservando = false }
  }

  async function pagado(codigo: string, sala: number | null) {
    exito = { codigo, sala }
    dispatch(cargarMis({ silencioso: true }))
    await tick()
    if (dlgExito) confeti(dlgExito)
  }
</script>

<svelte:head><title>Reservar · Moonlight</title></svelte:head>

<h2>Reservar</h2>
<div class="steps mb-4.5 flex flex-wrap gap-2">
  {#each ['Sala y horario', 'Tu música', 'Alimentos y bebidas', 'Confirmar y pagar'] as paso, i (paso)}
    <span class="s" class:on={hechos[i + 1]}>{i + 1}. {paso}</span>
  {/each}
</div>
<div class="-mt-1.5 mb-4.5 h-1 overflow-hidden rounded bg-line" aria-hidden="true">
  <div class="h-full bg-linear-to-r from-accent to-accent-2 transition-[width] duration-600" style:width={avance}></div>
</div>

{#if !$cat}
  <div class="skeleton"></div>
{:else}
<div class="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
  <div class="stack">
    <!-- 1. Sala y horario -->
    <div class="card">
      <h3>Elige el tamaño de tu sala</h3>
      <div class="mb-4 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5" role="radiogroup" aria-label="Tamaño de la sala">
        {#each $cat.tipos as tp (tp.id)}
          <button type="button" class="tamano" class:on={tp.id === $r.tipoSalaId} role="radio" aria-checked={tp.id === $r.tipoSalaId}
            onclick={() => elegirTipo(tp.id, tp.capacidadMax)}>
            <img src={FOTOS_TIPO[tp.codigo] || ''} alt="" loading="lazy" />
            <span class="flex flex-col gap-0.5 px-3 py-2.5">
              <b>Sala {tp.nombre}</b>
              <span class="muted small">Hasta {tp.capacidadMax} personas</span>
              <span class="small text-gold">{money(tp.precioHora)} /h</span>
              {#if conCortesia($cat, tp.id)}<span class="cortesia-tag m-0 mt-0.5 text-xs">🍾 Botella de cortesía</span>{/if}
            </span>
          </button>
        {/each}
      </div>
      <form class="form-grid" onsubmit={(e) => { e.preventDefault(); buscar() }}>
        <div class="field">
          <label for="f-fecha">Fecha</label>
          <input id="f-fecha" type="date" required min={hoyLocal()} max={hoyLocal(60)} value={$r.fecha} class:no-laboral={!!$r.fecha && !hd}
            onchange={(e) => cambiarFecha(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="f-personas">Personas</label>
          <input id="f-personas" type="number" min="1" max={tipoActual?.capacidadMax ?? 16} required value={$r.personas}
            onchange={(e) => cambiarPersonas(Number(e.currentTarget.value))} />
        </div>
        <div class="field">
          <label for="f-duracion">Duración</label>
          <select id="f-duracion" value={$r.duracionMin} onchange={(e) => { dispatch(acciones.setDuracion(Number(e.currentTarget.value))); if ($r.busqueda) buscar() }}>
            {#each duraciones as m (m)}<option value={m}>{durTxt(m)}</option>{/each}
          </select>
        </div>
        <div class="row col-span-full">
          <button class="btn primary" type="submit">Buscar horarios</button>
          <span class="muted small" class:dia-cerrado={!!$r.fecha && !hd}>
            {!$r.fecha ? '' : hd ? (hd.abre === hd.cierra ? 'Abierto las 24 h' : `Abierto de ${hd.abre} a ${hd.cierra}`) : 'Día no laboral'}
          </span>
        </div>
      </form>

      <div class="mt-4">
        {#if $r.slots.estado === 'cargando'}
          <div class="empty"><span class="spinner"></span></div>
        {:else if $r.slots.estado === 'error'}
          <div class="empty" class:dia-cerrado={$r.slots.error?.startsWith('Día no laboral')} class:err={!$r.slots.error?.startsWith('Día no laboral')}>{$r.slots.error}</div>
        {:else if $r.slots.datos?.cerrado}
          <div class="empty dia-cerrado">{noLaboral($cat.horarios)}</div>
        {:else if $r.slots.datos && !$r.slots.datos.slots.length}
          <div class="empty">No quedan horarios libres para esa sala. Prueba otra duración, otro tamaño o fecha.</div>
        {:else if $r.slots.datos}
          <p class="muted small">Sala {$r.slots.datos.tipo} · elige la hora de inicio:</p>
          <div class="chips">
            {#each $r.slots.datos.slots as s (s.inicio)}
              <button type="button" class="chip" class:selected={$r.slot === s.inicio} class:ultima={s.disponibles === 1} onclick={() => elegirSlot(s.inicio)}>
                {fmtHora(s.inicio)}<small>{s.disponibles === 1 ? 'última' : `${s.disponibles} libres`}</small>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if conHora}
      <!-- 2. Música -->
      <div class="card vista scroll-mt-24" bind:this={pasoMusica}>
        <div class="row between"><h3 class="m-0">🎤 ¿Qué quieres cantar?</h3><span class="muted small">La sala se ambienta con tu elección</span></div>
        <p class="muted small mt-2">Elige un género o arma tu propia lista con al menos 3 artistas.</p>
        <div class="chips mb-3.5" role="radiogroup" aria-label="Género musical">
          {#each generos as g (g.id)}
            <button type="button" class="chip px-3.5 py-2.5" class:selected={$r.genero === g.id} role="radio" aria-checked={$r.genero === g.id}
              onclick={() => dispatch(acciones.elegirGenero(g.id))}>{g.nombre}</button>
          {/each}
        </div>
        <label for="artista-0">Tus artistas favoritos <span class="muted">{$r.genero === 'lista' ? '(mínimo 3)' : '(opcional; si los escribes, mínimo 3)'}</span></label>
        <div class="my-1.5 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
          {#each $r.artistas as a, i (i)}
            <input id="artista-{i}" type="text" maxlength="80" placeholder="Artista {i + 1}" aria-label="Artista {i + 1}" autocomplete="off"
              value={a} required={$r.genero === 'lista' && i < 3} oninput={(e) => dispatch(acciones.setArtista({ i, valor: e.currentTarget.value }))} />
          {/each}
        </div>
        <button class="btn sm ghost" type="button" disabled={$r.artistas.length >= 10} onclick={() => dispatch(acciones.agregarArtista())}>+ Otro artista</button>
        <div class="field mt-3">
          <label for="f-canciones">Canciones que quieres cantar <span class="muted">(opcional, una por línea)</span></label>
          <textarea id="f-canciones" rows="3" maxlength="2400" class="min-h-[70px] resize-y" placeholder={'Ej. Ella baila sola\nTusa\nBohemian Rhapsody'}
            value={$r.canciones} oninput={(e) => dispatch(acciones.setCanciones(e.currentTarget.value))}></textarea>
        </div>
      </div>

      <!-- 3. Alimentos y bebidas -->
      <div class="card vista">
        {#if conCortesia($cat, $r.tipoSalaId) && $cat.cortesia}
          <div class="cortesia">
            <div class="row between">
              <h3 class="m-0">🍾 Botella de cortesía</h3>
              <span class="row gap-1.5"><span class="badge ok">Incluida con tu Sala {tipoActual?.nombre}</span><span class="badge mas18">+18</span></span>
            </div>
            <p class="muted small mt-2">Elige una. Te la llevamos a la sala cuando llegues.</p>
            <div class="chips">
              {#each $cat.cortesia.botellas as b (b.id)}
                <button type="button" class="chip" class:selected={$r.cortesiaId === b.id} aria-pressed={$r.cortesiaId === b.id}
                  onclick={() => dispatch(acciones.elegirCortesia(b.id))}>{nombreBotella(b.nombre)}</button>
              {/each}
            </div>
          </div>
        {/if}
        <div class="row between"><h3>¿Quieres pedir por adelantado?</h3><span class="muted small">Pagas {$cat.reglas.anticipoPedidoPct}% en línea y el resto al llegar</span></div>
        <SelectorMenu menu={$cat.menu} tipos={$cat.tipos} tipoSalaId={$r.tipoSalaId} cantidades={$r.carrito}
          oncambiar={(id, cantidad) => dispatch(acciones.setCantidad({ id, cantidad }))} />
      </div>

      <!-- 4. Confirmar -->
      <div class="card vista">
        <h3>Confirmar</h3>
        <p class="muted small">
          Hoy pagas el {$cat.reglas.anticipoSalaPct}% de la sala con tarjeta; el resto lo pagas en recepción al llegar.
          Tienes {$cat.reglas.toleranciaMin} min de tolerancia para llegar; después la reservación se marca como no-show y el anticipo no se reembolsa.
          Cancelando con {$cat.reglas.horasCancelacion} h o más de anticipación se reembolsa todo.
          Al terminar, la sala se limpia {$cat.reglas.limpiezaMin} min, por eso el tiempo extra depende de la siguiente reservación.
        </p>
        <div class="row">
          <button class="btn" type="button" onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Cambiar horario</button>
          <button class="btn primary lg" type="button" disabled={reservando} onclick={reservar}>Reservar y pagar</button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Resumen -->
  <aside class="card summary lg:sticky lg:top-21" aria-label="Resumen">
    <h3>Resumen</h3>
    {#if !$r.busqueda}
      <p class="muted m-0">Elige el tamaño de la sala, la fecha y la duración para ver horarios.</p>
    {:else}
      {@const b = $r.busqueda}
      <dl>
        <dt>Fecha</dt><dd>{$r.slot ? fmtFecha($r.slot) : b.fecha}</dd>
        <dt>Horario</dt><dd>{$r.slot ? `${fmtHora($r.slot)}–${fmtHora(new Date($r.slot).getTime() + b.duracionMin * 6e4)}` : '—'}</dd>
        <dt>Personas</dt><dd>{b.personas}</dd>
        <dt>Sala</dt><dd>{t.tipo?.nombre ?? '—'}</dd>
        <dt>Música</dt><dd>{$r.genero === 'lista' ? '🎤 Mi propia lista' : $r.genero ? `🎤 ${$cat.tematicas.find((x) => x.id === $r.genero)?.nombre}` : '—'}</dd>
        {#if musica.error === undefined && musica.artistas.length}
          <dt class="small">Artistas</dt><dd class="small">{musica.artistas.slice(0, 3).join(', ')}{musica.artistas.length > 3 ? ` y ${musica.artistas.length - 3} más` : ''}</dd>
        {/if}
        <dt>Sala ({durTxt(b.duracionMin)})</dt><dd>{money(t.sala)}</dd>
        <dt>Anticipo sala {$cat.reglas.anticipoSalaPct}%</dt><dd>{money(t.anticipoSala)}</dd>
        {#if $r.cortesiaId}
          <dt>🍾 {nombreBotella($cat.cortesia?.botellas.find((x) => x.id === $r.cortesiaId)?.nombre || '')}</dt><dd>Cortesía</dd>
        {/if}
        {#if t.pedido}
          <dt>Pedido anticipado</dt><dd>{money(t.pedido)}</dd>
          <dt>Anticipo {$cat.reglas.anticipoPedidoPct}%</dt><dd>{money(t.anticipoPedido)}</dd>
        {/if}
        <dt class="total">A pagar en línea</dt><dd class="total" use:contar={{ valor: t.enLinea, dur: 450 }}></dd>
        <dt class="muted small">Al llegar (en recepción)</dt><dd class="muted small">{money(t.alLlegar)}</dd>
      </dl>
    {/if}
  </aside>
</div>
{/if}

<PagoModal bind:pago onpagado={pagado} />

{#if exito}
  <Modal abierto titulo="¡Reservación confirmada!" bind:dialogo={dlgExito} onclose={() => (exito = null)}>
    <p>Tu número de reservación es:</p>
    <div class="code-big">{exito.codigo}</div>
    <p class="muted">Dalo en recepción al llegar{exito.sala ? ` (sala ${exito.sala})` : ''}. Tienes {$cat?.reglas.toleranciaMin} min de tolerancia.</p>
    {#snippet pie()}
      <button class="btn primary" type="button" onclick={() => { exito = null; goto('/mis-reservaciones') }}>Ver mis reservaciones</button>
    {/snippet}
  </Modal>
{/if}
