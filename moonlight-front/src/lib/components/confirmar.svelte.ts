// Confirmación propia (no usa window.confirm): `if (await confirmar(...))`. La muestra <Confirmacion />.
interface Pregunta { titulo: string; mensaje: string; ok: string; peligro: boolean; responder: (v: boolean) => void }

export const pregunta = $state<{ actual: Pregunta | null }>({ actual: null })

export function confirmar(titulo: string, mensaje: string, { ok = 'Confirmar', peligro = false } = {}): Promise<boolean> {
  pregunta.actual?.responder(false)
  return new Promise((resolve) => {
    pregunta.actual = { titulo, mensaje, ok, peligro, responder: (v) => { pregunta.actual = null; resolve(v) } }
  })
}
