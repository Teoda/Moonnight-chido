// Sitio de clientes: explorar salas y menú, reservar (con pedido anticipado), pagar y administrar reservaciones.
'use strict'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const st = {
  catalogo: null,
  salas: null,
  cliente: null,
  slot: null,          // ISO del inicio elegido
  busqueda: null,      // { fecha, personas, duracionMin, tipoSalaId }
  tipoSalaId: null,    // tamaño de sala elegido
  genero: null,        // id del género musical, o 'lista' = "mi propia lista"
  menuSel: null,       // selector del pedido anticipado
  pendiente: null,     // acción a continuar tras iniciar sesión
  totalPrev: 0,        // para animar el total del resumen desde su valor anterior
  misPrev: null,       // última lista de "Mis reservaciones" (para avisar cambios)
  misHora: 0,          // cuándo se actualizó por última vez
}

// ───────────── arranque ─────────────
document.addEventListener('DOMContentLoaded', async () => {
  fx.cielo()
  fx.auto($('main'))
  window.addEventListener('hashchange', router)
  // "Mis reservaciones" se actualiza sola cada 30 s mientras está a la vista
  setInterval(() => {
    if (st.cliente && !document.hidden && !$('#view-mis-reservaciones').hidden) cargarMisReservaciones(true)
  }, 30_000)
  fx.tic(document.body, () => {
    if (st.misHora) $('#mis-actualizado').textContent = `Actualizado hace ${Math.round((Date.now() - st.misHora) / 1000)} s`
  })
  $('#form-buscar').addEventListener('submit', (e) => { e.preventDefault(); buscarHorarios() })
  $('#btn-reservar').addEventListener('click', (e) => reservar(e.currentTarget))
  $('#btn-atras').addEventListener('click', () => { $('#paso-1').scrollIntoView({ behavior: 'smooth' }) })
  $('#btn-recargar').addEventListener('click', () => cargarMisReservaciones())
  $('#filtro-tipo').addEventListener('change', pintarSalas)
  for (const id of ['#f-fecha', '#f-duracion'])
    $(id).addEventListener('change', () => { if (st.busqueda) buscarHorarios() })
  $('#f-personas').addEventListener('change', () => { ajustarTipoAPersonas(); if (st.busqueda) buscarHorarios() })
  $('#btn-mas-artista').addEventListener('click', () => agregarArtista(true))
  $('#f-canciones').addEventListener('input', pintarResumen)

  await Promise.all([cargarCatalogo(), cargarSesion()])
  router()
})

async function cargarSesion() {
  try { st.cliente = (await api.get('/api/cliente/me')).cliente } catch { st.cliente = null }
  pintarUsuario()
}

async function cargarCatalogo() {
  try {
    st.catalogo = await api.get('/api/publico/catalogo')
  } catch (e) {
    toast('No se pudo cargar el catálogo: ' + e.message, 'bad')
    return
  }
  const { tipos, tematicas, horarios, reglas } = st.catalogo

  // Horario de operación
  const horarioTxt = resumenHorario(horarios)
  $('#footer-horario').textContent = horarioTxt
  const precios = tipos.map((t) => Number(t.precioHora))
  const nSalas = h('b'), desde = h('b')
  append(clear($('#facts')), [
    h('div', h('b', horarioTxt || 'Por confirmar'), 'Horario'),
    h('div', nSalas, `De ${Math.min(...tipos.map((t) => t.capacidadMin))} a ${Math.max(...tipos.map((t) => t.capacidadMax))} personas`),
    precios.length ? h('div', desde, 'por hora') : null,
  ])
  fx.contar(nSalas, tipos.length, (v) => `${Math.round(v)} tamaños`)
  if (precios.length) fx.contar(desde, Math.min(...precios), (v) => `desde ${money(Math.round(v))}`, 0, 1100)
  fx.rotar($('#rotador'), tematicas.map((t) => t.nombre))
  $('#txt-pago').textContent = `La sala completa y, si pides alimentos o bebidas, el ${reglas.anticipoPedidoPct}% de tu pedido. El resto lo pagas al llegar.`

  // Formulario de reserva
  const dur = clear($('#f-duracion'))
  for (let m = 60; m <= 240; m += reglas.pasoMin) dur.append(h('option', { value: m, selected: m === 120 }, durTxt(m)))
  pintarTamanos()
  pintarGeneros()
  for (const t of tipos) $('#filtro-tipo').append(h('option', { value: t.nombre }, `${t.nombre} (${t.capacidadMin}–${t.capacidadMax} personas)`))
  const fecha = $('#f-fecha')
  fecha.min = hoyLocal()
  fecha.max = hoyLocal(60)
  fecha.value = proximoDiaAbierto()
  $('#f-personas').max = Math.max(...tipos.map((t) => t.capacidadMax))
  $('#txt-anticipo').textContent = `Pagas ${reglas.anticipoPedidoPct}% en línea y el resto al llegar`
  $('#txt-politicas').textContent =
    `Tienes ${reglas.toleranciaMin} min de tolerancia para llegar; después la reservación se marca como no-show y no se reembolsa. ` +
    `Cancelando con ${reglas.horasCancelacion} h o más de anticipación se reembolsa todo. ` +
    `Al terminar, la sala se limpia ${reglas.limpiezaMin} min, por eso el tiempo extra depende de la siguiente reservación.`

  st.menuSel = selectorMenu(st.catalogo.menu, pintarResumen, { tipos })
  $('#menu-reserva').append(st.menuSel.el)
  pintarMenu()
  pintarTiposInicio()
  pintarResumen()
}

function resumenHorario(horarios) {
  if (!horarios?.length) return ''
  const dias = horarios.map((x) => x.diaSemana).sort()
  const mismos = horarios.every((x) => x.abre === horarios[0].abre && x.cierra === horarios[0].cierra)
  const consecutivos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1)
  const diasTxt = consecutivos && dias.length > 2 ? `${DIAS[dias[0]]}–${DIAS[dias.at(-1)]}` : dias.map((d) => DIAS[d]).join(', ')
  return mismos ? `${diasTxt} · ${horarios[0].abre}–${horarios[0].cierra}` : diasTxt
}

