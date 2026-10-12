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
  api.meUrl = '/api/cliente/me'
  // la sesión del cliente se cierra tras 1 h sin actividad: avisamos en lugar de fallar en silencio
  api.onUnauthorized = () => {
    if (!st.cliente) return
    st.cliente = null
    st.misPrev = null
    pintarUsuario()
    toast('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.', 'bad')
  }
  fx.cielo()
  fx.auto($('main'))
  mostrarLinkAdmin()
  window.addEventListener('hashchange', router)
  // Las reservaciones del cliente se revisan cada 20 s en cualquier vista (para avisarle aunque esté en otra
  // sección): si "Mis reservaciones" está a la vista además se vuelven a pintar.
  setInterval(() => { if (st.cliente && !document.hidden) cargarMisReservaciones(true) }, 20_000)
  setInterval(revisarTiempos, 1000) // avisos de "te quedan 10 / 5 min" y "tu tiempo terminó"
  fx.tic(document.body, () => {
    if (st.misHora) $('#mis-actualizado').textContent = `Actualizado hace ${Math.round((Date.now() - st.misHora) / 1000)} s`
  })
  $('#form-buscar').addEventListener('submit', (e) => { e.preventDefault(); buscarHorarios() })
  $('#btn-reservar').addEventListener('click', (e) => reservar(e.currentTarget))
  $('#btn-atras').addEventListener('click', () => { $('#paso-1').scrollIntoView({ behavior: 'smooth' }) })
  $('#btn-recargar').addEventListener('click', () => cargarMisReservaciones())
  $('#filtro-tipo').addEventListener('change', pintarSalas)
  $('#f-fecha').addEventListener('change', () => { if (revisarDia() && st.busqueda) buscarHorarios() })
  $('#f-duracion').addEventListener('change', () => { if (st.busqueda) buscarHorarios() })
  $('#f-personas').addEventListener('change', () => { ajustarTipoAPersonas(); if (st.busqueda) buscarHorarios() })
  $('#btn-mas-artista').addEventListener('click', () => agregarArtista(true))
  $('#f-canciones').addEventListener('input', pintarResumen)

  await Promise.all([cargarCatalogo(), cargarSesion()])
  router()
})

/** "Panel de administración" solo se muestra si en este navegador hay una sesión de Administración abierta. */
async function mostrarLinkAdmin() {
  // fetch directo (no api.get) para no reemplazar el token CSRF del cliente con el del personal
  const r = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).catch(() => null)
  const d = r?.ok ? await r.json().catch(() => null) : null
  $('#link-admin').hidden = d?.usuario?.rol !== 'ADMIN'
}

async function cargarSesion() {
  try { st.cliente = (await api.get('/api/cliente/me')).cliente } catch { st.cliente = null }
  pintarUsuario()
  if (st.cliente) cargarMisReservaciones(true)
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
  $('#txt-pago').textContent = `Solo el ${reglas.anticipoSalaPct}% de la sala y, si pides alimentos o bebidas, el ${reglas.anticipoPedidoPct}% de tu pedido. El resto lo pagas al llegar.`

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
  revisarDia()
  $('#f-personas').max = Math.max(...tipos.map((t) => t.capacidadMax))
  $('#txt-anticipo').textContent = `Pagas ${reglas.anticipoPedidoPct}% en línea y el resto al llegar`
  $('#txt-politicas').textContent =
    `Hoy pagas el ${reglas.anticipoSalaPct}% de la sala con tarjeta; el resto lo pagas en recepción al llegar. ` +
    `Tienes ${reglas.toleranciaMin} min de tolerancia para llegar; después la reservación se marca como no-show y el anticipo no se reembolsa. ` +
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
  const diasTxt = dias.length === 7 ? 'Todos los días' : consecutivos && dias.length > 2 ? `${DIAS[dias[0]]}–${DIAS[dias.at(-1)]}` : dias.map((d) => DIAS[d]).join(', ')
  return mismos ? `${diasTxt} · ${horaTxt(horarios[0])}` : diasTxt
}

/** Horario del día (YYYY-MM-DD) o null si ese día no se abre. */
const horarioDe = (fecha) => (st.catalogo?.horarios || []).find((x) => x.diaSemana === new Date(fecha + 'T00:00:00Z').getUTCDay()) || null
const NO_LABORAL = () => `Día no laboral. Abrimos ${resumenHorario(st.catalogo?.horarios) || 'otros días'}.`

