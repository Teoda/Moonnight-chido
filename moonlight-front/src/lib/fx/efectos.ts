// Efectos de interfaz como acciones de Svelte (use:accion). Si el sistema pide menos movimiento
// (prefers-reduced-motion) se muestran sin animar.
import type { Action } from 'svelte/action'
import { readable } from 'svelte/store'
import { money } from '../utils/formato.ts'

export const calma = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Reloj compartido: un solo intervalo de 1 s para todas las cuentas regresivas de la página. */
export const ahora = readable(Date.now(), (set) => {
  const id = setInterval(() => set(Date.now()), 1000)
  return () => clearInterval(id)
})

// ── aparición escalonada al entrar en pantalla ──
const io = typeof IntersectionObserver === 'undefined' || calma ? null : new IntersectionObserver((entradas) => {
  for (const e of entradas) {
    if (!e.isIntersecting) continue
    const el = e.target as HTMLElement
    io!.unobserve(el)
    el.classList.add('in')
    // al terminar se quitan las clases para que hover/inclinación no hereden el retraso
    setTimeout(() => el.classList.remove('reveal', 'in'), 650 + parseInt(el.style.getPropertyValue('--d') || '0'))
  }
}, { threshold: 0.06 })

/** use:revelar o use:revelar={indice} (el índice escalona la animación). */
export const revelar: Action<HTMLElement, number | undefined> = (el, i) => {
  if (!io) return
  const idx = i ?? (el.parentElement ? [...el.parentElement.children].indexOf(el) : 0)
  el.style.setProperty('--d', `${Math.min(idx, 12) * 45}ms`)
  el.classList.add('reveal')
  io.observe(el)
  return { destroy: () => io.unobserve(el) }
}

/** Inclinación 3D con brillo que sigue al puntero. */
export const inclinar: Action<HTMLElement> = (el) => {
  if (calma) return
  el.classList.add('tilt')
  const mover = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    el.classList.add('tilting')
    el.style.transform = `perspective(800px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateY(-4px)`
    el.style.setProperty('--mx', `${(x + 0.5) * 100}%`)
    el.style.setProperty('--my', `${(y + 0.5) * 100}%`)
  }
  const soltar = () => { el.style.transform = ''; el.classList.remove('tilting') }
  el.addEventListener('pointermove', mover)
  el.addEventListener('pointerleave', soltar)
  return { destroy() { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerleave', soltar) } }
}

/** Onda al presionar cualquier .btn o .chip (un solo listener para toda la página). */
export function instalarOndas() {
  if (calma || typeof document === 'undefined') return () => {}
  const fn = (e: PointerEvent) => {
    const b = (e.target as HTMLElement).closest?.('.btn, .chip') as HTMLButtonElement | null
    if (!b || b.disabled) return
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2
    const o = document.createElement('span')
    o.className = 'onda'
    o.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`
    b.append(o)
    o.addEventListener('animationend', () => o.remove())
  }
  document.addEventListener('pointerdown', fn)
  return () => document.removeEventListener('pointerdown', fn)
}

/** Número que cuenta desde su valor anterior hasta el nuevo: use:contar={{ valor, formato }}. */
export const contar: Action<HTMLElement, { valor: number; formato?: (v: number) => string; dur?: number }> = (el, p) => {
  let actual = 0, raf = 0
  const ir = ({ valor, formato = money, dur = 700 }: { valor: number; formato?: (v: number) => string; dur?: number }) => {
    cancelAnimationFrame(raf)
    const desde = actual, hasta = Number(valor) || 0
    actual = hasta
    if (calma || desde === hasta) { el.textContent = formato(hasta); return }
    const t0 = performance.now()
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3)
      el.textContent = formato(desde + (hasta - desde) * e)
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
  }
  ir(p)
  return { update: ir, destroy: () => cancelAnimationFrame(raf) }
}

/** Confeti dentro del contenedor dado (en un <dialog> queda encima del fondo). */
export function confeti(contenedor: HTMLElement = document.body) {
  if (calma) return
  const c = document.createElement('canvas')
  c.className = 'confeti'
  c.setAttribute('aria-hidden', 'true')
  contenedor.append(c)
  const ctx = c.getContext('2d')!
  c.width = innerWidth; c.height = innerHeight
  const colores = ['#b89cff', '#ff7ac6', '#ffd479', '#6cb6ff', '#4fd1a5']
  const ps = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 4, g: 0.35 + Math.random() * 0.15,
    w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    color: colores[Math.floor(Math.random() * colores.length)],
  }))
  const t0 = performance.now()
  const paso = (t: number) => {
    ctx.clearRect(0, 0, c.width, c.height)
    for (const p of ps) {
      p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore()
    }
    if (t - t0 < 3200 && c.isConnected) requestAnimationFrame(paso)
    else c.remove()
  }
  requestAnimationFrame(paso)
}

/** true si `datos` cambió desde la última consulta con esa clave (para refrescos silenciosos). */
const previos = new Map<string, string>()
export function cambio(clave: string, datos: unknown) {
  const s = JSON.stringify(datos)
  if (previos.get(clave) === s) return false
  previos.set(clave, s)
  return true
}
