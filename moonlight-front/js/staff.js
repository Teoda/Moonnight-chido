// Panel del personal: cada pestaña se muestra solo a los roles que la API permite (ADMIN ve todo).
'use strict'

const TABS = [
  { id: 'recepcion', titulo: 'Recepción', roles: ['RECEPCION', 'OPERACIONES'], cargar: () => cargarPorCobrar() },
  { id: 'agenda', titulo: 'Agenda', roles: ['RECEPCION', 'OPERACIONES', 'FINANZAS'], cargar: () => cargarAgenda() },
  { id: 'barra', titulo: 'Barra', roles: ['BARRA', 'RECEPCION'], cargar: (f) => cargarBarra(f), auto: true },
  { id: 'salas', titulo: 'Salas', roles: ['OPERACIONES', 'RECEPCION', 'LIMPIEZA'], cargar: (f) => cargarSalas(f), auto: true },
  { id: 'limpieza', titulo: 'Limpieza', roles: ['LIMPIEZA', 'OPERACIONES'], cargar: (f) => cargarLimpieza(f), auto: true },
  { id: 'finanzas', titulo: 'Finanzas', roles: ['FINANZAS'], cargar: () => cargarKpis() },
]
const ROLES = { ADMIN: 'Administración', OPERACIONES: 'Operaciones', FINANZAS: 'Finanzas', RECEPCION: 'Recepción', BARRA: 'Barra', MARKETING: 'Marketing', LIMPIEZA: 'Limpieza' }
const st = { usuario: null, tab: null, catalogo: null, codigo: null, timer: null, sonido: true, barraIds: null, limpiezaIds: null }

/** Pinta sin la animación de aparición (para refrescos automáticos que no deben "parpadear"). */
function quieto(box, pintar) {
  box.setAttribute('data-static', '')
  pintar()
  setTimeout(() => box.removeAttribute('data-static')) // el observer de fx corre antes (microtarea)
}
/** Género elegido o "Mi lista" con sus artistas (para ambientar la sala). */
const musicaTxt = (r) => {
  const artistas = (r.artistas || '').split('\n').filter(Boolean)
  const base = r.tematica ? r.tematica.nombre : artistas.length ? 'Mi lista' : 'Por definir'
  return artistas.length ? `${base}: ${artistas.join(', ')}` : base
}
const hace = (fecha) => fx.falta(Date.now() - new Date(fecha))

const puede = (...roles) => st.usuario && (st.usuario.rol === 'ADMIN' || roles.includes(st.usuario.rol))
const metodoSelect = () => h('select', h('option', { value: 'EFECTIVO' }, 'Efectivo'), h('option', { value: 'TARJETA' }, 'Tarjeta'))

// ───────────── sesión ─────────────
document.addEventListener('DOMContentLoaded', async () => {
  api.onUnauthorized = () => { if (st.usuario) { st.usuario = null; toast('Tu sesión expiró. Vuelve a entrar.', 'bad'); mostrarLogin() } }
  $('#form-login').addEventListener('submit', login)
  $('#form-buscar').addEventListener('submit', (e) => { e.preventDefault(); buscar($('#b-codigo').value) })
  $('#btn-mostrador').addEventListener('click', mostrador)
  $('#btn-por-cobrar').addEventListener('click', cargarPorCobrar)
  $('#btn-agenda').addEventListener('click', cargarAgenda)
  $('#ag-fecha').addEventListener('change', cargarAgenda)
  $('#btn-salas').addEventListener('click', cargarSalas)
  $('#btn-kpis').addEventListener('click', cargarKpis)
  $('#ag-fecha').value = hoyLocal()
  fx.cielo()
  fx.auto($('main'))
  const fmtReloj = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  fx.tic($('#reloj'), () => ($('#reloj').textContent = fmtReloj.format(new Date())))
  try { st.sonido = localStorage.getItem('ml-sonido') !== 'no' } catch { /* sin almacenamiento */ }
  const pintarSonido = () => { $('#btn-sonido').textContent = st.sonido ? '🔔 Sonido' : '🔕 Silencio'; $('#btn-sonido').setAttribute('aria-pressed', st.sonido) }
  pintarSonido()
  $('#btn-sonido').addEventListener('click', () => {
    st.sonido = !st.sonido
    try { localStorage.setItem('ml-sonido', st.sonido ? 'si' : 'no') } catch { /* sin almacenamiento */ }
    pintarSonido()
    if (st.sonido) fx.ding()
  })
  try {
    st.usuario = (await api.get('/api/auth/me')).usuario
    entrar()
  } catch { mostrarLogin() }
})