/** Al elegir la fecha: avisa de inmediato si es día no laboral (sin esperar a buscar horarios). */
function revisarDia() {
  const fecha = $('#f-fecha').value
  const hd = horarioDe(fecha)
  const aviso = $('#horario-dia')
  $('#f-fecha').classList.toggle('no-laboral', !!fecha && !hd)
  aviso.classList.toggle('dia-cerrado', !!fecha && !hd)
  aviso.textContent = !fecha ? '' : hd ? (hd.abre === hd.cierra ? 'Abierto las 24 h' : `Abierto de ${hd.abre} a ${hd.cierra}`) : 'Día no laboral'
  if (fecha && !hd) {
    st.busqueda = null; st.slot = null
    clear($('#slots')).append(h('div.empty.dia-cerrado', NO_LABORAL()))
    mostrarPasos()
  }
  return !!hd
}

/** "12:00–02:00", o "24 h" si abre y cierra a la misma hora. */
const horaTxt = (x) => (x.abre === x.cierra ? '24 h' : `${x.abre}–${x.cierra}`)

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
          : s.estado === 'LIMPIEZA' ? h('span.badge.warn', 'En limpieza') : h('span.badge.bad', 'En mantenimiento')),
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
  if (!revisarDia()) return
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
    if (r.cerrado) return box.append(h('div.empty.dia-cerrado', NO_LABORAL()))
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
  const anticipoSala = Math.round(sala * st.catalogo.reglas.anticipoSalaPct) / 100
  const fila = (k, v, cls) => [h('dt', { class: cls }, k), h('dd', { class: cls }, v)]
  const totalDd = h('dd.total')
  fx.contar(totalDd, anticipoSala + anticipo, money, st.totalPrev, 450)
  st.totalPrev = anticipoSala + anticipo
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
    fila(`Anticipo sala ${st.catalogo.reglas.anticipoSalaPct}%`, money(anticipoSala)),
    st.cortesia ? fila(`🍾 ${nombreBotella(st.catalogo.cortesia.botellas.find((x) => x.id === st.cortesia)?.nombre || '')}`, 'Cortesía') : null,
    pedido ? fila('Pedido anticipado', money(pedido)) : null,
    pedido ? fila(`Anticipo ${st.catalogo.reglas.anticipoPedidoPct}%`, money(anticipo)) : null,
    h('dt.total', 'A pagar en línea'), totalDd,
    fila('Al llegar (en recepción)', money(sala - anticipoSala + pedido - anticipo), 'muted small'),
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
  abrirPago({ codigo: r.codigo, sala: r.sala, monto: r.aPagarEnLinea, totalSala: r.totalSala, anticipoSala: r.anticipoSala, anticipo: r.anticipoPedido, expiraEn: r.expiraEn })
}

// ── tarjeta (pago simulado: se valida como una pasarela, pero no se cobra) ──
const soloDigitos = (v) => v.replace(/\D/g, '')
const marcaTarjeta = (n) => (/^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'American Express' : '')
const luhn = (n) => [...n].reverse().reduce((a, c, i) => { let d = Number(c); if (i % 2) { d *= 2; if (d > 9) d -= 9 } return a + d }, 0) % 10 === 0
const tarjetaTxt = (t) => `${t.marca} •••• ${t.ultimos4} · vence ${String(t.mesExp).padStart(2, '0')}/${String(t.anioExp).slice(-2)}`

