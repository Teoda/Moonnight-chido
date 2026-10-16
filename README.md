# Moonlight · Karaoke & Social Lounge

Sistema de reservaciones de salas de karaoke: sitio para clientes, panel del personal y API.

| Carpeta | Qué es | Puerto local |
|---|---|---|
| [`moonlight-front/`](moonlight-front/) | **Front:** SvelteKit + TypeScript + Tailwind CSS + Redux Toolkit + axios. Sitio de clientes y panel del personal; reenvía `/api` al back. Ver su [README](moonlight-front/README.md) y [TRABAJO-REALIZADO.md](moonlight-front/TRABAJO-REALIZADO.md). | **3000** |
| [`moonlight-db/`](moonlight-db/) | **Back:** Express + Prisma + MySQL (API, reglas de negocio, base de datos). Ver su [README](moonlight-db/README.md) y [SEGURIDAD.md](moonlight-db/SEGURIDAD.md). | 4000 |

## Arranque rápido
Con **Docker Desktop** abierto:
```bash
# 1) Back (terminal 1)
cd moonlight-db
npm install
copy .env.example .env        # en Linux/Mac: cp .env.example .env
npm run db:up                 # MySQL en Docker
npx prisma migrate deploy     # crea / actualiza las tablas
npm run db:seed               # datos iniciales
npm run personal:crear        # personal con llave de 8 dígitos (las muestra una sola vez)
npm run dev                   # API en http://localhost:4000

# 2) Front (terminal 2)
cd moonlight-front
npm install
copy .env.example .env        # API_URL=http://localhost:4000
npm run dev                   # http://localhost:3000
```
- Sitio de clientes: http://localhost:3000/ · Panel del personal: http://localhost:3000/staff
- El navegador solo usa el puerto 3000: el front reenvía `/api/*` al back (4000), así las cookies de sesión y el CSRF funcionan sin CORS.

## Despliegue en Vercel
Un solo proyecto con dos servicios ([`vercel.json`](vercel.json)), en un mismo dominio:
- `/api/*` → **moonlight-db** (Express como función). Recibe directo al visitante, así ve su IP real (límites de peticiones y bloqueo de intentos).
- todo lo demás → **moonlight-front** (SvelteKit).

En Vercel (Settings): **Root Directory vacío** (la raíz del repo, donde está `vercel.json`) y Node.js 22.x.

**Variables de entorno** (Settings → Environment Variables):
| Variable | Valor |
|---|---|
| `DATABASE_URL` | MySQL en internet, p. ej. `mysql://usuario:clave@host:puerto/moonlight?sslaccept=strict&connection_limit=1` |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | 48+ bytes aleatorios: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ALLOWED_ORIGINS` | la dirección del sitio, p. ej. `https://moonnight-chido.vercel.app` |
| `TRUST_PROXY` | `1` |
| `PAGOS_SIMULADOS` | `true` (mientras no haya pasarela de pagos real) |

**Base de datos:** Vercel no aloja MySQL. Crea una base MySQL en internet (p. ej. Aiven, TiDB Cloud o Railway) y, una sola vez,
desde tu computadora con `DATABASE_URL` apuntando a ella:
```bash
cd moonlight-db
npx prisma migrate deploy     # crea las tablas
npm run db:seed               # datos iniciales
npm run personal:crear        # personal con llave de 8 dígitos (las muestra una sola vez)
```
En Vercel el mantenimiento de cada minuto (liberar reservas sin pagar, no-shows) corre con las propias peticiones.

## Ramas
- `main` = producción · `dev` = desarrollo e integración. Los cambios entran a `dev` y pasan a `main` por Pull Request con el CI en verde.