function mostrarLogin() {
  clearInterval(st.timer)
  $('#panel').hidden = true
  $('#login').hidden = false
  clear($('#userbox'))
  $('#l-email').focus()
}

async function login(e) {
  e.preventDefault()
  $('#login-err').textContent = ''
  try {
    const r = await api.post('/api/auth/login', { email: $('#l-email').value, password: $('#l-pw').value })
    st.usuario = r.usuario
    $('#l-pw').value = ''
    entrar()
  } catch (x) { $('#login-err').textContent = x.message }
}

function entrar() {
  $('#login').hidden = true
  $('#panel').hidden = false
  append(clear($('#userbox')), [
    h('span.small', st.usuario.nombre), h('span.badge.accent', ROLES[st.usuario.rol] || st.usuario.rol),
    h('button.btn.sm.ghost', { type: 'button', onclick: cambiarPassword }, 'Contraseña'),
    h('button.btn.sm', { type: 'button', onclick: (e) => salir(e.currentTarget, false) }, 'Salir'),
  ])
  const tabs = clear($('#tabs'))
  const mias = TABS.filter((t) => puede(...t.roles))
  for (const t of mias) tabs.append(h('button', { type: 'button', dataset: { tab: t.id }, onclick: () => abrirTab(t.id) }, t.titulo))
  if (!mias.length) return append(clear($('#tabs')), h('p.muted', 'Tu rol aún no tiene secciones en este panel.'))
  clearInterval(st.timer)
  st.timer = setInterval(() => { const t = TABS.find((x) => x.id === st.tab); if (t?.auto && !document.hidden) t.cargar(false) }, 15_000)
  abrirTab(mias[0].id)
}

function abrirTab(id) {
  st.tab = id
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id))
  $$('.tab').forEach((t) => (t.hidden = t.id !== `tab-${id}`))
  TABS.find((t) => t.id === id).cargar(true)
}

async function salir(btn, todas) {
  await accion(btn, () => api.post(todas ? '/api/auth/logout-todas' : '/api/auth/logout'))
  st.usuario = null
  api.csrf = null
  mostrarLogin()
}

function cambiarPassword() {
  let m
  const err = h('div.err')
  const form = h('form',
    h('div.field', h('label', { for: 'cp-a' }, 'Contraseña actual'), h('input#cp-a', { type: 'password', name: 'actual', required: true, autocomplete: 'current-password' })),
    h('div.field', h('label', { for: 'cp-n' }, 'Nueva (mín. 10, letras y números)'), h('input#cp-n', { type: 'password', name: 'nueva', required: true, minLength: 10, autocomplete: 'new-password' })),
    err, h('div.row', h('button.btn.primary', { type: 'submit' }, 'Guardar'),
      h('button.btn.danger', { type: 'button', onclick: (e) => { m.close(); salir(e.currentTarget, true) } }, 'Cerrar todas mis sesiones')))
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = ''
    const f = new FormData(form)
    try {
      await api.post('/api/auth/cambiar-password', { actual: f.get('actual'), nueva: f.get('nueva') })
      m.close(); toast('Contraseña actualizada. Se cerraron tus otras sesiones.', 'ok')
    } catch (x) { err.textContent = x.message }
  })
  m = modal('Mi cuenta', form)
}

async function catalogo() {
  return (st.catalogo ??= await api.get('/api/publico/catalogo'))
}

// ───────────── recepción ─────────────
async function buscar(codigo) {
  codigo = (codigo || '').trim().toUpperCase()
  if (!/^ML[0-9A-F]{8}$/.test(codigo)) return toast('El número tiene el formato ML seguido de 8 caracteres (0-9, A-F)', 'bad')
  st.codigo = codigo
  $('#b-codigo').value = codigo
  const box = clear($('#detalle'))
  box.append(h('div.card.empty', h('span.spinner')))
  try {
    const rv = await api.get(`/api/staff/reservaciones/buscar/${codigo}`)
    clear(box).append(detalleReservacion(rv))
  } catch (e) {
    clear(box).append(h('div.card.empty.err', e.message))
  }
}

