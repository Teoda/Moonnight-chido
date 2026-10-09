// Utilidades compartidas: llamadas a la API (cookie + CSRF), creación segura de elementos y formato.
// Todo el texto se inserta con textContent (nunca innerHTML) para evitar XSS.
'use strict'

const TZ = 'America/Mexico_City'

const api = {
  csrf: null,
  onUnauthorized: null,
  async req(method, url, body) {
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (method !== 'GET' && this.csrf) headers['X-CSRF-Token'] = this.csrf
    let res
    try {
      res = await fetch(url, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) })
    } catch {
      throw new ApiError(0, 'Sin conexión con el servidor')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (res.status === 401 && this.onUnauthorized) this.onUnauthorized()
      const detalle = data.detalles?.map((d) => d.mensaje).join(' · ')
      throw new ApiError(res.status, detalle ? `${data.error}: ${detalle}` : data.error || `Error ${res.status}`)
    }
    if (data.csrfToken) this.csrf = data.csrfToken
    return data
  },
  get(url) { return this.req('GET', url) },
  post(url, body = {}) { return this.req('POST', url, body) },
  patch(url, body = {}) { return this.req('PATCH', url, body) },
}

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

/** h('div.card#id', { onclick, attrs... }, ...children) — crea elementos sin innerHTML. */
function h(sel, props, ...kids) {
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) { kids.unshift(props); props = {} }
  const [, tag = 'div', rest = ''] = sel.match(/^([a-z0-9-]*)(.*)$/i)
  const el = document.createElement(tag || 'div')
  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) m[1] === '.' ? el.classList.add(m[2]) : (el.id = m[2])
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'class') el.className += ' ' + v
    else if (k === 'dataset') Object.assign(el.dataset, v)
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  append(el, kids)
  return el
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue
    el.append(k instanceof Node ? k : document.createTextNode(String(k)))
  }
  return el
}
const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const clear = (el) => { el.replaceChildren(); return el }

