// Efectos y tiempo real: cielo estrellado, aparición al hacer scroll, inclinación 3D, ondas en botones,
// contadores animados, cuentas regresivas, confeti y aviso sonoro. Si el sistema pide menos movimiento
// (prefers-reduced-motion) todo se muestra sin animar.
'use strict'

const fx = (() => {
  const calma = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ── cielo estrellado con estrellas fugaces (canvas detrás del contenido) ──
  function cielo() {
    const c = h('canvas.cielo', { 'aria-hidden': 'true' })
    document.body.prepend(c)
    const ctx = c.getContext('2d')
    let W, H, dpr, estrellas = [], fugaz = null
    const medir = () => {
      dpr = Math.min(devicePixelRatio || 1, 2)
      W = c.width = innerWidth * dpr
      H = c.height = innerHeight * dpr
      estrellas = Array.from({ length: Math.round((innerWidth * innerHeight) / 8000) }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.1 + 0.3) * dpr,
        fase: Math.random() * 6.28, vel: Math.random() * 0.0015 + 0.0004, prof: Math.random() * 0.5 + 0.2,
      }))
    }
    const pintar = (t) => {
      ctx.clearRect(0, 0, W, H)
      const scroll = scrollY * dpr
      ctx.fillStyle = '#fff'
      for (const s of estrellas) {
        ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(s.fase + t * s.vel))
        const y = (((s.y - scroll * s.prof * 0.3) % H) + H) % H // parallax suave al hacer scroll
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.283); ctx.fill()
      }
      if (!fugaz && Math.random() < 0.003) fugaz = { x: Math.random() * W * 0.6, y: Math.random() * H * 0.35, vida: 1 }
      if (fugaz) {
        const { x, y } = fugaz, cola = 140 * dpr
        const g = ctx.createLinearGradient(x, y, x - cola, y - cola * 0.42)
        g.addColorStop(0, `rgba(255,240,200,${fugaz.vida})`); g.addColorStop(1, 'rgba(255,240,200,0)')
        ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 2 * dpr
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - cola, y - cola * 0.42); ctx.stroke()
        fugaz.x += 14 * dpr; fugaz.y += 6 * dpr; fugaz.vida -= 0.018
        if (fugaz.vida <= 0) fugaz = null
      }
      ctx.globalAlpha = 1
    }
    medir()
    addEventListener('resize', () => { medir(); if (calma) pintar(0) })
    if (calma) return pintar(0)
    const loop = (t) => { if (!document.hidden) pintar(t); requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
  }

  // ── aparición escalonada de tarjetas y chips al entrar en pantalla ──
  const SEL = '.card, .chip, .sala-tile, .menu-item, .reveal-me'
  const io = calma ? null : new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue
      const el = e.target
      io.unobserve(el)
      el.classList.add('in')
      // al terminar quitamos la clase para que hover/inclinación no hereden el retraso
      setTimeout(() => el.classList.remove('reveal', 'in'), 650 + parseInt(el.style.getPropertyValue('--d') || 0))
    }
  }, { threshold: 0.06 })

  function revelar(el) {
    if (!io || el.classList.contains('reveal') || el.closest('dialog, [data-static]')) return
    const i = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0
    el.style.setProperty('--d', `${Math.min(i, 12) * 45}ms`)
    el.classList.add('reveal')
    io.observe(el)
  }
  function auto(root) {
    if (!io) return
    root.querySelectorAll(SEL).forEach(revelar)
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue
        if (n.matches(SEL)) revelar(n)
        n.querySelectorAll(SEL).forEach(revelar)
      }
    }).observe(root, { childList: true, subtree: true })
  }

  // ── inclinación 3D con brillo que sigue al puntero (.tilt) ──
  let actual = null
  const soltar = (el) => { el.style.transform = ''; el.classList.remove('tilting') }
  if (!calma) {
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return
      const el = e.target.closest?.('.tilt')
      if (actual && actual !== el) soltar(actual)
      actual = el
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
      el.classList.add('tilting')
      el.style.transform = `perspective(800px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateY(-4px)`
      el.style.setProperty('--mx', `${(x + 0.5) * 100}%`)
      el.style.setProperty('--my', `${(y + 0.5) * 100}%`)
    })
    document.addEventListener('pointerleave', () => actual && soltar(actual))
  }

  // ── onda al presionar botones ──
  if (!calma) {
    document.addEventListener('pointerdown', (e) => {
      const b = e.target.closest?.('.btn, .chip')
      if (!b || b.disabled) return
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2
      const o = h('span.onda', { style: `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px` })
      b.append(o)
      o.addEventListener('animationend', () => o.remove())
    })
  }

  // ── números que cuentan hasta su valor ──
  function contar(el, hasta, formato = money, desde = 0, dur = 700) {
    hasta = Number(hasta) || 0
    if (calma || desde === hasta) { el.textContent = formato(hasta); return }
    const t0 = performance.now()
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3)
      el.textContent = formato(desde + (hasta - desde) * e)
      if (k < 1 && el.isConnected) requestAnimationFrame(paso)
    }
    requestAnimationFrame(paso)
  }

  // ── texto que se escribe y borra (palabras rotando) ──
  function rotar(el, palabras) {
    if (!palabras.length) return
    let i = 0
    if (calma) { el.textContent = palabras[0]; return setInterval(() => (el.textContent = palabras[++i % palabras.length]), 2500) }
    let txt = '', borrando = false
    const tick = () => {
      const meta = palabras[i % palabras.length]
      txt = borrando ? meta.slice(0, txt.length - 1) : meta.slice(0, txt.length + 1)
      el.textContent = txt
      let espera = borrando ? 45 : 95
      if (!borrando && txt === meta) { borrando = true; espera = 1700 }
      else if (borrando && !txt) { borrando = false; i++; espera = 300 }
      setTimeout(tick, espera)
    }
    tick()
  }

  // ── actualiza un elemento cada `ms` mientras siga en la página ──
  function tic(el, fn, ms = 1000) {
    fn()
    const id = setInterval(() => (el.isConnected ? fn() : clearInterval(id)), ms)
    return id
  }
  /** "1 d 4 h", "2 h 05 min", "12:09" (mm:ss si falta menos de una hora). */
  function falta(msRestantes) {
    const s = Math.max(0, Math.floor(msRestantes / 1000))
    const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60
    if (d) return `${d} d ${hh} h`
    if (hh) return `${hh} h ${String(mm).padStart(2, '0')} min`
    return `${mm}:${String(ss).padStart(2, '0')}`
  }

  // ── confeti (se dibuja dentro del contenedor dado; en un <dialog> queda encima del fondo) ──
  function confeti(contenedor = document.body) {
    if (calma) return
    const c = h('canvas.confeti', { 'aria-hidden': 'true' })
    contenedor.append(c)
    const ctx = c.getContext('2d')
    c.width = innerWidth; c.height = innerHeight
    const colores = ['#b89cff', '#ff7ac6', '#ffd479', '#6cb6ff', '#4fd1a5']
    const ps = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 4, g: 0.35 + Math.random() * 0.15,
      w: 6 + Math.random() * 6, hgt: 4 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      color: colores[Math.floor(Math.random() * colores.length)],
    }))
    const t0 = performance.now()
    const paso = (t) => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const p of ps) {
        p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.hgt / 2, p.w, p.hgt); ctx.restore()
      }
      if (t - t0 < 3200 && c.isConnected) requestAnimationFrame(paso)
      else c.remove()
    }
    requestAnimationFrame(paso)
  }

  // ── aviso sonoro corto (dos tonos) ──
  let audio
  function ding() {
    try {
      audio ??= new AudioContext()
      const t = audio.currentTime
      for (const [f, d] of [[880, 0], [1320, 0.12]]) {
        const o = audio.createOscillator(), g = audio.createGain()
        o.frequency.value = f; o.type = 'sine'
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.2, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35)
        o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + 0.4)
      }
    } catch { /* sin audio: no pasa nada */ }
  }

  /** Barra de progreso de una visita en curso. Devuelve el elemento; se actualiza solo. */
  function progreso(inicio, fin, etiqueta) {
    const barra = h('div.prog-fill')
    const el = h('div.prog', barra)
    const a = new Date(inicio).getTime(), b = new Date(fin).getTime()
    tic(el, () => {
      const k = Math.min(1, Math.max(0, (Date.now() - a) / (b - a)))
      barra.style.width = `${(k * 100).toFixed(1)}%`
      el.classList.toggle('casi', b - Date.now() < 10 * 60_000)
      if (etiqueta) etiqueta.textContent = Date.now() >= b ? 'Tiempo terminado' : `Quedan ${falta(b - Date.now())}`
    }, 1000)
    return el
  }

  return { calma, cielo, auto, contar, rotar, tic, falta, confeti, ding, progreso }
})()

/** true si `datos` cambió desde la última vez que se consultó con esa clave (para refrescos silenciosos). */
const cambio = (() => {
  const prev = new Map()
  return (clave, datos) => {
    const s = JSON.stringify(datos)
    if (prev.get(clave) === s) return false
    prev.set(clave, s)
    return true
  }
})()
