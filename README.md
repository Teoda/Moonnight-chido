# Moonlight · Karaoke & Social Lounge

Sistema de reservaciones de salas de karaoke: sitio para clientes, panel del personal y API.

| Carpeta | Qué es |
|---|---|
| [`moonlight-db/`](moonlight-db/) | Backend: Express + Prisma + MySQL (API, reglas de negocio, base de datos). Ver su [README](moonlight-db/README.md) y [SEGURIDAD.md](moonlight-db/SEGURIDAD.md). |
| [`moonlight-web/`](moonlight-web/) | **Frontend nuevo:** SvelteKit + TypeScript + Tailwind + Redux Toolkit + axios. Servidor propio que reenvía `/api` al back. Ver su [README](moonlight-web/README.md). |
| [`moonlight-front/`](moonlight-front/) | Frontend anterior (HTML/CSS/JS sin build), servido por el back. Se conserva hasta validar el nuevo. |

## Arranque rápido
```bash
# 1) Back
cd moonlight-db
npm install
copy .env.example .env        # en Linux/Mac: cp .env.example .env
npm run db:up                 # MySQL en Docker
npx prisma migrate deploy     # crea / actualiza las tablas
npm run db:seed               # datos iniciales y usuarios de prueba
npm run dev                   # API en http://localhost:3000

# 2) Front nuevo (otra terminal)
cd moonlight-web
npm install
npm run dev                   # http://localhost:5173
```
- Sitio de clientes: http://localhost:5173/ · Panel del personal: http://localhost:5173/staff
- Front anterior (mientras exista): http://localhost:3000/ y http://localhost:3000/staff.html

## Despliegue en Vercel
Un solo proyecto con dos servicios ([`vercel.json`](vercel.json)), en un mismo dominio:
- `/api/*` → **moonlight-db** (Express como función). Recibe directo al visitante, así ve su IP real (límites de peticiones y bloqueo de intentos).
- todo lo demás → **moonlight-web** (SvelteKit).

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
npm run db:seed               # datos iniciales (en producción exige SEED_PASSWORD propio)
```
En Vercel el mantenimiento de cada minuto (liberar reservas sin pagar, no-shows) corre con las propias peticiones.

## Ramas
- `main` = producción · `dev` = desarrollo e integración. Los cambios entran a `dev` y pasan a `main` por Pull Request con el CI en verde.