function detalleReservacion(rv) {
  const pagado = rv.pagos.filter((p) => p.estado === 'PAGADO').reduce((a, p) => a + Number(p.monto), 0)
  const acciones = h('div.row')
  const recargar = () => { buscar(rv.codigo); cargarPorCobrar() }
  const post = (btn, url, body, ok) => accion(btn, async () => { const r = await api.post(url, body); toast(ok(r), 'ok'); recargar(); return r })

  if (rv.estado === 'CONFIRMADA') {
    acciones.append(
      h('button.btn.primary', { type: 'button', onclick: (e) => post(e.currentTarget, `/api/staff/reservaciones/${rv.id}/check-in`, {},
        (r) => (r.retrasoMin > 0 ? `Check-in con ${r.retrasoMin} min de retraso${r.tiempoPerdidoMin ? ` (se pierden ${r.tiempoPerdidoMin} min)` : ' (se recorrió el fin)'}. Termina ${fmtHora(r.fin)}` : `Check-in listo. Termina ${fmtHora(r.fin)}`)) }, 'Check-in'),
      h('button.btn.danger', { type: 'button', onclick: async (e) => {
        const b = e.currentTarget
        if (await confirmar('Marcar no-show', `${rv.codigo}: no se reembolsa el pago y se cancela el pedido anticipado.`, { ok: 'Marcar no-show', peligro: true }))
          post(b, `/api/staff/reservaciones/${rv.id}/no-show`, {}, () => 'Marcada como no-show')
      } }, 'No-show'),
    )
  }
  if (rv.estado === 'EN_CURSO') {
    acciones.append(
      h('button.btn', { type: 'button', onclick: () => extender(rv, recargar) }, 'Tiempo extra'),
      h('button.btn', { type: 'button', onclick: () => pedidoStaff(rv, recargar) }, 'Agregar pedido'),
      h('button.btn.primary', { type: 'button', onclick: () => cerrarCuenta(rv, recargar) }, 'Cerrar cuenta'),
    )
  }

  const dl = (pares) => h('dl', { style: 'display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0' },
    pares.filter(Boolean).map(([k, v]) => [h('dt.muted.small', k), h('dd', { style: 'margin:0' }, v)]))

  return h('div.card.stack',
    h('div.row.between', h('code', { style: 'font-size:1.4rem;color:var(--gold);letter-spacing:.08em' }, rv.codigo), badge(rv.estado)),
    dl([
      ['Cliente', `${rv.cliente.nombre}${rv.cliente.telefono ? ' · ' + rv.cliente.telefono : ''}`],
      ['Horario', fmtRango(rv.inicio, rv.fin) + (rv.finOriginal ? ` (original ${fmtHora(rv.finOriginal)})` : '')],
      ['Sala', h('span', `${rv.sala.numero} · ${rv.sala.tipoSala.nombre} `, badge(rv.sala.estado))],
      ['Música', musicaTxt(rv)],
      rv.canciones ? ['Canciones', rv.canciones.split('\n').join(' · ')] : null,
      ['Personas', rv.personas],
      ['Canal', rv.canal === 'WEB' ? 'En línea' : 'Mostrador'],
      ['Sala (subtotal)', money(rv.subtotalSala)],
      ['Pagado', money(pagado)],
      rv.retrasoMin ? ['Retraso', `${rv.retrasoMin} min (perdidos ${rv.tiempoPerdidoMin})`] : null,
      rv.checkInEn ? ['Check-in', fmtFechaHora(rv.checkInEn)] : null,
    ]),
    rv.pagos.length ? h('div', h('h3', 'Pagos'), h('div.table-wrap', h('table',
      h('thead', h('tr', ['Tipo', 'Método', 'Monto', 'Estado'].map((t) => h('th', t)))),
      h('tbody', rv.pagos.map((p) => h('tr', h('td', p.tipo.replace(/_/g, ' ').toLowerCase()), h('td', p.metodo.toLowerCase() + (p.enLinea ? ' (en línea)' : '')), h('td', money(p.monto)), h('td', p.estado.toLowerCase()))))))) : null,
    rv.pedidos.length ? h('div', h('h3', 'Pedidos'), rv.pedidos.map((p) => h('div.row', { style: 'margin-bottom:6px' },
      badge(p.estado), h('span.small.muted', p.origen.replace('_', ' ')), h('span.small', p.items.map(lineaItem).join(', ')), h('b.small', money(p.total))))) : null,
    rv.extensiones.length ? h('p.small.muted', 'Tiempo extra: ' + rv.extensiones.map((x) => `${x.minutos} min (${money(x.monto)})`).join(', ')) : null,
    acciones.childNodes.length ? acciones : null,
  )
}

