// Cliente HTTP (axios). Las rutas son relativas a /api: el servidor de SvelteKit las reenvía al back.
// La sesión viaja en cookies HttpOnly (el navegador las manda solo); aquí solo se maneja el token CSRF.
// Hay dos sesiones independientes, cada una con su token: la del cliente (/cliente/*) y la del personal
// (/auth/* y /staff/*). Por eso iniciar sesión en el sitio no cierra el panel, y viceversa.
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

export type Ambito = 'cliente' | 'staff'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const csrf: Record<Ambito, string | null> = { cliente: null, staff: null }
const ME: Record<Ambito, string> = { cliente: '/cliente/me', staff: '/auth/me' }
const alExpirar: Partial<Record<Ambito, () => void>> = {}

/** Qué sesión usa una ruta (las públicas no usan ninguna). */
export const ambitoDe = (url = ''): Ambito | null =>
  url.startsWith('/cliente') ? 'cliente' : url.startsWith('/auth') || url.startsWith('/staff') ? 'staff' : null

export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
  timeout: 20_000,
})

type ConReintento = InternalAxiosRequestConfig & { _reintento?: boolean }

http.interceptors.request.use((cfg) => {
  const amb = ambitoDe(cfg.url)
  const metodo = (cfg.method || 'get').toUpperCase()
  if (amb && metodo !== 'GET' && csrf[amb]) cfg.headers.set('X-CSRF-Token', csrf[amb])
  return cfg
})

http.interceptors.response.use(
  (res) => {
    // Cada login / "me" trae el token CSRF de su sesión
    const amb = ambitoDe(res.config.url)
    if (amb && res.data && typeof res.data === 'object' && 'csrfToken' in res.data) csrf[amb] = res.data.csrfToken
    return res
  },
  async (err: AxiosError<{ error?: string; detalles?: { mensaje: string }[] }>) => {
    const cfg = err.config as ConReintento | undefined
    const status = err.response?.status ?? 0
    const data = err.response?.data
    const amb = ambitoDe(cfg?.url)
    // Token CSRF viejo (p. ej. el servidor se reinició) con la sesión aún válida: pide uno nuevo y reintenta una vez
    if (cfg && amb && status === 403 && data?.error === 'Token CSRF inválido' && !cfg._reintento) {
      cfg._reintento = true
      try {
        await http.get(ME[amb])
        return http.request(cfg)
      } catch { /* sigue al error de abajo */ }
    }
    if (status === 401 && amb && cfg?.url !== ME[amb]) alExpirar[amb]?.()
    if (!err.response) throw new ApiError(0, err.code === 'ECONNABORTED' ? 'El servidor tardó demasiado en responder' : 'Sin conexión con el servidor')
    const detalle = data?.detalles?.map((d) => d.mensaje).join(' · ')
    throw new ApiError(status, detalle ? `${data?.error}: ${detalle}` : data?.error || `Error ${status}`)
  },
)

/** Qué hacer cuando la API dice que la sesión ya no es válida (p. ej. se cerró por inactividad). */
export function alExpirarSesion(amb: Ambito, fn: () => void) { alExpirar[amb] = fn }
export function olvidarCsrf(amb: Ambito) { csrf[amb] = null }

export const api = {
  get: <T>(url: string, cfg?: AxiosRequestConfig) => http.get<T>(url, cfg).then((r) => r.data),
  post: <T>(url: string, body: unknown = {}) => http.post<T>(url, body).then((r) => r.data),
  patch: <T>(url: string, body: unknown = {}) => http.patch<T>(url, body).then((r) => r.data),
  delete: <T>(url: string) => http.delete<T>(url).then((r) => r.data),
}

/** Consulta sin disparar el aviso de sesión vencida (para saber si hay sesión abierta al cargar). */
export async function sesionDe<T>(amb: Ambito): Promise<T | null> {
  try { return await api.get<T>(ME[amb]) } catch { return null }
}