function proximoDiaAbierto() {
  const abiertos = new Set((st.catalogo?.horarios || []).map((x) => x.diaSemana))
  for (let i = 0; i < 8; i++) {
    const f = hoyLocal(i)
    if (abiertos.has(new Date(f + 'T00:00:00Z').getUTCDay())) return f
  }
  return hoyLocal()
}

// ───────────── navegación ─────────────
function router() {
  const vista = (location.hash || '#inicio').slice(1)
  const valida = $(`#view-${vista}`) ? vista : 'inicio'
  if (valida === 'mis-reservaciones' && !st.cliente) {
    location.hash = '#inicio'
    return abrirAuth(() => { location.hash = '#mis-reservaciones' })
  }
  $$('section.view').forEach((s) => (s.hidden = s.id !== `view-${valida}`))
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === valida))
  if (valida === 'salas') cargarSalas()
  if (valida === 'mis-reservaciones') cargarMisReservaciones()
  window.scrollTo({ top: 0 })
}

function pintarUsuario() {
  const box = clear($('#userbox'))
  $('#nav-mis').hidden = !st.cliente
  if (st.cliente) {
    box.append(
      h('span.muted.small', `Hola, ${st.cliente.nombre.split(' ')[0]}`),
      h('button.btn.sm.ghost', { type: 'button', onclick: cambiarPassword }, 'Contraseña'),
      h('button.btn.sm', { type: 'button', onclick: (e) => logout(e.currentTarget) }, 'Salir'),
    )
  } else {
    box.append(h('button.btn.sm', { type: 'button', onclick: () => abrirAuth() }, 'Iniciar sesión'))
  }
}

// ───────────── salas y menú ─────────────
async function cargarSalas() {
  if (!st.salas) {
    try { st.salas = await api.get('/api/publico/salas') } catch (e) { return toast(e.message, 'bad') }
  }
  if (st.catalogo) {
    $('#tipos-resumen').textContent = st.catalogo.tipos
      .map((t) => `${t.nombre}: ${t.capacidadMin}–${t.capacidadMax} personas, ${money(t.precioHora)}/h`).join(' · ')
  }
  pintarSalas()
}

function pintarSalas() {
  if (!st.salas) return
  const tipo = $('#filtro-tipo').value
  const lista = st.salas.filter((s) => !tipo || s.tipo === tipo)
  const box = clear($('#lista-salas'))
  if (!lista.length) return box.append(h('div.empty', 'No hay salas con esos filtros.'))
  for (const s of lista) {
    box.append(h('article.card.sala.tilt',
      s.fotoUrl
        ? h('div.thumb.foto', h('img', { src: s.fotoUrl, alt: `Sala ${s.numero}, ${s.tipo}`, loading: 'lazy' }), h('span', `#${s.numero}`))
        : h('div.thumb.t-default', `#${s.numero}`),
      h('div.row.between', h('h3', { style: 'margin:0' }, `Sala ${s.numero}`), h('span.badge.accent', s.tipo)),
      h('p.muted.small', s.descripcion || 'Se ambienta con el género musical que elijas al reservar.'),
      conCortesia(s.tipoSalaId) ? h('p.cortesia-tag', '🍾 Incluye botella de cortesía') : null,
      h('div.row.between',
        h('div', h('div.price', money(s.precioHora), h('small', ' /hora')), h('div.muted.small', `${s.capacidad} personas`)),
        s.disponibleParaReservar
          ? h('button.btn.sm.primary', { type: 'button', onclick: () => reservarSala(s) }, 'Reservar')
          : h('span.badge.bad', 'En mantenimiento')),
    ))
  }
}

function reservarSala(s) {
  elegirTipo(s.tipoSalaId)
  location.hash = '#reservar'
  buscarHorarios()
}

// ───────────── tamaño de sala y música ─────────────
/** Tarjetas para elegir el tamaño de la sala. */
function pintarTamanos() {
  const { tipos } = st.catalogo
  append(clear($('#f-tipos')), tipos.map((t) => h('button.tamano', {
    type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { id: t.id },
    onclick: () => { elegirTipo(t.id); if (st.busqueda) buscarHorarios() },
  },
  h('img', { src: FOTOS_TIPO[t.codigo] || '', alt: '', loading: 'lazy' }),
  h('span.tamano-info',
    h('b', `Sala ${t.nombre}`),
    h('span.muted.small', `Hasta ${t.capacidadMax} personas`),
    h('span.small', { style: 'color:var(--gold)' }, `${money(t.precioHora)} /h`),
    conCortesia(t.id) ? h('span.small.cortesia-tag', '🍾 Botella de cortesía') : null))))
  elegirTipo(tipoPara(Number($('#f-personas').value))?.id ?? tipos[0]?.id)
}

function elegirTipo(id) {
  st.tipoSalaId = id
  $$('#f-tipos .tamano').forEach((b) => {
    const on = Number(b.dataset.id) === id
    b.classList.toggle('on', on)
    b.setAttribute('aria-checked', String(on))
  })
  const t = st.catalogo.tipos.find((x) => x.id === id)
  if (t && Number($('#f-personas').value) > t.capacidadMax) $('#f-personas').value = t.capacidadMax
  if (t) $('#f-personas').max = t.capacidadMax
  st.menuSel?.recomendar(id)
  pintarCortesia()
  pintarResumen()
}

/** Si escriben más personas de las que caben, se pasa al siguiente tamaño. */
function ajustarTipoAPersonas() {
  const n = Number($('#f-personas').value)
  const actual = st.catalogo.tipos.find((t) => t.id === st.tipoSalaId)
  if (actual && n <= actual.capacidadMax) return pintarResumen()
  const t = tipoPara(n)
  if (t) { elegirTipo(t.id); toast(`Para ${n} personas te sugerimos la Sala ${t.nombre}`) }
}