function extender(rv, listo) {
  let m
  const minutos = h('select', [30, 60, 90, 120].map((n) => h('option', { value: n }, durTxt(n))))
  const metodo = metodoSelect()
  const ok = h('button.btn.primary', { type: 'button' }, 'Cobrar y ampliar')
  ok.addEventListener('click', async () => {
    const r = await accion(ok, () => api.post(`/api/staff/reservaciones/${rv.id}/extender`, { minutos: Number(minutos.value), metodo: metodo.value }))
    if (!r) return
    m.close(); toast(`Ampliada hasta ${fmtHora(r.fin)} · cobrado ${money(r.monto)}`, 'ok'); listo()
  })
  m = modal(`Tiempo extra · ${rv.codigo}`, [
    h('p.muted.small', 'Solo si no hay otra reservación después (incluida la limpieza) y sin rebasar el cierre.'),
    h('div.form-grid', h('div.field', h('label', 'Minutos'), minutos), h('div.field', h('label', 'Método de pago'), metodo)),
  ], [h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, 'Volver'), ok])
}

async function pedidoStaff(rv, listo) {
  let cat
  try { cat = await catalogo() } catch (e) { return toast(e.message, 'bad') }
  let m
  const total = h('b', money(0))
  const sel = selectorMenu(cat.menu, () => { total.textContent = money(sel.total()) }, { tipos: cat.tipos, tipoSalaId: rv.sala.tipoSalaId })
  const ok = h('button.btn.primary', { type: 'button' }, 'Enviar a barra')
  ok.addEventListener('click', async () => {
    const items = sel.items()
    if (!items.length) return toast('Agrega al menos un producto', 'bad')
    const r = await accion(ok, () => api.post(`/api/staff/reservaciones/${rv.id}/pedido`, { items }))
    if (!r) return
    m.close(); toast('Pedido enviado a barra', 'ok'); listo()
  })
  m = modal(`Pedido · sala ${rv.sala.numero}`, [h('p.muted.small', 'Se cobra al cerrar la cuenta.'), sel.el, h('p', { style: 'margin-top:12px' }, 'Total: ', total)],
    [h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, 'Volver'), ok])
}

function cerrarCuenta(rv, listo) {
  let m
  const metodo = metodoSelect()
  const ok = h('button.btn.primary', { type: 'button' }, 'Cerrar cuenta')
  ok.addEventListener('click', async () => {
    const c = await accion(ok, () => api.post(`/api/staff/reservaciones/${rv.id}/cerrar-cuenta`, { metodo: metodo.value }))
    if (!c) return
    m.close(); listo()
    const fila = (k, v, b) => [h('dt', b ? h('b', k) : k), h('dd', { style: 'margin:0;text-align:right' }, b ? h('b', money(v)) : money(v))]
    let r
    r = modal(`Cuenta cerrada · ${rv.codigo}`, [
      h('dl', { style: 'display:grid;grid-template-columns:1fr auto;gap:6px 12px;margin:0' },
        fila('Sala', c.subtotalSala), fila('Tiempo extra', c.subtotalExtras), fila('Pedidos anticipados', c.subtotalPedidosAnticipados),
        fila('Consumo', c.subtotalConsumo), Number(c.descuento) ? fila('Descuento (promo 4ª visita)', -c.descuento) : null,
        fila('Total', c.total, true), fila('Pagado antes', c.pagadoPrevio), fila('Cobrado ahora', c.saldo, true)),
      h('p.muted.small', { style: 'margin-top:12px' }, `La sala ${rv.sala.numero} pasó a limpieza.`),
    ], [h('button.btn.primary', { type: 'button', onclick: () => r.close() }, 'Listo')])
  })
  m = modal(`Cerrar cuenta · ${rv.codigo}`, [
    h('p.muted.small', 'Se suman sala, tiempo extra y pedidos; se aplica la promo de la 4ª visita del mes si corresponde, y se cobra el saldo.'),
    h('div.field', h('label', 'Método para el saldo (si hay)'), metodo),
  ], [h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, 'Volver'), ok])
}