/** Formulario de tarjeta nueva con validación por campo. Devuelve { el, datos() }: datos() regresa { body } para la API o { error }. */
function formTarjeta() {
  const MAX_ANIOS = 20 // vencimientos más lejanos no existen en tarjetas reales
  const campo = (etiqueta, input, extra) => {
    const msg = h('div.msg-campo', { 'aria-live': 'polite' })
    const el = h('div.field', h('label', etiqueta, extra || null), input, msg)
    // el error se muestra al salir del campo; mientras se corrige, se actualiza en vivo
    let tocado = false
    const mostrar = (txt) => { msg.textContent = txt || ''; input.setAttribute('aria-invalid', txt ? 'true' : 'false') }
    input.addEventListener('blur', () => { tocado = !!input.value; if (tocado) mostrar(validar[input.dataset.k]()) })
    input.addEventListener('input', () => { if (tocado) mostrar(validar[input.dataset.k]()) })
    return { el, mostrar }
  }
  const titular = h('input', { autocomplete: 'cc-name', maxLength: 120, placeholder: 'Como aparece en la tarjeta', dataset: { k: 'titular' } })
  const numero = h('input', { autocomplete: 'cc-number', inputMode: 'numeric', maxLength: 19, placeholder: '0000 0000 0000 0000', dataset: { k: 'numero' } })
  const vence = h('input', { autocomplete: 'cc-exp', inputMode: 'numeric', maxLength: 5, placeholder: 'MM/AA', dataset: { k: 'vence' } })
  const cvv = h('input', { type: 'password', autocomplete: 'cc-csc', inputMode: 'numeric', maxLength: 4, placeholder: '•••', dataset: { k: 'cvv' } })
  const marca = h('span.badge.accent', { hidden: true })
  const guardar = h('input', { type: 'checkbox' })

  const validar = {
    titular: () => (titular.value.trim().length < 3 ? 'Escribe el nombre como aparece en la tarjeta' : ''),
    numero: () => {
      const n = soloDigitos(numero.value)
      if (!n) return 'Escribe el número de la tarjeta'
      if (!marcaTarjeta(n)) return 'Solo aceptamos Visa, Mastercard y American Express'
      if (n.length !== (marcaTarjeta(n) === 'American Express' ? 15 : 16)) return 'El número está incompleto'
      if (!luhn(n)) return 'El número de tarjeta no es válido; revísalo'
      return ''
    },
    vence: () => {
      const m = /^(\d{2})\/(\d{2})$/.exec(vence.value)
      if (!m) return 'Escribe el vencimiento como MM/AA'
      const mm = Number(m[1]), anio = 2000 + Number(m[2]), hoy = new Date()
      if (mm < 1 || mm > 12) return 'El mes debe ser de 01 a 12'
      if (anio < hoy.getFullYear() || (anio === hoy.getFullYear() && mm < hoy.getMonth() + 1)) return 'La tarjeta está vencida'
      if (anio > hoy.getFullYear() + MAX_ANIOS) return 'Fecha de vencimiento no válida'
      return ''
    },
    cvv: () => {
      const largo = marcaTarjeta(soloDigitos(numero.value)) === 'American Express' ? 4 : 3
      return cvv.value.length !== largo ? `El CVV son ${largo} dígitos (al reverso${largo === 4 ? ', o al frente en American Express' : ''})` : ''
    },
  }
  numero.addEventListener('input', () => {
    const n = soloDigitos(numero.value).slice(0, 16)
    numero.value = n.replace(/(\d{4})(?=\d)/g, '$1 ')
    marca.textContent = marcaTarjeta(n)
    marca.hidden = !marca.textContent
  })
  vence.addEventListener('input', () => {
    const d = soloDigitos(vence.value).slice(0, 4)
    vence.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
  })
  cvv.addEventListener('input', () => { cvv.value = soloDigitos(cvv.value) })

  const c = { titular: campo('Titular', titular), numero: campo('Número de tarjeta ', numero, marca), vence: campo('Vencimiento', vence), cvv: campo('CVV', cvv) }
  const el = h('div.tarjeta-form',
    c.titular.el, c.numero.el,
    h('div.form-grid', c.vence.el, c.cvv.el),
    h('label.check', guardar, 'Guardar esta tarjeta para mis próximas reservaciones'),
    h('p.muted.small', { style: 'margin:8px 0 0' }, 'Si la guardas solo conservamos la marca, los últimos 4 dígitos y el vencimiento; nunca el número completo ni el CVV.'))
  const datos = () => {
    let primero = null
    for (const [k, v] of Object.entries(validar)) {
      const e = v()
      c[k].mostrar(e)
      if (e && !primero) primero = { error: e, input: { titular, numero, vence, cvv }[k] }
    }
    if (primero) { primero.input.focus(); return { error: 'Revisa los datos de la tarjeta' } }
    const [mm, aa] = vence.value.split('/').map(Number)
    return { body: { tarjeta: { numero: soloDigitos(numero.value), titular: titular.value.trim(), mes: mm, anio: 2000 + aa, cvv: cvv.value }, guardar: guardar.checked } }
  }
  return { el, datos }
}