/** Chips de géneros musicales + "Mi propia lista". */
function pintarGeneros() {
  const opciones = [...st.catalogo.tematicas.map((t) => ({ id: t.id, nombre: t.nombre })), { id: 'lista', nombre: '✍️ Mi propia lista' }]
  append(clear($('#f-generos')), opciones.map((o) => h('button.chip', {
    type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { id: o.id },
    onclick: () => elegirGenero(o.id),
  }, o.nombre)))
  const box = clear($('#f-artistas'))
  for (let i = 0; i < 3; i++) agregarArtista(false)
  box.addEventListener('input', pintarResumen)
}

function elegirGenero(id) {
  st.genero = id
  $$('#f-generos .chip').forEach((c) => {
    const on = c.dataset.id === String(id)
    c.classList.toggle('selected', on)
    c.setAttribute('aria-checked', String(on))
  })
  const lista = id === 'lista'
  $('#req-artistas').textContent = lista ? '(mínimo 3)' : '(opcional; si los escribes, mínimo 3)'
  $$('#f-artistas input').slice(0, 3).forEach((i) => (i.required = lista))
  if (lista) $('#f-artistas input').focus()
  mostrarPasos()
}

function agregarArtista(enfocar) {
  const box = $('#f-artistas')
  if (box.children.length >= 10) return toast('Máximo 10 artistas', 'bad')
  const n = box.children.length + 1
  const input = h('input', { type: 'text', maxLength: 80, placeholder: `Artista ${n}`, 'aria-label': `Artista ${n}`, autocomplete: 'off' })
  box.append(input)
  if (enfocar) input.focus()
}

/** Lo que el cliente eligió de música, listo para enviar a la API (o un mensaje de error). */
function musicaElegida() {
  const artistas = [...new Set($$('#f-artistas input').map((i) => i.value.trim()).filter(Boolean))]
  const canciones = $('#f-canciones').value.split('\n').map((c) => c.trim()).filter(Boolean).slice(0, 20)
  if (!st.genero) return { error: 'Elige un género musical o "Mi propia lista"' }
  if (st.genero === 'lista' && artistas.length < 3) return { error: 'Escribe al menos 3 artistas para tu lista' }
  if (artistas.length && artistas.length < 3) return { error: 'Si escribes artistas, que sean al menos 3' }
  return {
    datos: {
      ...(st.genero !== 'lista' ? { tematicaId: st.genero } : {}),
      ...(artistas.length ? { artistas } : {}),
      ...(canciones.length ? { canciones } : {}),
    },
    artistas, canciones,
  }
}

// Fotos por tipo de sala (las salas también traen la suya en fotoUrl)
const FOTOS_TIPO = { PEQUENA: '/img/salas/pequena.jpg', MEDIANA: '/img/salas/mediana.jpg', PREMIUM: '/img/salas/premium.jpg' }
const ORDEN_GRUPOS = ['Paquetes', 'Botellas', 'Refrescos y aguas', 'Botanas']

function pintarMenu() {
  const { menu, tipos } = st.catalogo
  const grupos = agruparCarta(menu)
  const nombres = [...ORDEN_GRUPOS.filter((g) => grupos.has(g)), ...[...grupos.keys()].filter((g) => !ORDEN_GRUPOS.includes(g))]
  const box = clear($('#lista-menu'))
  // navegación por secciones
  append(clear($('#menu-nav')), nombres.map((g) =>
    h('button.chip', { type: 'button', onclick: () => $(`#carta-${slug(g)}`).scrollIntoView({ behavior: 'smooth', block: 'start' }) }, g)))

  for (const g of nombres) {
    const subs = grupos.get(g)
    const seccion = h('section.carta-seccion', { id: `carta-${slug(g)}` }, h('h3.titulo-carta', g))
    if (g === 'Paquetes') {
      seccion.append(h('p.muted.small', 'Consumos sugeridos por tipo de sala. No incluyen la renta de la sala.'))
      if (st.catalogo.cortesia?.botellas.length) {
        const t = tipos.find((x) => x.id === st.catalogo.cortesia.tipoSalaId)
        seccion.append(h('p.cortesia-tag', `🍾 Toda reservación de Sala ${t?.nombre || 'Premium'} incluye una botella de cortesía a elegir: `,
          st.catalogo.cortesia.botellas.map((b) => nombreBotella(b.nombre)).join(', '), '.'))
      }
      const grid = h('div.grid.cols-3')
      for (const t of tipos) {
        for (const p of menu.filter((x) => x.categoria === 'PAQUETE' && x.tipoSalaId === t.id)) {
          grid.append(h('article.card.paquete.tilt', { class: p.alcohol ? 'con-alcohol' : '' },
            h('div.row.between', h('span.badge.accent', `Sala ${t.nombre}`), p.alcohol ? h('span.row', { style: 'gap:6px' }, h('span.badge.warn', 'Con botella'), mas18()) : h('span.badge.ok', 'Sin alcohol')),
            h('h3', { style: 'margin:12px 0 8px' }, p.nombre),
            h('ul.lista-paquete', lineasPaquete(p).map((l) => h('li', l))),
            h('div.price', money(p.precio))))
        }
      }
      seccion.append(grid)
    } else {
      const grid = h('div.grid.cols-3')
      for (const [sub, prods] of subs) {
        grid.append(h('div.card.tilt',
          sub ? h('h3', sub, prods.some((p) => p.alcohol) ? [' ', mas18()] : null) : null,
          prods.map((p) => h('div.menu-item', h('span', p.nombre.replace(' (botella)', '')), h('b', money(p.precio))))))
      }
      seccion.append(grid)
      if (g === 'Botellas') seccion.append(h('p.muted.small', 'Botellas de 700–750 ml aprox. según marca. Pregunta en barra si hielo, vasos y mezcladores se cobran por separado.'))
    }
    box.append(seccion)
  }
}

