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

## Ramas
- `main` = producción · `dev` = desarrollo e integración. Los cambios entran a `dev` y pasan a `main` por Pull Request con el CI en verde.