function abrirPago(p) {
  let m, elegida = null // id de la tarjeta guardada elegida; null = tarjeta nueva
  const err = h('div.err')
  const nueva = formTarjeta()
  const guardadas = h('div.tarjetas-guardadas')
  const cajaNueva = h('div', nueva.el)
  const pintarGuardadas = (lista) => {
    clear(guardadas)
    if (!lista.length) { elegida = null; cajaNueva.hidden = false; return }
    if (elegida !== null && !lista.some((t) => t.id === elegida)) elegida = lista[0].id
    const opcion = (id, txt, extra) => h('label.tarjeta-op', { class: elegida === id ? 'on' : '' },
      h('input', { type: 'radio', name: 'tarjeta', checked: elegida === id, onchange: () => { elegida = id; pintarGuardadas(lista) } }),
      h('span', txt), extra)
    for (const t of lista) {
      guardadas.append(opcion(t.id, tarjetaTxt(t), h('button.x', {
        type: 'button', title: 'Eliminar tarjeta', 'aria-label': `Eliminar ${tarjetaTxt(t)}`,
        onclick: async (e) => {
          e.preventDefault()
          if (!(await confirmar('Eliminar tarjeta', `¿Eliminar ${tarjetaTxt(t)}?`, { ok: 'Eliminar', peligro: true }))) return
          if (await accion(null, () => api.req('DELETE', `/api/cliente/tarjetas/${t.id}`))) pintarGuardadas(lista.filter((x) => x.id !== t.id))
        },
      }, '×')))
    }
    guardadas.append(opcion(null, '+ Usar otra tarjeta'))
    cajaNueva.hidden = elegida !== null
  }
  api.get('/api/cliente/tarjetas').then((lista) => { if (lista.length) elegida = lista[0].id; pintarGuardadas(lista) }, () => {})

  const pagar = async (e) => {
    err.textContent = ''
    let body
    if (elegida !== null) body = { tarjetaId: elegida }
    else {
      const d = nueva.datos()
      if (d.error) { err.textContent = d.error; return }
      body = d.body
    }
    const r = await accion(e.currentTarget, () => api.post(`/api/cliente/reservaciones/${p.codigo}/pagar`, body))
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
  const dd = (v, b) => h('dd', { style: 'margin:0;text-align:right' }, b ? h('b', v) : v)
  const restoSala = Number(p.totalSala) - Number(p.anticipoSala)
  m = modal('Pagar anticipo', [
    h('p', `Apartamos la sala ${p.sala ?? ''} para ti.`),
    p.expiraEn ? h('p', reloj) : null,
    h('dl', { style: 'display:grid;grid-template-columns:1fr auto;gap:6px 12px;margin:0 0 16px' },
      h('dt.muted', 'Sala (total)'), dd(money(p.totalSala)),
      h('dt.muted', 'Anticipo de la sala'), dd(money(p.anticipoSala)),
      Number(p.anticipo) ? [h('dt.muted', 'Anticipo del pedido'), dd(money(p.anticipo))] : null,
      h('dt', h('b', 'A pagar ahora')), dd(money(p.monto), true),
      restoSala > 0 ? [h('dt.muted.small', 'Resto de la sala, en recepción al llegar'), h('dd.muted.small', { style: 'margin:0;text-align:right' }, money(restoSala))] : null),
    guardadas, cajaNueva, err,
    h('p.muted.small', { style: 'margin-top:12px' }, 'Pago de demostración: no se realiza ningún cargo real.'),
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
  const pwLogin = h('input#a-pw', { type: 'password', name: 'password', required: true, autocomplete: 'current-password' })
  const pwRegistro = h('input#r-pw', { type: 'password', name: 'password', required: true, minLength: 10, autocomplete: 'new-password' })
  const login = h('form',
    h('div.field', h('label', { for: 'a-email' }, 'Correo'), h('input#a-email', { type: 'email', name: 'email', required: true, autocomplete: 'email' })),
    h('div.field', h('label', { for: 'a-pw' }, 'Contraseña'), pwLogin, mostrarPw(pwLogin)),
    h('button.btn.primary', { type: 'submit', style: 'width:100%;justify-content:center' }, 'Iniciar sesión'))
  const registro = h('form', { hidden: true },
    h('div.field', h('label', { for: 'r-nombre' }, 'Nombre'), h('input#r-nombre', { name: 'nombre', required: true, minLength: 2, maxLength: 120, autocomplete: 'name' })),
    h('div.field', h('label', { for: 'r-email' }, 'Correo'), h('input#r-email', { type: 'email', name: 'email', required: true, autocomplete: 'email' })),
    h('div.field', h('label', { for: 'r-tel' }, 'Teléfono (opcional, 10 dígitos)'), h('input#r-tel', { type: 'tel', name: 'telefono', autocomplete: 'tel', inputMode: 'numeric' })),
    h('div.field', h('label', { for: 'r-pw' }, 'Contraseña (mín. 10 caracteres, letras y números)'), pwRegistro, mostrarPw(pwRegistro)),
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
    cargarMisReservaciones(true)
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
  st.misPrev = null
  api.csrf = null
  pintarUsuario()
  if (location.hash === '#mis-reservaciones') location.hash = '#inicio'
}

function cambiarPassword() {
  let m
  const err = h('div.err')
  const actual = h('input#cp-a', { type: 'password', name: 'actual', required: true, autocomplete: 'current-password' })
  const nueva = h('input#cp-n', { type: 'password', name: 'nueva', required: true, minLength: 10, autocomplete: 'new-password' })
  const form = h('form',
    h('div.field', h('label', { for: 'cp-a' }, 'Contraseña actual'), actual, mostrarPw(actual)),
    h('div.field', h('label', { for: 'cp-n' }, 'Nueva (mín. 10, letras y números)'), nueva, mostrarPw(nueva)),
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
    if (silencioso) return // en segundo plano no se interrumpe al cliente (si fue 401, onUnauthorized ya avisó)
    clear(box).append(h('div.empty.err', e.message))
    if (e.status === 401) { st.cliente = null; pintarUsuario(); abrirAuth(cargarMisReservaciones) }
    return
  }
  st.misHora = Date.now()
  if (!cambio('mis', lista) && silencioso) return
  const cambiadas = silencioso && st.misPrev ? avisarCambios(st.misPrev, lista) : new Set()
  st.misPrev = lista
  revisarTiempos()
  if ($('#view-mis-reservaciones').hidden) return // revisión en segundo plano: solo avisos
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
      if (r.estado === 'FINALIZADA') cuentaCerrada(r)
      else if (r.estado === 'EN_CURSO') toast(`¡Bienvenido! Tu sala ${r.sala.numero} está lista. Termina a las ${fmtHora(r.fin)} 🎤`, 'ok')
      else toast(`${r.codigo}: ${(ESTADOS[r.estado] || [r.estado])[0]}`, r.estado === 'CANCELADA' || r.estado === 'NO_SHOW' ? 'bad' : 'ok')
    }
    if (r.estado === 'EN_CURSO' && p.fin !== r.fin && new Date(r.fin) > new Date(p.fin)) {
      cambiadas.add(r.codigo)
      toast(`Se amplió tu tiempo: ahora terminas a las ${fmtHora(r.fin)} ⏱️`, 'ok')
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

// ── avisos de tiempo y estado de cuenta ──
/** Avisos ya mostrados (por reservación y hora de fin), para no repetirlos al recargar la página. */
const avisado = (() => {
  let set
  try { set = new Set(JSON.parse(sessionStorage.getItem('ml-avisos') || '[]')) } catch { set = new Set() }
  return (clave) => {
    if (set.has(clave)) return true
    set.add(clave)
    try { sessionStorage.setItem('ml-avisos', JSON.stringify([...set].slice(-100))) } catch { /* sin almacenamiento */ }
    return false
  }
})()

/** Avisa al cliente cuando le quedan 10 y 5 minutos, y cuando se le terminó el tiempo de la visita. */
function revisarTiempos() {
  if (!st.cliente || !st.misPrev) return
  for (const r of st.misPrev) {
    if (r.estado !== 'EN_CURSO') continue
    const resta = new Date(r.fin) - Date.now(), base = `${r.codigo}:${r.fin}`
    if (resta <= 0) {
      if (!avisado(`${base}:fin`)) tiempoTerminado(r)
    } else if (resta <= 5 * 60_000) {
      if (!avisado(`${base}:5`)) { fx.ding(); toast(`⏰ Te quedan ${Math.ceil(resta / 60_000)} min en la sala ${r.sala.numero}`, 'bad') }
    } else if (resta <= 10 * 60_000) {
      if (!avisado(`${base}:10`)) toast(`⏰ Te quedan ${Math.ceil(resta / 60_000)} min en la sala ${r.sala.numero}. Si quieres más tiempo, pídelo en recepción.`, 'ok')
    }
  }
}

function tiempoTerminado(r) {
  fx.ding()
  let m
  m = modal('⏰ Tu tiempo terminó', [
    h('p', `Se terminó el tiempo de tu sala ${r.sala.numero} (${fmtHora(r.inicio)}–${fmtHora(r.fin)}).`),
    h('p.muted', 'Pasa a recepción para cerrar tu cuenta. Si la sala no tiene otra reservación, ahí también puedes pedir tiempo extra.'),
    estadoCuenta(r),
  ], [h('button.btn.primary', { type: 'button', onclick: () => m.close() }, 'Entendido')])
}

function cuentaCerrada(r) {
  if (avisado(`${r.codigo}:cerrada`)) return
  fx.ding()
  let m
  m = modal('🧾 Tu cuenta se cerró', [
    h('p', `¡Gracias por cantar en Moonlight! Este es el resumen de tu visita a la sala ${r.sala.numero}.`),
    estadoCuenta(r),
  ], [h('button.btn.primary', { type: 'button', onclick: () => m.close() }, 'Listo')])
}

const CONCEPTOS = {
  SALA: 'Sala', SALDO_SALA: 'Resto de la sala', ANTICIPO_PEDIDO: 'Anticipo del pedido', SALDO_PEDIDO: 'Resto del pedido',
  TIEMPO_EXTRA: 'Tiempo extra', CONSUMO: 'Cierre de cuenta', REEMBOLSO: 'Reembolso',
}

/** Desglose de lo que se lleva cobrado y lo que falta. Con la cuenta cerrada usa sus totales (incluye la promo). */
function estadoCuenta(r) {
  const n = (v) => Number(v || 0)
  const vivos = r.pedidos.filter((p) => p.estado !== 'CANCELADO')
  const c = r.cuenta
  const sala = c ? n(c.subtotalSala) : n(r.subtotalSala)
  const extras = c ? n(c.subtotalExtras) : (r.extensiones || []).reduce((a, x) => a + n(x.monto), 0)
  const preorden = c ? n(c.subtotalPedidosAnticipados) : vivos.filter((p) => p.origen === 'PREORDEN').reduce((a, p) => a + n(p.total), 0)
  const consumo = c ? n(c.subtotalConsumo) : vivos.filter((p) => p.origen !== 'PREORDEN').reduce((a, p) => a + n(p.total), 0)
  const descuento = c ? n(c.descuento) : 0
  const total = c ? n(c.total) : sala + extras + preorden + consumo
  const pagos = (r.pagos || []).filter((p) => p.estado === 'PAGADO')
  const pagado = pagos.reduce((a, p) => a + n(p.monto), 0)
  const reembolsos = (r.pagos || []).filter((p) => p.tipo === 'REEMBOLSO')
  const saldo = Math.max(0, total - pagado)
  const fila = (k, v, cls) => [h('dt', { class: cls }, k), h('dd', { class: cls }, v)]
  return h('div.estado-cuenta',
    h('h4', c ? 'Cuenta cerrada' : r.estado === 'EN_CURSO' ? 'Tu cuenta hasta ahora' : 'Estado de cuenta'),
    h('dl',
      fila('Sala', money(sala)),
      extras ? fila('Tiempo extra', money(extras)) : null,
      preorden ? fila('Pedido anticipado', money(preorden)) : null,
      consumo ? fila('Consumo en sala', money(consumo)) : null,
      descuento ? fila('Descuento (promo)', '−' + money(descuento), 'ok') : null,
      fila('Total', money(total), 'total'),
      fila('Pagado', money(pagado)),
      ['FINALIZADA', 'CANCELADA', 'NO_SHOW'].includes(r.estado) ? null : fila('Por pagar', money(saldo), saldo > 0 ? 'pendiente' : 'ok')),
    pagos.length || reembolsos.length ? h('details.pagos-cuenta', h('summary', `Pagos (${pagos.length + reembolsos.length})`),
      h('ul', [...pagos, ...reembolsos].map((p) => h('li', h('span', `${CONCEPTOS[p.tipo] || p.tipo} · ${metodoTxt(p.metodo, p.enLinea)}`),
        h('b', (p.tipo === 'REEMBOLSO' ? '−' : '') + money(p.monto)))))) : null,
    !c && consumo ? h('p.muted.small', 'El consumo en sala se paga al cerrar la cuenta. Si te toca la promo de la 4ª visita, el descuento se aplica al cerrar.') : null)
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
    const fin = h('p.small.tiempo-fin', { hidden: true }, '⏰ Tu tiempo terminó: pasa a recepción para cerrar tu cuenta.')
    const caja = h('div', fx.progreso(r.inicio, r.fin, etiqueta), etiqueta, fin)
    fx.tic(fin, () => {
      const acabo = Date.now() >= new Date(r.fin)
      fin.hidden = !acabo
      etiqueta.classList.toggle('bad', acabo)
    })
    return caja
  }
  return null
}

function tarjetaReservacion(r) {
  const acciones = h('div.row')
  if (r.estado === 'PENDIENTE_PAGO') {
    const anticipo = r.pedidos.filter((p) => p.origen === 'PREORDEN' && p.estado === 'EN_ESPERA').reduce((a, p) => a + Number(p.anticipo), 0)
    acciones.append(h('button.btn.sm.primary', { type: 'button', onclick: () => abrirPago({
      codigo: r.codigo, sala: r.sala.numero, totalSala: r.subtotalSala, anticipoSala: r.anticipoSala, anticipo, monto: Number(r.anticipoSala) + anticipo, expiraEn: r.expiraEn,
    }) }, 'Pagar'))
  }
  if (r.estado === 'CONFIRMADA') acciones.append(h('button.btn.sm', { type: 'button', onclick: () => reagendar(r) }, 'Reagendar'))
  if (r.estado === 'PENDIENTE_PAGO' || r.estado === 'CONFIRMADA')
    acciones.append(h('button.btn.sm.danger', { type: 'button', onclick: (e) => cancelar(r, e.currentTarget) }, 'Cancelar'))
  if (r.estado === 'EN_CURSO') acciones.append(h('button.btn.sm.primary', { type: 'button', onclick: () => pedirEnSala(r) }, 'Pedir a mi sala'))
  if (['PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO'].includes(r.estado))
    acciones.append(h('button.btn.sm', { type: 'button', onclick: () => cambiarMusica(r) }, '🎤 Cambiar música'))
  if (r.estado !== 'PENDIENTE_PAGO')
    acciones.append(h('button.btn.sm', { type: 'button', onclick: () => {
      let m
      m = modal(`Estado de cuenta · ${r.codigo}`, estadoCuenta(r), [h('button.btn.primary', { type: 'button', onclick: () => m.close() }, 'Cerrar')])
    } }, '🧾 Estado de cuenta'))

  const pedidos = r.pedidos.filter((p) => p.estado !== 'CANCELADO')
  const artistas = (r.artistas || '').split('\n').filter(Boolean)
  return h('article.card.tilt',
    h('div.row.between', h('code', { style: 'font-size:1.1rem;color:var(--gold);letter-spacing:.08em' }, r.codigo), badgeVivo(r.estado)),
    h('h3', { style: 'margin-top:10px' }, fmtRango(r.inicio, r.fin)),
    h('p.muted.small', `Sala ${r.sala.numero} (${r.sala.tipoSala.nombre}) · ${r.personas} personas · ${money(r.subtotalSala)}`),
    h('p.musica-linea', '🎤 ', r.tematica ? r.tematica.nombre : 'Mi propia lista',
      artistas.length ? h('span.muted', ` · ${artistas.join(', ')}`) : null),
    lineaViva(r),
    r.canal === 'WEB' && ['CONFIRMADA', 'PENDIENTE_PAGO'].includes(r.estado) && Number(r.subtotalSala) > Number(r.anticipoSala)
      ? h('p.small.muted', `Anticipo en línea ${money(r.anticipoSala)} · pagas ${money(Number(r.subtotalSala) - Number(r.anticipoSala))} en recepción al llegar`) : null,
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
    if (!horarioDe(fecha.value)) return clear(slots).append(h('p.dia-cerrado', NO_LABORAL()))
    clear(slots).append(h('span.spinner'))
    const qs = new URLSearchParams({ fecha: fecha.value, personas: r.personas, duracionMin, tipoSalaId: r.sala.tipoSalaId })
    try {
      const d = await api.get('/api/publico/disponibilidad?' + qs)
      clear(slots)
      if (d.cerrado || !d.slots.length) return slots.append(d.cerrado ? h('p.dia-cerrado', NO_LABORAL()) : h('p.muted', 'Sin horarios libres ese día.'))
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
