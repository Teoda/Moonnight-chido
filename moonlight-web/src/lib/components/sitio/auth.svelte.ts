// Abre el diálogo de "Tu cuenta" desde cualquier parte del sitio y, al iniciar sesión, continúa
// con lo que el cliente estaba haciendo (p. ej. reservar).
export const auth = $state<{ abierto: boolean; aviso: string; despues: (() => void) | null }>({
  abierto: false, aviso: '', despues: null,
})

export function pedirSesion(despues?: () => void, aviso = '') {
  auth.despues = despues ?? null
  auth.aviso = aviso
  auth.abierto = true
}