async function mostrador() {
  let cat
  try { cat = await catalogo() } catch (e) { return toast(e.message, 'bad') }
  let m
  const err = h('div.err')
  const ahora = h('input', { type: 'checkbox', name: 'ahora', checked: true })
  const inicio = h('input', { type: 'datetime-local', name: 'inicio', disabled: true })
  ahora.addEventListener('change', () => { inicio.disabled = ahora.checked })
  const metodo = metodoSelect(); metodo.name = 'metodo'
  const selTipo = h('select', { name: 'tipoSalaId' }, cat.tipos.map((t) => h('option', { value: t.id }, `${t.nombre} (hasta ${t.capacidadMax})`)))
  // Botella de cortesía: solo si el grupo cae en el tipo de sala que la incluye (Premium)
  const cortesia = cat.cortesia
  const botella = h('select', { name: 'cortesiaProductoId' }, (cortesia?.botellas || []).map((b) => h('option', { value: b.id }, b.nombre.replace(' (botella)', ''))))
  const campoBotella = h('div.field', { hidden: true }, h('label', '🍾 Botella de cortesía (Sala Premium)'), botella)
  const revisarCortesia = () => {
    const tipo = cat.tipos.find((t) => t.id === Number(selTipo.value))
    const aplica = !!cortesia?.botellas.length && tipo?.id === cortesia.tipoSalaId
    campoBotella.hidden = !aplica
    botella.disabled = !aplica // deshabilitado = no se envía en el FormData
  }
  const form = h('form',
    h('div.form-grid',
      h('div.field', h('label', 'Nombre'), h('input', { name: 'nombre', required: true, minLength: 2, maxLength: 120 })),
      h('div.field', h('label', 'Teléfono (opcional)'), h('input', { name: 'telefono', type: 'tel', inputMode: 'numeric' })),
      h('div.field', h('label', 'Personas'), h('input', { name: 'personas', type: 'number', min: 1, max: 16, value: 2, required: true })),
      h('div.field', h('label', 'Duración'), h('select', { name: 'duracionMin' }, [60, 90, 120, 150, 180, 210, 240].map((n) => h('option', { value: n, selected: n === 60 }, durTxt(n))))),
      h('div.field', h('label', 'Tamaño de sala'), selTipo),
      h('div.field', h('label', 'Género musical'), h('select', { name: 'tematicaId' }, h('option', { value: '' }, 'Lo elige en sala'), cat.tematicas.map((t) => h('option', { value: t.id }, t.nombre)))),
      h('div.field', h('label', 'Sala # (opcional)'), h('input', { name: 'salaNumero', type: 'number', min: 1 })),
      h('div.field', h('label', 'Método de pago'), metodo),
      campoBotella,
    ),
    h('div.field', h('label.check', ahora, 'Iniciar ahora (la sala debe estar lista)')),
    h('div.field', h('label', 'O programar para (hora de México)'), inicio),
    err,
  )
  const ok = h('button.btn.primary', { type: 'button' }, 'Cobrar sala y reservar')
  ok.addEventListener('click', async () => {
    err.textContent = ''
    if (!form.reportValidity()) return
    const f = new FormData(form)
    const body = { nombre: f.get('nombre'), personas: Number(f.get('personas')), duracionMin: Number(f.get('duracionMin')), metodo: f.get('metodo') }
    if (f.get('telefono')) body.telefono = f.get('telefono')
    if (f.get('tematicaId')) body.tematicaId = Number(f.get('tematicaId'))
    body.tipoSalaId = Number(f.get('tipoSalaId'))
    if (f.get('salaNumero')) body.salaNumero = Number(f.get('salaNumero'))
    if (f.get('cortesiaProductoId')) body.cortesiaProductoId = Number(f.get('cortesiaProductoId'))
    if (!ahora.checked) {
      if (!inicio.value) { err.textContent = 'Indica la fecha y hora de inicio'; return }
      body.inicio = new Date(`${inicio.value}:00-06:00`).toISOString()
    }
    ok.disabled = true
    try {
      const r = await api.post('/api/staff/reservaciones/mostrador', body)
      m.close()
      toast(`Reservación ${r.codigo} · sala ${r.sala} · cobrado ${money(r.cobrado)}`, 'ok')
      buscar(r.codigo)
    } catch (x) { err.textContent = x.message } finally { ok.disabled = false }
  })
  // el tamaño se sugiere por personas, pero recepción puede cambiarlo
  form.elements.personas.addEventListener('input', () => {
    const n = Number(form.elements.personas.value)
    const t = cat.tipos.find((x) => x.capacidadMin <= n && n <= x.capacidadMax)
    if (t) selTipo.value = t.id
    revisarCortesia()
  })
  selTipo.addEventListener('change', revisarCortesia)
  selTipo.value = (cat.tipos.find((x) => x.capacidadMin <= 2 && 2 <= x.capacidadMax) || cat.tipos[0]).id
  revisarCortesia()
  m = modal('Reservación de mostrador', form, [h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, 'Volver'), ok])
}

