<!-- Cielo estrellado con estrellas fugaces, detrás de todo el contenido. -->
<script lang="ts">
  import { calma } from '#lib/fx/efectos.ts'

  let lienzo: HTMLCanvasElement

  $effect(() => {
    const c = lienzo
    const ctx = c.getContext('2d')!
    let W = 0, H = 0, dpr = 1, raf = 0
    let estrellas: { x: number; y: number; r: number; fase: number; vel: number; prof: number }[] = []
    let fugaz: { x: number; y: number; vida: number } | null = null

    const medir = () => {
      dpr = Math.min(devicePixelRatio || 1, 2)
      W = c.width = innerWidth * dpr
      H = c.height = innerHeight * dpr
      estrellas = Array.from({ length: Math.round((innerWidth * innerHeight) / 8000) }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.1 + 0.3) * dpr,
        fase: Math.random() * 6.28, vel: Math.random() * 0.0015 + 0.0004, prof: Math.random() * 0.5 + 0.2,
      }))
    }
    const pintar = (t: number) => {
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
    const alCambiar = () => { medir(); if (calma) pintar(0) }
    medir()
    addEventListener('resize', alCambiar)
    if (calma) pintar(0)
    else {
      const loop = (t: number) => { if (!document.hidden) pintar(t); raf = requestAnimationFrame(loop) }
      raf = requestAnimationFrame(loop)
    }
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', alCambiar) }
  })
</script>

<canvas bind:this={lienzo} class="cielo" aria-hidden="true"></canvas>