/** Escaparate del inicio: los tres tipos de sala con su foto. */
function pintarTiposInicio() {
  const box = $('#tipos-inicio')
  if (!box) return
  append(clear(box), st.catalogo.tipos.map((t) => h('article.card.sala.tilt',
    h('div.thumb.foto', h('img', { src: FOTOS_TIPO[t.codigo] || '', alt: `Sala ${t.nombre}`, loading: 'lazy' }), h('span', t.nombre)),
    h('div.row.between', h('h3', { style: 'margin:0' }, `Sala ${t.nombre}`), h('span.badge.accent', `${t.capacidadMin}–${t.capacidadMax} personas`)),
    h('p.muted.small', t.descripcion || `Ideal para grupos de ${t.capacidadMin} a ${t.capacidadMax} personas.`),
    conCortesia(t.id) ? h('p.cortesia-tag', '🍾 Incluye botella de cortesía a elegir') : null,
    h('div.row.between', h('div.price', money(t.precioHora), h('small', ' /hora')),
      h('a.btn.sm.primary', { href: '#salas', onclick: () => { $('#filtro-tipo').value = t.nombre } }, 'Ver salas')))))
}

// ───────────── reservar ─────────────
function tipoPara(personas) {
  return st.catalogo?.tipos.find((t) => t.capacidadMin <= personas && personas <= t.capacidadMax)
}

const tipoElegido = () => st.catalogo?.tipos.find((t) => t.id === st.tipoSalaId)

