// Aviso sonoro corto (dos tonos). Los navegadores solo permiten audio después de que el usuario
// interactúa con la página; si aún no lo hizo, simplemente no suena.
let audio: AudioContext | undefined

export function ding() {
  try {
    audio ??= new AudioContext()
    const t = audio.currentTime
    for (const [f, d] of [[880, 0], [1320, 0.12]]) {
      const o = audio.createOscillator(), g = audio.createGain()
      o.frequency.value = f; o.type = 'sine'
      g.gain.setValueAtTime(0.0001, t + d)
      g.gain.exponentialRampToValueAtTime(0.2, t + d + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35)
      o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + 0.4)
    }
  } catch { /* sin audio: no pasa nada */ }
}
