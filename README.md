# Moonlight · Karaoke & Social Lounge

Sistema de reservaciones de salas de karaoke: sitio para clientes, panel del personal y API.

| Carpeta | Qué es |
|---|---|
| [`moonlight-db/`](moonlight-db/) | Backend: Express + Prisma + MySQL (API, reglas de negocio, base de datos). Ver su [README](moonlight-db/README.md) y [SEGURIDAD.md](moonlight-db/SEGURIDAD.md). |
| [`moonlight-front/`](moonlight-front/) | Frontend: HTML/CSS/JS sin dependencias ni build. Lo sirve el backend en el mismo origen. |

## Arranque rápido
```bash
cd moonlight-db
npm install
copy .env.example .env        # en Linux/Mac: cp .env.example .env
npm run db:up                 # MySQL en Docker
npx prisma migrate dev        # crea las tablas
npm run db:seed               # datos iniciales y usuarios de prueba
npm run dev                   # http://localhost:3000
```
- Sitio de clientes: http://localhost:3000/
- Panel del personal: http://localhost:3000/staff.html

## Ramas
- `main` = producción · `dev` = desarrollo e integración. Los cambios entran a `dev` y pasan a `main` por Pull Request con el CI en verde.