async function buscarHorarios() {
  const fecha = $('#f-fecha').value
  const personas = Number($('#f-personas').value)
  const duracionMin = Number($('#f-duracion').value)
  const tipo = tipoElegido()
  if (!tipo) return toast('Elige el tamaño de la sala', 'bad')
  if (!fecha || !personas) return toast('Elige fecha y número de personas', 'bad')
  if (personas > tipo.capacidadMax) return toast(`La Sala ${tipo.nombre} es para máximo ${tipo.capacidadMax} personas`, 'bad')
  st.busqueda = { fecha, personas, duracionMin, tipoSalaId: tipo.id }
  st.slot = null
  pintarCortesia()
  mostrarPasos()
  const box = clear($('#slots'))
  box.append(h('div.empty', h('span.spinner')))
  const qs = new URLSearchParams({ fecha, personas, duracionMin, tipoSalaId: tipo.id })
  try {
    const r = await api.get('/api/publico/disponibilidad?' + qs)
    clear(box)
    if (r.cerrado) return box.append(h('div.empty', 'Ese día no abrimos. Prueba con otra fecha.'))
    if (!r.slots.length) return box.append(h('div.empty', 'No quedan horarios libres para esa sala. Prueba otra duración, otro tamaño o fecha.'))
    box.append(h('p.muted.small', `Sala ${r.tipo} · elige la hora de inicio:`))
    const chips = h('div.chips')
    for (const s of r.slots) {
      chips.append(h('button.chip', {
        type: 'button', dataset: { inicio: s.inicio }, class: s.disponibles === 1 ? 'ultima' : '',
        onclick: (e) => {
          $$('.chip', chips).forEach((c) => c.classList.remove('selected'))
          e.currentTarget.classList.add('selected')
          st.slot = s.inicio
          mostrarPasos()
          if (!st.genero) setTimeout(() => $('#paso-musica').scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
        },
      }, fmtHora(s.inicio), h('small', s.disponibles === 1 ? 'última' : `${s.disponibles} libres`)))
    }
    box.append(chips)
  } catch (e) {
    clear(box).append(h('div.empty.err', e.message))
  }
}

/** ¿Este tipo de sala incluye botella de cortesía? */
const conCortesia = (tipoId) => !!tipoId && st.catalogo?.cortesia?.tipoSalaId === tipoId && st.catalogo.cortesia.botellas.length > 0
const nombreBotella = (n) => n.replace(' (botella)', '')

/** Elección de la botella de cortesía (solo si la sala elegida la incluye). */
function pintarCortesia() {
  const box = $('#cortesia-box')
  const tipo = tipoElegido()
  if (!conCortesia(tipo?.id)) { box.hidden = true; st.cortesia = null; return }
  const { botellas } = st.catalogo.cortesia
  if (!botellas.some((b) => b.id === st.cortesia)) st.cortesia = botellas[0].id
  const chips = h('div.chips')
  for (const b of botellas) {
    chips.append(h('button.chip', {
      type: 'button', class: b.id === st.cortesia ? 'selected' : '', 'aria-pressed': String(b.id === st.cortesia),
      onclick: (e) => {
        st.cortesia = b.id
        $$('.chip', chips).forEach((c) => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false') })
        e.currentTarget.classList.add('selected'); e.currentTarget.setAttribute('aria-pressed', 'true')
        pintarResumen()
      },
    }, nombreBotella(b.nombre)))
  }
  box.hidden = false
  append(clear(box), [
    h('div.row.between', h('h3', { style: 'margin:0' }, '🍾 Botella de cortesía'), h('span.row', { style: 'gap:6px' }, h('span.badge.ok', 'Incluida con tu Sala ' + tipo.nombre), mas18())),
    h('p.muted.small', 'Elige una. Te la llevamos a la sala cuando llegues.'),
    chips,
  ])
}

function mostrarPasos() {
  const conHora = !!st.slot
  $('#paso-musica').hidden = !conHora
  $('#paso-2').hidden = !conHora
  $('#paso-3').hidden = !conHora
  const hechos = { 1: true, 2: conHora, 3: conHora && !!st.genero, 4: conHora && !!st.genero }
  $$('#steps .s').forEach((s) => s.classList.toggle('on', !!hechos[s.dataset.step]))
  pintarResumen()
}

function pintarResumen() {
  const dl = clear($('#resumen'))
  if (!st.catalogo) return
  const b = st.busqueda
  if (!b) return dl.append(h('dd.muted', { style: 'grid-column:1/-1;text-align:left' }, 'Elige el tamaño de la sala, la fecha y la duración para ver horarios.'))
  const tipo = st.catalogo.tipos.find((t) => t.id === b.tipoSalaId)
  const sala = tipo ? Number(tipo.precioHora) * (b.duracionMin / 60) : 0
  const pedido = st.menuSel?.total() || 0
  const anticipo = Math.round(pedido * st.catalogo.reglas.anticipoPedidoPct) / 100
  const fila = (k, v, cls) => [h('dt', { class: cls }, k), h('dd', { class: cls }, v)]
  const totalDd = h('dd.total')
  fx.contar(totalDd, sala + anticipo, money, st.totalPrev, 450)
  st.totalPrev = sala + anticipo
  // avance: horario → música → (pedido) → listo
  $('#barra-pasos').style.width = !st.slot ? '20%' : !st.genero ? '45%' : pedido ? '100%' : '80%'
  const m = st.genero ? musicaElegida() : null
  const genero = st.genero === 'lista' ? 'Mi propia lista' : st.catalogo.tematicas.find((t) => t.id === st.genero)?.nombre
  append(dl, [
    fila('Fecha', st.slot ? fmtFecha(st.slot) : b.fecha),
    fila('Horario', st.slot ? `${fmtHora(st.slot)}–${fmtHora(new Date(st.slot).getTime() + b.duracionMin * 6e4)}` : '—'),
    fila('Personas', b.personas),
    fila('Sala', tipo ? tipo.nombre : '—'),
    fila('Música', genero ? `🎤 ${genero}` : '—'),
    m?.artistas?.length ? fila('Artistas', m.artistas.slice(0, 3).join(', ') + (m.artistas.length > 3 ? ` y ${m.artistas.length - 3} más` : ''), 'small') : null,
    fila(`Sala (${durTxt(b.duracionMin)})`, money(sala)),
    st.cortesia ? fila(`🍾 ${nombreBotella(st.catalogo.cortesia.botellas.find((x) => x.id === st.cortesia)?.nombre || '')}`, 'Cortesía') : null,
    pedido ? fila('Pedido anticipado', money(pedido)) : null,
    pedido ? fila(`Anticipo ${st.catalogo.reglas.anticipoPedidoPct}%`, money(anticipo)) : null,
    h('dt.total', 'A pagar en línea'), totalDd,
    pedido ? fila('Al llegar', money(pedido - anticipo), 'muted small') : null,
  ])
}

async function reservar(btn) {
  if (!st.slot || !st.busqueda) return toast('Elige un horario', 'bad')
  const musica = musicaElegida()
  if (musica.error) {
    $('#paso-musica').scrollIntoView({ behavior: 'smooth', block: 'start' })
    return toast(musica.error, 'bad')
  }
  if (!st.cliente) return abrirAuth(() => reservar(btn), 'Inicia sesión o crea tu cuenta para reservar')
  const b = st.busqueda
  const items = st.menuSel.items()
  const body = {
    personas: b.personas, tipoSalaId: b.tipoSalaId, inicio: st.slot,
    fin: new Date(new Date(st.slot).getTime() + b.duracionMin * 6e4).toISOString(),
    ...musica.datos,
    ...(items.length ? { items } : {}),
    ...(st.cortesia ? { cortesiaProductoId: st.cortesia } : {}),
  }
  const r = await accion(btn, () => api.post('/api/cliente/reservaciones', body))
  if (!r) return buscarHorarios() // el horario pudo ocuparse: refrescamos
  st.menuSel.reset()
  st.slot = null
  buscarHorarios()
  abrirPago({ codigo: r.codigo, sala: r.sala, monto: r.aPagarEnLinea, totalSala: r.totalSala, anticipo: r.anticipoPedido, expiraEn: r.expiraEn })
}

function abrirPago(p) {
  let m
  const pagar = async (e) => {
    const r = await accion(e.currentTarget, () => api.post(`/api/cliente/reservaciones/${p.codigo}/pagar`))
    if (!r) return
    m.close()
    exito(p.codigo, p.sala)
    if (!$('#view-mis-reservaciones').hidden) cargarMisReservaciones(true)
  }
  const btnPagar = h('button.btn.primary', { type: 'button', onclick: pagar }, `Pagar ${money(p.monto)}`)
  const reloj = h('span.vivo.warn')
  if (p.expiraEn) {
    fx.tic(reloj, () => {
      const resta = new Date(p.expiraEn) - Date.now()
      reloj.textContent = resta > 0 ? `Tienes ${fx.falta(resta)} para pagar` : 'Se venció el tiempo: la sala se liberó'
      reloj.classList.toggle('bad', resta < 5 * 60_000)
      btnPagar.disabled = resta <= 0
    })
  }
  m = modal('Pagar reservación', [
    h('p', `Apartamos la sala ${p.sala ?? ''} para ti.`),
    p.expiraEn ? h('p', reloj) : null,
    h('dl', { style: 'display:grid;grid-template-columns:1fr auto;gap:6px 12px;margin:0' },
      h('dt.muted', 'Sala'), h('dd', { style: 'margin:0;text-align:right' }, money(p.totalSala)),
      Number(p.anticipo) ? [h('dt.muted', 'Anticipo del pedido'), h('dd', { style: 'margin:0;text-align:right' }, money(p.anticipo))] : null,
      h('dt', h('b', 'Total')), h('dd', { style: 'margin:0;text-align:right' }, h('b', money(p.monto)))),
    h('p.muted.small', { style: 'margin-top:14px' }, 'Pago de demostración: no se solicita ni se guarda ningún dato de tarjeta.'),
  ], [
    h('button.btn.ghost', { type: 'button', onclick: () => { m.close(); toast('Puedes pagar después desde "Mis reservaciones"') } }, 'Pagar después'),
    btnPagar,
  ])
}

function exito(codigo, sala) {
  let m
  m = modal('¡Reservación confirmada!', [
    h('p', 'Tu número de reservación es:'),
    h('div.code-big', codigo),
    h('p.muted', `Dalo en recepción al llegar${sala ? ` (sala ${sala})` : ''}. Tienes ${st.catalogo.reglas.toleranciaMin} min de tolerancia.`),
  ], [h('button.btn.primary', { type: 'button', onclick: () => { m.close(); location.hash = '#mis-reservaciones' } }, 'Ver mis reservaciones')])
  fx.confeti(m.dlg)
}

// ───────────── cuenta del cliente ─────────────
function abrirAuth(despues, aviso) {
  st.pendiente = despues || null
  let m
  const err = h('div.err')
  const tabs = h('div.tabs')
  const login = h('form',
    h('div.field', h('label', { for: 'a-email' }, 'Correo'), h('input#a-email', { type: 'email', name: 'email', required: true, autocomplete: 'email' })),
    h('div.field', h('label', { for: 'a-pw' }, 'Contraseña'), h('input#a-pw', { type: 'password', name: 'password', required: true, autocomplete: 'current-password' })),
    h('button.btn.primary', { type: 'submit', style: 'width:100%;justify-content:center' }, 'Iniciar sesión'))
  const registro = h('form', { hidden: true },
    h('div.field', h('label', { for: 'r-nombre' }, 'Nombre'), h('input#r-nombre', { name: 'nombre', required: true, minLength: 2, maxLength: 120, autocomplete: 'name' })),
    h('div.field', h('label', { for: 'r-email' }, 'Correo'), h('input#r-email', { type: 'email', name: 'email', required: true, autocomplete: 'email' })),
    h('div.field', h('label', { for: 'r-tel' }, 'Teléfono (opcional, 10 dígitos)'), h('input#r-tel', { type: 'tel', name: 'telefono', autocomplete: 'tel', inputMode: 'numeric' })),
    h('div.field', h('label', { for: 'r-pw' }, 'Contraseña (mín. 10 caracteres, letras y números)'), h('input#r-pw', { type: 'password', name: 'password', required: true, minLength: 10, autocomplete: 'new-password' })),
    h('div.field', h('label.check', h('input', { type: 'checkbox', name: 'aceptaPromos' }), 'Quiero recibir promociones')),
    h('button.btn.primary', { type: 'submit', style: 'width:100%;justify-content:center' }, 'Crear cuenta'))
  const tab = (txt, form) => h('button', { type: 'button', onclick: (e) => {
    $$('button', tabs).forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on')
    login.hidden = form !== login; registro.hidden = form !== registro; err.textContent = ''
  } }, txt)
  append(tabs, [tab('Iniciar sesión', login), tab('Crear cuenta', registro)])
  tabs.firstChild.classList.add('on')

  const listo = (r) => {
    st.cliente = r.cliente
    pintarUsuario()
    m.close()
    toast(`Bienvenido, ${r.cliente.nombre.split(' ')[0]}`, 'ok')
    const fn = st.pendiente; st.pendiente = null
    if (fn) fn()
  }
  login.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = ''
    const f = new FormData(login)
    try { listo(await api.post('/api/cliente/login', { email: f.get('email'), password: f.get('password') })) } catch (x) { err.textContent = x.message }
  })
  registro.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = ''
    const f = new FormData(registro)
    const body = { nombre: f.get('nombre'), email: f.get('email'), password: f.get('password'), aceptaPromos: f.get('aceptaPromos') === 'on' }
    if (f.get('telefono')) body.telefono = f.get('telefono')
    try { listo(await api.post('/api/cliente/registro', body)) } catch (x) { err.textContent = x.message }
  })
  m = modal('Tu cuenta Moonlight', [aviso ? h('p.muted', aviso) : null, tabs, login, registro, err])
}