async function cargarPorCobrar() {
  const box = $('#por-cobrar')
  try {
    const ps = await api.get('/api/staff/pedidos/por-cobrar')
    clear(box)
    if (!ps.length) return box.append(h('p.muted.small', 'Nada pendiente.'))
    for (const p of ps) {
      const metodo = metodoSelect()
      const btn = h('button.btn.sm.primary', { type: 'button', disabled: p.reservacion.estado !== 'EN_CURSO', title: p.reservacion.estado !== 'EN_CURSO' ? 'Haz el check-in primero' : '' }, Number(p.restante) > 0 ? `Cobrar ${money(p.restante)}` : 'Enviar a barra')
      btn.addEventListener('click', async () => {
        const r = await accion(btn, () => api.post(`/api/staff/pedidos/${p.id}/cobrar-saldo`, { metodo: metodo.value }))
        if (r) { toast('Cobrado: el pedido pasó a barra', 'ok'); cargarPorCobrar(); if (st.codigo === p.reservacion.codigo) buscar(p.reservacion.codigo) }
      })
      box.append(h('div', { style: 'padding:10px 0;border-bottom:1px solid var(--line)' },
        h('div.row.between', h('a', { href: '#', onclick: (e) => { e.preventDefault(); buscar(p.reservacion.codigo) } }, p.reservacion.codigo), h('span.small.muted', `Sala ${p.reservacion.sala.numero}`), badge(p.reservacion.estado)),
        h('p.small', { style: 'margin:6px 0' }, p.items.map(lineaItem).join(', ')),
        h('div.row', metodo, btn)))
      metodo.style.width = 'auto'
    }
  } catch (e) { clear(box).append(h('p.err', e.message)) }
}

// ───────────── agenda ─────────────
async function cargarAgenda() {
  const fecha = $('#ag-fecha').value || hoyLocal()
  const desde = new Date(`${fecha}T00:00:00-06:00`)
  const hasta = new Date(desde.getTime() + 30 * 36e5) // incluye la madrugada
  const box = clear($('#agenda'))
  box.append(h('div.empty', h('span.spinner')))
  try {
    const rs = await api.get(`/api/staff/reservaciones?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`)
    clear(box)
    if (!rs.length) return box.append(h('div.empty', 'Sin reservaciones ese día.'))
    const abrir = puede('RECEPCION', 'OPERACIONES')
    box.append(h('table',
      h('thead', h('tr', ['Horario', 'Código', 'Cliente', 'Sala', 'Personas', 'Música', 'Canal', 'Estado'].map((t) => h('th', t)))),
      h('tbody', rs.map((r) => h('tr', { class: abrir ? 'click' : '', onclick: abrir ? () => { abrirTab('recepcion'); buscar(r.codigo) } : null },
        h('td', `${fmtHora(r.inicio)}–${fmtHora(r.fin)}`), h('td', h('code', r.codigo)),
        h('td', r.cliente.nombre), h('td', r.sala.numero), h('td', r.personas), h('td.small', musicaTxt(r)),
        h('td.small.muted', r.canal === 'WEB' ? 'En línea' : 'Mostrador'), h('td', badge(r.estado))))),
    ))
  } catch (e) { clear(box).append(h('div.empty.err', e.message)) }
}

