// El servidor de SvelteKit sirve la app y reenvía /api/* al back de Express (moonlight-db).
// Para el navegador todo vive en un mismo origen: las cookies HttpOnly de sesión (SameSite=Strict)
// y el token CSRF funcionan igual que antes, sin abrir CORS.
import type { RequestEvent } from '@sveltejs/kit'
import type { Handle } from '@sveltejs/kit/hooks'
import { API_URL } from '$app/env/private' // host del back, del archivo .env (ver src/env.ts)

// Encabezados "hop-by-hop": son de esta conexión y no deben reenviarse.
const HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']

async function proxy(event: RequestEvent): Promise<Response> {
  const { request, url } = event
  const destino = API_URL + url.pathname + url.search
  const headers = new Headers(request.headers)
  for (const h of HOP) headers.delete(h)
  // Si el back está detrás de ngrok (plan gratuito), evita su página de advertencia "You are about to visit…",
  // que aparece cuando la petición trae el User-Agent de un navegador. En otros hosts se ignora.
  headers.set('ngrok-skip-browser-warning', 'true')
  // El back usa estos datos para el límite de peticiones por IP y para saber si la conexión fue HTTPS
  // (en producción configura TRUST_PROXY en moonlight-db según cuántos proxies haya delante).
  headers.set('x-forwarded-for', event.getClientAddress())
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''))
  headers.set('x-forwarded-host', url.host)

  let res: Response
  try {
    res = await fetch(destino, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
    })
  } catch {
    return Response.json({ error: 'El servidor de la API no responde' }, { status: 502 })
  }

  const salida = new Headers(res.headers)
  // fetch ya descomprimió el cuerpo: estos encabezados describirían otra cosa
  for (const h of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) salida.delete(h)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: salida })
}

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname === '/api' || event.url.pathname.startsWith('/api/')) return proxy(event)

  const res = await resolve(event)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (event.url.protocol === 'https:') res.headers.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  return res
}