async function logout(btn) {
  await accion(btn, () => api.post('/api/cliente/logout'))
  st.cliente = null
  api.csrf = null
  pintarUsuario()
  if (location.hash === '#mis-reservaciones') location.hash = '#inicio'
}

function cambiarPassword() {
  let m
  const err = h('div.err')
  const form = h('form',
    h('div.field', h('label', { for: 'cp-a' }, 'Contraseña actual'), h('input#cp-a', { type: 'password', name: 'actual', required: true, autocomplete: 'current-password' })),
    h('div.field', h('label', { for: 'cp-n' }, 'Nueva (mín. 10, letras y números)'), h('input#cp-n', { type: 'password', name: 'nueva', required: true, minLength: 10, autocomplete: 'new-password' })),
    err, h('button.btn.primary', { type: 'submit' }, 'Guardar'))
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = ''
    const f = new FormData(form)
    try {
      await api.post('/api/cliente/cambiar-password', { actual: f.get('actual'), nueva: f.get('nueva') })
      m.close(); toast('Contraseña actualizada. Se cerraron tus otras sesiones.', 'ok')
    } catch (x) { err.textContent = x.message }
  })
  m = modal('Cambiar contraseña', form)
}

// ───────────── mis reservaciones ─────────────
/** silencioso = refresco automático: sin skeleton y solo vuelve a pintar si algo cambió (avisando qué). */
async function cargarMisReservaciones(silencioso = false) {
  const box = $('#lista-mis')
  if (silencioso !== true) {
    silencioso = false
    clear(box).append(h('div.skeleton.bajo'), h('div.skeleton.bajo'))
  }
  let lista
  try { lista = await api.get('/api/cliente/reservaciones') } catch (e) {
    if (silencioso && e.status !== 401) return
    clear(box).append(h('div.empty.err', e.message))
    if (e.status === 401) { st.cliente = null; pintarUsuario(); abrirAuth(cargarMisReservaciones) }
    return
  }
  st.misHora = Date.now()
  if (!cambio('mis', lista) && silencioso) return
  const cambiadas = silencioso ? avisarCambios(st.misPrev || [], lista) : new Set()
  st.misPrev = lista
  clear(box)
  if (!lista.length) return box.append(h('div.card.empty', 'Aún no tienes reservaciones. ', h('a', { href: '#reservar' }, 'Reserva tu primera sala')))
  for (const r of lista) {
    const card = tarjetaReservacion(r)
    if (cambiadas.has(r.codigo)) card.classList.add('flash')
    box.append(card)
  }
}