// ───────────── barra ─────────────
async function cargarBarra(forzar = true) {
  const box = $('#barra')
  let ps
  try { ps = await api.get('/api/staff/pedidos') } catch (e) {
    if (forzar) clear(box).append(h('div.card.empty.err', e.message))
    return
  }
  if (!cambio('barra', ps) && !forzar) return
  // pedidos que no estaban en la consulta anterior → resaltar y avisar
  const ids = new Set(ps.map((p) => p.id))
  const nuevos = st.barraIds && !forzar ? ps.filter((p) => !st.barraIds.has(p.id)) : []
  st.barraIds = ids
  if (nuevos.length) {
    if (st.sonido) fx.ding()
    toast(nuevos.length === 1 ? `Nuevo pedido · sala ${nuevos[0].reservacion.sala.numero}` : `${nuevos.length} pedidos nuevos`, 'ok')
  }
  const pintar = () => {
    clear(box)
    if (!ps.length) return box.append(h('div.card.empty', 'Sin pedidos pendientes. 🎤'))
    for (const p of ps) {
      const cambiar = (estado) => async (e) => {
        if (estado === 'CANCELADO' && !(await confirmar('Cancelar pedido', `¿Cancelar el pedido de la sala ${p.reservacion.sala.numero}?`, { ok: 'Cancelar pedido', peligro: true }))) return
        const r = await accion(e.currentTarget, () => api.patch(`/api/staff/pedidos/${p.id}`, { estado }))
        if (r) { toast(estado === 'ENTREGADO' ? `Sala ${p.reservacion.sala.numero}: entregado` : 'Pedido actualizado', 'ok'); cargarBarra() }
      }
      const espera = h('span.vivo.accent')
      const card = h('article.card.order', { class: `${p.estado}${nuevos.includes(p) ? ' nuevo' : ''}` },
        h('div.row.between', h('h3', { style: 'margin:0' }, `Sala ${p.reservacion.sala.numero}`), badge(p.estado)),
        h('div.small.muted', `${p.reservacion.codigo} · ${p.origen.replace('_', ' ').toLowerCase()}`),
        h('div', espera),
        h('ul', p.items.map((i) => h('li', h('b', `${i.cantidad}× `), i.producto.nombre, esCortesia(i) ? h('span.badge.ok', { style: 'margin-left:6px' }, 'Cortesía') : null))),
        h('div.row',
          p.estado === 'NUEVO' ? h('button.btn.sm', { type: 'button', onclick: cambiar('PREPARANDO') }, 'Preparar') : null,
          h('button.btn.sm.ok', { type: 'button', onclick: cambiar('ENTREGADO') }, 'Entregado'),
          h('button.btn.sm.danger', { type: 'button', onclick: cambiar('CANCELADO') }, 'Cancelar')),
      )
      // cronómetro de espera; a los 15 min se marca en rojo
      fx.tic(espera, () => {
        const min = (Date.now() - new Date(p.creadoEn)) / 6e4
        espera.textContent = `Esperando ${hace(p.creadoEn)}`
        espera.classList.toggle('bad', min >= 15)
        card.classList.toggle('tarde', min >= 15)
      })
      box.append(card)
    }
  }
  forzar ? pintar() : quieto(box, pintar)
}

// ───────────── salas ─────────────
async function cargarSalas(forzar = true) {
  const box = $('#salas')
  let salas
  try { salas = await api.get('/api/staff/salas') } catch (e) {
    if (forzar) clear(box).append(h('div.card.empty.err', e.message))
    return
  }
  if (!cambio('salas', salas) && !forzar) return
  const pintar = () => {
    clear(box)
    const ops = puede('OPERACIONES')
    for (const s of salas) {
      const ahora = s.reservaciones.find((r) => r.estado === 'EN_CURSO')
      const prox = s.reservaciones.find((r) => r.estado === 'CONFIRMADA')
      let enVivo = null
      if (ahora) {
        const etiqueta = h('span.vivo.accent')
        enVivo = h('div', fx.progreso(ahora.inicio, ahora.fin, etiqueta), etiqueta)
      }
      let proxima = h('div.small.muted', 'Sin próximas')
      if (prox) {
        proxima = h('div.small.muted')
        fx.tic(proxima, () => {
          const resta = new Date(prox.inicio) - Date.now()
          proxima.textContent = (resta > 0 ? `Próxima en ${fx.falta(resta)} · ${prox.codigo}` : `Llegando: ${prox.codigo}`) + ` · 🎤 ${musicaTxt(prox)}`
        })
      }
      box.append(h('div.card.sala-tile.tilt', { class: `${s.estado}${ahora ? ' ocupada' : ''}` },
        h('div.num', s.numero),
        h('div.small.muted', s.tipoSala.nombre),
        h('div', { style: 'margin:8px 0' }, badge(s.estado), ' ', ahora ? h('span.badge.accent.pulso', 'Ocupada') : null),
        ahora ? h('div.small.musica-linea', '🎤 ', musicaTxt(ahora)) : null,
        enVivo,
        proxima,
        ops && s.estado !== 'LIMPIEZA' ? h('button.btn.sm', { type: 'button', style: 'margin-top:10px', class: s.estado === 'MANTENIMIENTO' ? 'ok' : 'danger', onclick: async (e) => {
          const activo = s.estado !== 'MANTENIMIENTO'
          const r = await accion(e.currentTarget, () => api.post(`/api/staff/salas/${s.numero}/mantenimiento`, { activo }))
          if (r) { toast(`Sala ${s.numero} ${activo ? 'en mantenimiento' : 'activa'}`, 'ok'); cargarSalas() }
        } }, s.estado === 'MANTENIMIENTO' ? 'Reactivar' : 'Mantenimiento') : null,
      ))
    }
  }
  forzar ? pintar() : quieto(box, pintar)
}

