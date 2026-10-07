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

/** Selector de productos del menú con cantidades. Devuelve { el, items(), total(), reset() }. */
function selectorMenu(menu, onChange = () => {}) {
  const cant = new Map()
  const el = h('div')
  const grupos = [['ALIMENTO', 'Alimentos'], ['BEBIDA', 'Bebidas']]
  for (const [cat, titulo] of grupos) {
    const prods = menu.filter((p) => p.categoria === cat)
    if (!prods.length) continue
    el.append(h('h3', { style: 'margin-top:12px' }, titulo))
    for (const p of prods) {
      const n = h('span', '0')
      const set = (v) => { v = Math.max(0, Math.min(20, v)); v ? cant.set(p.id, v) : cant.delete(p.id); n.textContent = v; onChange() }
      el.append(h('div.menu-item',
        h('div', h('div', p.nombre), h('div.muted.small', money(p.precio))),
        h('div.qty',
          h('button', { type: 'button', 'aria-label': `Quitar ${p.nombre}`, onclick: () => set((cant.get(p.id) || 0) - 1) }, '−'),
          n,
          h('button', { type: 'button', 'aria-label': `Agregar ${p.nombre}`, onclick: () => set((cant.get(p.id) || 0) + 1) }, '+')),
      ))
    }
  }
  return {
    el,
    items: () => [...cant].map(([productoId, cantidad]) => ({ productoId, cantidad })),
    total: () => [...cant].reduce((a, [id, c]) => a + Number(menu.find((p) => p.id === id).precio) * c, 0),
    reset: () => { cant.clear(); $$('.qty span', el).forEach((s) => (s.textContent = '0')); onChange() },
  }
}