/** Compara la lista anterior con la nueva y muestra avisos; devuelve los códigos que cambiaron. */
function avisarCambios(antes, ahora) {
  const cambiadas = new Set()
  const previa = new Map(antes.map((r) => [r.codigo, r]))
  for (const r of ahora) {
    const p = previa.get(r.codigo)
    if (!p) continue
    if (p.estado !== r.estado) {
      cambiadas.add(r.codigo)
      toast(`${r.codigo}: ${(ESTADOS[r.estado] || [r.estado])[0]}`, r.estado === 'CANCELADA' || r.estado === 'NO_SHOW' ? 'bad' : 'ok')
    }
    const pedPrev = new Map(p.pedidos.map((x) => [x.id, x.estado]))
    for (const ped of r.pedidos) {
      const antesEstado = pedPrev.get(ped.id)
      if (antesEstado && antesEstado !== ped.estado) {
        cambiadas.add(r.codigo)
        const msg = { PREPARANDO: '¡Tu pedido se está preparando! 🍳', ENTREGADO: '¡Tu pedido va en camino a tu sala! 🎉', CANCELADO: 'Un pedido fue cancelado' }[ped.estado]
        if (msg) toast(msg, ped.estado === 'CANCELADO' ? 'bad' : 'ok')
      }
    }
  }
  return cambiadas
}

/** Línea "en vivo" según el estado: cuenta regresiva para pagar, para llegar, o progreso de la visita. */
function lineaViva(r) {
  if (r.estado === 'PENDIENTE_PAGO' && r.expiraEn) {
    const el = h('span.vivo.warn')
    fx.tic(el, () => {
      const resta = new Date(r.expiraEn) - Date.now()
      el.textContent = resta > 0 ? `Paga en ${fx.falta(resta)} o se libera la sala` : 'Tiempo de pago vencido'
      el.classList.toggle('bad', resta < 5 * 60_000)
    })
    return h('p', el)
  }
  if (r.estado === 'CONFIRMADA') {
    const el = h('span.vivo.ok')
    fx.tic(el, () => {
      const resta = new Date(r.inicio) - Date.now()
      el.textContent = resta > 0 ? `Faltan ${fx.falta(resta)}` : `¡Ya es hora! Tienes ${st.catalogo?.reglas.toleranciaMin ?? 10} min de tolerancia`
      el.classList.toggle('warn', resta < 0)
    })
    return h('p', el)
  }
  if (r.estado === 'EN_CURSO') {
    const etiqueta = h('span.vivo.accent')
    return h('div', fx.progreso(r.inicio, r.fin, etiqueta), etiqueta)
  }
  return null
}

function tarjetaReservacion(r) {
  const acciones = h('div.row')
  if (r.estado === 'PENDIENTE_PAGO') {
    const anticipo = r.pedidos.filter((p) => p.origen === 'PREORDEN' && p.estado === 'EN_ESPERA').reduce((a, p) => a + Number(p.anticipo), 0)
    acciones.append(h('button.btn.sm.primary', { type: 'button', onclick: () => abrirPago({
      codigo: r.codigo, sala: r.sala.numero, totalSala: r.subtotalSala, anticipo, monto: Number(r.subtotalSala) + anticipo, expiraEn: r.expiraEn,
    }) }, 'Pagar'))
  }
  if (r.estado === 'CONFIRMADA') acciones.append(h('button.btn.sm', { type: 'button', onclick: () => reagendar(r) }, 'Reagendar'))
  if (r.estado === 'PENDIENTE_PAGO' || r.estado === 'CONFIRMADA')
    acciones.append(h('button.btn.sm.danger', { type: 'button', onclick: (e) => cancelar(r, e.currentTarget) }, 'Cancelar'))
  if (r.estado === 'EN_CURSO') acciones.append(h('button.btn.sm.primary', { type: 'button', onclick: () => pedirEnSala(r) }, 'Pedir a mi sala'))
  if (['PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO'].includes(r.estado))
    acciones.append(h('button.btn.sm', { type: 'button', onclick: () => cambiarMusica(r) }, '🎤 Cambiar música'))

  const pedidos = r.pedidos.filter((p) => p.estado !== 'CANCELADO')
  const artistas = (r.artistas || '').split('\n').filter(Boolean)
  return h('article.card.tilt',
    h('div.row.between', h('code', { style: 'font-size:1.1rem;color:var(--gold);letter-spacing:.08em' }, r.codigo), badgeVivo(r.estado)),
    h('h3', { style: 'margin-top:10px' }, fmtRango(r.inicio, r.fin)),
    h('p.muted.small', `Sala ${r.sala.numero} (${r.sala.tipoSala.nombre}) · ${r.personas} personas · ${money(r.subtotalSala)}`),
    h('p.musica-linea', '🎤 ', r.tematica ? r.tematica.nombre : 'Mi propia lista',
      artistas.length ? h('span.muted', ` · ${artistas.join(', ')}`) : null),
    lineaViva(r),
    r.tiempoPerdidoMin ? h('p.small.muted', `Llegaste ${r.retrasoMin} min tarde; se perdieron ${r.tiempoPerdidoMin} min.`) : null,
    pedidos.length ? h('div.small', pedidos.map((p) => h('div.row', { style: 'margin-bottom:6px' }, badgeVivo(p.estado),
      h('span.muted', p.items.map(lineaItem).join(', '))))) : null,
    acciones.childNodes.length ? h('div', { style: 'margin-top:12px' }, acciones) : null,
  )
}