// ── formato ──
const money = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0))
const fmtHora = (d) => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d))
const fmtFecha = (d) => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d))
const fmtFechaHora = (d) => `${fmtFecha(d)} · ${fmtHora(d)}`
const fmtRango = (a, b) => `${fmtFecha(a)} · ${fmtHora(a)}–${fmtHora(b)}`
/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del negocio. */
const hoyLocal = (offsetDias = 0) => {
  const d = new Date(Date.now() + offsetDias * 864e5)
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
}
const durTxt = (min) => (min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`)
const slug = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const ESTADOS = {
  PENDIENTE_PAGO: ['Pendiente de pago', 'warn'],
  CONFIRMADA: ['Confirmada', 'ok'],
  EN_CURSO: ['En curso', 'accent'],
  FINALIZADA: ['Finalizada', ''],
  CANCELADA: ['Cancelada', 'bad'],
  NO_SHOW: ['No-show', 'bad'],
  EN_ESPERA: ['En espera', 'warn'],
  NUEVO: ['Nuevo', 'info'],
  PREPARANDO: ['Preparando', 'warn'],
  ENTREGADO: ['Entregado', 'ok'],
  CANCELADO: ['Cancelado', 'bad'],
  ACTIVA: ['Lista', 'ok'],
  LIMPIEZA: ['Limpieza', 'warn'],
  MANTENIMIENTO: ['Mantenimiento', 'bad'],
  PENDIENTE: ['Pendiente', 'warn'],
  EN_PROCESO: ['En proceso', 'info'],
  LISTA: ['Lista', 'ok'],
  PAGADO: ['Pagado', 'ok'],
  REEMBOLSADO: ['Reembolsado', 'warn'],
  FALLIDO: ['Fallido', 'bad'],
}
const badge = (estado) => {
  const [txt, cls] = ESTADOS[estado] || [estado, '']
  return h('span.badge', { class: cls }, txt)
}

// ── toasts ──
function toast(msg, tipo = '') {
  let box = $('.toasts')
  if (!box) document.body.append((box = h('div.toasts', { role: 'status', 'aria-live': 'polite' })))
  const t = h('div.toast', { class: tipo }, msg)
  box.append(t)
  setTimeout(() => t.remove(), tipo === 'bad' ? 6000 : 3500)
}

// ── diálogos ──
/** Abre un <dialog> con título, cuerpo y botones. Devuelve { dlg, close }. */
function modal(titulo, cuerpo, botones = []) {
  const dlg = h('dialog')
  const close = () => { dlg.close(); dlg.remove() }
  append(dlg, [
    h('div.dlg-head', h('h3', titulo), h('button.x', { type: 'button', 'aria-label': 'Cerrar', onclick: close }, '×')),
    h('div.dlg-body', cuerpo),
    botones.length ? h('div.dlg-foot', botones) : null,
  ])
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close() })
  document.body.append(dlg)
  dlg.showModal()
  return { dlg, close }
}

/** Confirmación propia (no usa window.confirm). Resuelve true/false. */
function confirmar(titulo, mensaje, { ok = 'Confirmar', peligro = false } = {}) {
  return new Promise((resolve) => {
    let m
    const fin = (v) => { resolve(v); m.close() }
    m = modal(titulo, h('p', mensaje), [
      h('button.btn.ghost', { type: 'button', onclick: () => fin(false) }, 'Volver'),
      h('button.btn', { type: 'button', class: peligro ? 'danger' : 'primary', onclick: () => fin(true) }, ok),
    ])
    m.dlg.addEventListener('close', () => resolve(false), { once: true })
  })
}

/** Ejecuta una acción async deshabilitando el botón y mostrando errores como toast. */
async function accion(btn, fn) {
  if (btn) btn.disabled = true
  try { return await fn() } catch (e) { toast(e.message, 'bad'); return undefined } finally { if (btn) btn.disabled = false }
}

// ── carta ──
const MAX_LINEAS = 15 // la API acepta hasta 15 productos distintos por pedido

/** Agrupa la carta por sección: "Botellas · Tequila" → Map { 'Botellas' → Map { 'Tequila' → [productos] } }. */
function agruparCarta(menu) {
  const out = new Map()
  for (const p of menu) {
    const [grupo, sub = ''] = (p.seccion || 'Otros').split(' · ')
    if (!out.has(grupo)) out.set(grupo, new Map())
    const g = out.get(grupo)
    if (!g.has(sub)) g.set(sub, [])
    g.get(sub).push(p)
  }
  return out
}
const lineasPaquete = (p) => (p.descripcion || '').split('\n').filter(Boolean)
const mas18 = () => h('span.badge.mas18', { title: 'Venta solo a mayores de edad' }, '+18')

/**
 * Selector de productos con cantidades, agrupado por sección (desplegables).
 * opts.tipoSalaId: resalta y abre primero los paquetes pensados para ese tipo de sala (se puede cambiar con recomendar()).
 * Devuelve { el, items(), total(), reset(), recomendar(tipoSalaId) }.
 */
function selectorMenu(menu, onChange = () => {}, opts = {}) {
  const cant = new Map()
  const contadores = new Map()
  const el = h('div.selector')
  const resumenes = []
  const tipos = new Map((opts.tipos || []).map((t) => [t.id, t.nombre]))

  const set = (p, v) => {
    v = Math.max(0, Math.min(20, v))
    if (v && !cant.has(p.id) && cant.size >= MAX_LINEAS) return toast(`Máximo ${MAX_LINEAS} productos distintos por pedido`, 'bad')
    v ? cant.set(p.id, v) : cant.delete(p.id)
    contadores.get(p.id).textContent = v
    contadores.get(p.id).closest('.menu-item').classList.toggle('elegido', v > 0)
    resumenes.forEach((f) => f())
    onChange()
  }
  const fila = (p) => {
    const n = h('span', '0')
    contadores.set(p.id, n)
    return h('div.menu-item', { dataset: { tipo: p.tipoSalaId || '' } },
      h('div',
        h('div', p.nombre, ' ', p.alcohol ? mas18() : null),
        p.categoria === 'PAQUETE' ? h('div.muted.small', lineasPaquete(p).join(' · ')) : null,
        h('div.small', { style: 'color:var(--gold)' }, money(p.precio))),
      h('div.qty',
        h('button', { type: 'button', 'aria-label': `Quitar ${p.nombre}`, onclick: () => set(p, (cant.get(p.id) || 0) - 1) }, '−'),
        n,
        h('button', { type: 'button', 'aria-label': `Agregar ${p.nombre}`, onclick: () => set(p, (cant.get(p.id) || 0) + 1) }, '+')))
  }

  let paquetes = null
  for (const [grupo, subs] of agruparCarta(menu)) {
    const ids = [...subs.values()].flat().map((p) => p.id)
    const cuenta = h('span.badge.accent', { hidden: true })
    resumenes.push(() => {
      const n = ids.reduce((a, id) => a + (cant.get(id) || 0), 0)
      cuenta.hidden = !n
      cuenta.textContent = `${n} elegido${n === 1 ? '' : 's'}`
    })
    const det = h('details.grupo-carta', h('summary', h('span', grupo), cuenta))
    for (const [sub, prods] of subs) {
      if (sub) det.append(h('div.sub-carta', sub))
      const lista = h('div.lista-carta', prods.map(fila))
      det.append(lista)
      if (grupo === 'Paquetes') paquetes = { det, lista }
    }
    el.append(det)
  }

  /** Pone primero (y marca) los paquetes del tipo de sala elegido. */
  const recomendar = (tipoSalaId) => {
    if (!paquetes) return
    paquetes.det.open = !!tipoSalaId
    for (const it of paquetes.lista.children) {
      const mio = tipoSalaId && Number(it.dataset.tipo) === tipoSalaId
      it.classList.toggle('recomendado', !!mio)
      it.style.order = mio ? -1 : 0
      const tag = it.querySelector('.tag-sala')
      if (tag) tag.remove()
      if (it.dataset.tipo && tipos.size) it.firstChild.firstChild.append(h('span.badge.tag-sala', { class: mio ? 'ok' : '' }, mio ? 'Para tu sala' : `Sala ${tipos.get(Number(it.dataset.tipo)) || ''}`))
    }
  }
  recomendar(opts.tipoSalaId)

  return {
    el, recomendar,
    items: () => [...cant].map(([productoId, cantidad]) => ({ productoId, cantidad })),
    total: () => [...cant].reduce((a, [id, c]) => a + Number(menu.find((p) => p.id === id).precio) * c, 0),
    reset: () => {
      cant.clear()
      contadores.forEach((s) => { s.textContent = '0'; s.closest('.menu-item').classList.remove('elegido') })
      resumenes.forEach((f) => f())
      onChange()
    },
  }
}