// ───────────── limpieza ─────────────
async function cargarLimpieza(forzar = true) {
  const box = $('#limpieza')
  let ls
  try { ls = await api.get('/api/staff/limpieza') } catch (e) {
    if (forzar) clear(box).append(h('div.card.empty.err', e.message))
    return
  }
  if (!cambio('limpieza', ls) && !forzar) return
  const nuevas = st.limpiezaIds && !forzar ? ls.filter((l) => !st.limpiezaIds.has(l.id)) : []
  st.limpiezaIds = new Set(ls.map((l) => l.id))
  if (nuevas.length) {
    if (st.sonido) fx.ding()
    toast(`Sala ${nuevas.map((l) => l.sala.numero).join(', ')} por limpiar`, 'ok')
  }
  const pintar = () => {
    clear(box)
    if (!ls.length) return box.append(h('div.card.empty', 'Todas las salas están listas. ✨'))
    for (const l of ls) {
      const paso = (accionUrl, txt) => async (e) => {
        const r = await accion(e.currentTarget, () => api.post(`/api/staff/limpieza/${l.id}/${accionUrl}`))
        if (r) { toast(txt, 'ok'); cargarLimpieza() }
      }
      const crono = h('span.vivo', { class: l.estado === 'EN_PROCESO' ? 'accent' : 'warn' })
      fx.tic(crono, () => {
        crono.textContent = l.estado === 'EN_PROCESO' ? `Limpiando hace ${hace(l.iniciadaEn)}` : `Esperando hace ${hace(l.creadaEn)}`
      })
      box.append(h('article.card.order', { class: `${l.estado === 'EN_PROCESO' ? 'PREPARANDO' : ''}${nuevas.includes(l) ? ' nuevo' : ''}` },
        h('div.row.between', h('h3', { style: 'margin:0' }, `Sala ${l.sala.numero}`), badge(l.estado)),
        h('p', crono),
        h('div.row',
          l.estado === 'PENDIENTE' ? h('button.btn.sm', { type: 'button', onclick: paso('iniciar', 'Limpieza iniciada') }, 'Iniciar') : null,
          h('button.btn.sm.ok', { type: 'button', onclick: paso('terminar', `Sala ${l.sala.numero} lista ✨`) }, 'Sala lista')),
      ))
    }
  }
  forzar ? pintar() : quieto(box, pintar)
}

// ───────────── finanzas ─────────────
async function cargarKpis() {
  const box = clear($('#kpis'))
  box.append(h('div.grid.cols-4', h('div.skeleton.bajo'), h('div.skeleton.bajo'), h('div.skeleton.bajo'), h('div.skeleton.bajo')))
  try {
    const k = await api.get('/api/staff/kpis')
    clear(box)
    const estados = Object.entries(k.reservacionesPorEstado)
    const ingresos = h('div.kpi')
    const contadores = estados.map(([e, n]) => { const el = h('div.kpi'); return [e, n, el] })
    append(box, [
      h('div.grid.cols-4',
        h('div.card.tilt', h('div.muted.small', 'Ingresos netos'), ingresos),
        contadores.map(([e, , el]) => h('div.card.tilt', h('div.muted.small', (ESTADOS[e] || [e])[0]), el))),
      h('div.card.table-wrap', { style: 'margin-top:16px' }, h('h3', 'Pagos por tipo y método'), h('table',
        h('thead', h('tr', ['Tipo', 'Método', 'Estado', 'Monto'].map((t) => h('th', t)))),
        h('tbody', k.pagos.map((p) => h('tr', h('td', p.tipo.replace(/_/g, ' ').toLowerCase()), h('td', p.metodo.toLowerCase()), h('td', badge(p.estado)), h('td', money(p.monto))))))),
    ])
    fx.contar(ingresos, k.ingresosNetos, money, 0, 1200)
    for (const [, n, el] of contadores) fx.contar(el, n, (v) => String(Math.round(v)), 0, 900)
  } catch (e) { clear(box).append(h('div.empty.err', e.message)) }
}