/** Cambiar el género o la lista de artistas/canciones de una reservación. */
function cambiarMusica(r) {
  let m, genero = r.tematica ? r.tematica.id : 'lista'
  const err = h('div.err')
  const chips = h('div.chips.generos', [...st.catalogo.tematicas.map((t) => ({ id: t.id, nombre: t.nombre })), { id: 'lista', nombre: '✍️ Mi propia lista' }]
    .map((o) => h('button.chip', { type: 'button', class: o.id === genero ? 'selected' : '', onclick: (e) => {
      genero = o.id
      $$('.chip', chips).forEach((c) => c.classList.remove('selected'))
      e.currentTarget.classList.add('selected')
    } }, o.nombre)))
  const previos = (r.artistas || '').split('\n').filter(Boolean)
  const inputs = Array.from({ length: Math.max(3, previos.length) }, (_, i) =>
    h('input', { type: 'text', maxLength: 80, placeholder: `Artista ${i + 1}`, value: previos[i] || '', 'aria-label': `Artista ${i + 1}` }))
  const canciones = h('textarea', { rows: 3, maxLength: 2400, value: r.canciones || '', 'aria-label': 'Canciones' })
  const guardar = h('button.btn.primary', { type: 'button' }, 'Guardar')
  guardar.addEventListener('click', async () => {
    err.textContent = ''
    const artistas = [...new Set(inputs.map((i) => i.value.trim()).filter(Boolean))]
    if (genero === 'lista' && artistas.length < 3) return (err.textContent = 'Escribe al menos 3 artistas para tu lista')
    if (artistas.length && artistas.length < 3) return (err.textContent = 'Si escribes artistas, que sean al menos 3')
    const body = {
      ...(genero !== 'lista' ? { tematicaId: genero } : {}), artistas,
      canciones: canciones.value.split('\n').map((c) => c.trim()).filter(Boolean).slice(0, 20),
    }
    const x = await accion(guardar, () => api.req('PATCH', `/api/cliente/reservaciones/${r.codigo}/musica`, body))
    if (!x) return
    m.close(); toast('¡Listo! Actualizamos tu música 🎤', 'ok'); cargarMisReservaciones()
  })
  m = modal(`Tu música · ${r.codigo}`, [
    h('p.muted.small', 'Elige un género o tu propia lista (mínimo 3 artistas).'), chips,
    h('label', { style: 'margin-top:14px' }, 'Artistas favoritos'), h('div.artistas', inputs),
    h('label', { style: 'margin-top:12px' }, 'Canciones (una por línea)'), canciones, err,
  ], [h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, 'Volver'), guardar])
}

/** Badge que late cuando el estado está "en movimiento". */
function badgeVivo(estado) {
  const b = badge(estado)
  if (['EN_CURSO', 'PREPARANDO', 'NUEVO', 'PENDIENTE_PAGO'].includes(estado)) b.classList.add('pulso')
  return b
}

async function cancelar(r, btn) {
  const reglas = st.catalogo.reglas
  const horas = (new Date(r.inicio) - Date.now()) / 36e5
  const msg = r.estado === 'PENDIENTE_PAGO'
    ? 'La reservación aún no está pagada; se liberará la sala.'
    : horas >= reglas.horasCancelacion
      ? `Faltan más de ${reglas.horasCancelacion} h: se reembolsa el total pagado en línea.`
      : `Faltan menos de ${reglas.horasCancelacion} h: se retiene una parte de lo pagado.`
  if (!(await confirmar(`Cancelar ${r.codigo}`, msg, { ok: 'Sí, cancelar', peligro: true }))) return
  const x = await accion(btn, () => api.post(`/api/cliente/reservaciones/${r.codigo}/cancelar`, {}))
  if (!x) return
  toast(Number(x.reembolso) ? `Cancelada. Reembolso: ${money(x.reembolso)}${Number(x.retenido) ? ` (retenido ${money(x.retenido)})` : ''}` : 'Reservación cancelada', 'ok')
  cargarMisReservaciones()
}

function reagendar(r) {
  const duracionMin = Math.round((new Date(r.fin) - new Date(r.inicio)) / 6e4)
  let elegido = null, m
  const fecha = h('input', { type: 'date', min: hoyLocal(), max: hoyLocal(60), value: proximoDiaAbierto() })
  const slots = h('div', { style: 'margin-top:14px' })
  const guardar = h('button.btn.primary', { type: 'button', disabled: true }, 'Reagendar')
  const buscar = async () => {
    elegido = null; guardar.disabled = true
    clear(slots).append(h('span.spinner'))
    const qs = new URLSearchParams({ fecha: fecha.value, personas: r.personas, duracionMin, tipoSalaId: r.sala.tipoSalaId })
    try {
      const d = await api.get('/api/publico/disponibilidad?' + qs)
      clear(slots)
      if (d.cerrado || !d.slots.length) return slots.append(h('p.muted', d.cerrado ? 'Ese día no abrimos.' : 'Sin horarios libres ese día.'))
      const chips = h('div.chips')
      for (const s of d.slots) chips.append(h('button.chip', { type: 'button', onclick: (e) => {
        $$('.chip', chips).forEach((c) => c.classList.remove('selected')); e.currentTarget.classList.add('selected')
        elegido = s.inicio; guardar.disabled = false
      } }, fmtHora(s.inicio)))
      slots.append(chips)
    } catch (e) { clear(slots).append(h('p.err', e.message)) }
  }
  fecha.addEventListener('change', buscar)
  guardar.addEventListener('click', async () => {
    const fin = new Date(new Date(elegido).getTime() + duracionMin * 6e4).toISOString()
    const x = await accion(guardar, () => api.post(`/api/cliente/reservaciones/${r.codigo}/reagendar`, { inicio: elegido, fin }))
    if (!x) return
    m.close(); toast('Reservación reagendada', 'ok'); cargarMisReservaciones()
  })
  m = modal(`Reagendar ${r.codigo}`, [
    h('p.muted.small', `Se conserva la duración (${durTxt(duracionMin)}) y el tipo de sala.`),
    h('label', 'Nueva fecha'), fecha, slots,
  ], [h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, 'Volver'), guardar])
  buscar()
}

function pedirEnSala(r) {
  let m
  const total = h('b', money(0))
  const sel = selectorMenu(st.catalogo.menu, () => { total.textContent = money(sel.total()) }, { tipos: st.catalogo.tipos, tipoSalaId: r.sala.tipoSalaId })
  const enviar = h('button.btn.primary', { type: 'button' }, 'Enviar pedido')
  enviar.addEventListener('click', async () => {
    const items = sel.items()
    if (!items.length) return toast('Agrega al menos un producto', 'bad')
    const x = await accion(enviar, () => api.post(`/api/cliente/reservaciones/${r.codigo}/pedir`, { items }))
    if (!x) return
    m.close(); toast('¡Pedido enviado a la barra!', 'ok'); cargarMisReservaciones()
  })
  m = modal(`Pedido a sala ${r.sala.numero}`, [h('p.muted.small', 'Se cobra al cerrar tu cuenta.'), sel.el, h('p', { style: 'margin-top:12px' }, 'Total: ', total)],
    [h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, 'Volver'), enviar])
}
