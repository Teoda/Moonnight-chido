# Moonlight · Front (SvelteKit)

Sitio de clientes y panel del personal de Moonlight Karaoke & Social Lounge.

**Stack:** SvelteKit 3 (Svelte 5) · TypeScript · Tailwind CSS v4 · Redux Toolkit · axios · adapter-node.

## Cómo funciona con el back
- El servidor de SvelteKit sirve la app y **reenvía `/api/*` al back de Express** (`moonlight-db`), definido en `API_URL`
  (ver [`src/hooks.server.ts`](src/hooks.server.ts)). Para el navegador todo vive en un mismo origen: las cookies `HttpOnly`
  de sesión y el token CSRF funcionan sin abrir CORS.
- El back debe aceptar el origen de este sitio en `ALLOWED_ORIGINS` (p. ej. `http://localhost:5173`).
- La app se renderiza en el navegador (`ssr = false` en [`src/routes/+layout.ts`](src/routes/+layout.ts)): el store de Redux
  vive en cada navegador y nunca se comparte entre usuarios en el servidor.

## Variables de entorno (`.env`)
El host del back se define en `moonlight-web/.env` (cópialo de `.env.example`; no se sube a git):
```env
API_URL=http://localhost:3000
```
Se declara y valida en [`src/env.ts`](src/env.ts) y el proxy la lee con `import { API_URL } from '$app/env/private'`.
En desarrollo SvelteKit lee el `.env` solo; en producción `npm start` también lo carga.

## Desarrollo
Primero levanta el back (`cd ../moonlight-db && npm run db:up && npm run dev`). Luego:
```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # verificación de tipos (svelte-check + TypeScript)
```
Si el back corre en otro host o puerto, cambia `API_URL` en el `.env`.

## Producción
```bash
cp .env.example .env   # ajusta API_URL, ORIGIN y PORT
npm run build
npm start              # node build (adapter-node)
```
- `ORIGIN` debe ser la dirección pública del sitio, y esa misma dirección va en `ALLOWED_ORIGINS` del back.
- Si hay un proxy delante (Nginx, Caddy, hosting), configura `ADDRESS_HEADER`/`XFF_DEPTH`/`PROTOCOL_HEADER` aquí
  y `TRUST_PROXY` en el back (cuenta también este servidor de SvelteKit como un proxy).

## Estructura
| Ruta | Qué es |
|---|---|
| `src/routes/(sitio)/` | Sitio de clientes: inicio, salas, carta, reservar, mis reservaciones |
| `src/routes/staff/` | Panel del personal: recepción, agenda, barra, salas, limpieza, finanzas (según el rol) |
| `src/lib/api/` | Cliente axios (sesiones de cliente y personal con su token CSRF) y tipos de la API |
| `src/lib/store/` | Redux Toolkit: catálogo, sesión, asistente de reserva, mis reservaciones, avisos. `seleccionar()` lo conecta con Svelte |
| `src/lib/components/` | Componentes (diálogos, selector de productos, pago con tarjeta, estado de cuenta…) |
| `src/lib/fx/` | Efectos: cielo estrellado, aparición, inclinación 3D, ondas, contadores, confeti, aviso sonoro |
| `src/lib/utils/` | Formato (MXN, horas de México), estados, carta, validación de tarjetas |

> SvelteKit 3: la configuración de Kit vive en `vite.config.ts` (ya no hay `svelte.config.js`) y `$lib` se reemplazó por
> *subpath imports*: `import x from '#lib/...'` (definido en `package.json` → `imports`).
