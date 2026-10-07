# Moonlight · Backend (Express + Prisma + MySQL)

## Arranque local
1. `npm install`
2. Copia `.env.example` a `.env` (en Windows: `copy .env.example .env`)
3. `npm run db:up`                          (MySQL en Docker, puerto 3307)
4. `npx prisma migrate dev --name inicial`  (crea las tablas)
5. `npm run db:seed`                        (salas, menú, promos, horario, configuración, usuarios de prueba)
6. `npm run dev`                            (API en http://localhost:3000)

> Si ya habías hecho migraciones con la versión anterior del esquema: `npm run db:reset` (borra datos de prueba y recrea todo).

HeidiSQL → MySQL (TCP/IP) · 127.0.0.1 · puerto 3307 · moonlight / moonlight_pass · base moonlight
Usuarios de prueba (contraseña `Moonlight2026!`): admin@, recepcion@, barra@, operaciones@, limpieza@ moonlight.mx

## Reglas de negocio implementadas
- **Horario:** martes a sábado, 17:00 a 01:00 (tabla `horarios_operacion`). Los horarios de inicio van cada 30 min; duración de 1 a 4 h.
- **Limpieza:** cada reservación bloquea la sala 15 min después de terminar (`limpiezaMin`). Sala 18:00–19:00 → la siguiente puede iniciar a las 19:30 (rejilla de 30 min).
  Al cerrar la cuenta la sala pasa a `LIMPIEZA`; el rol LIMPIEZA la marca lista y vuelve a `ACTIVA`. No se hace check-in en una sala que no esté `ACTIVA`.
- **Flujo del cliente (con cuenta):** explorar salas y horarios sin login → al reservar pide iniciar sesión/registrarse → paga en línea la **sala completa + 30% del pedido de alimentos/bebidas** (si lo hizo) → recibe su **número de reservación** (`ML` + 8 hex).
- **Ingreso:** el cliente da su número en recepción → `GET /api/staff/reservaciones/buscar/:codigo` → `POST .../:id/check-in`.
- **Retraso:** si llega tarde y no hay otra reservación después (limpieza incluida), el fin se recorre; si no hay espacio, ese tiempo se pierde. Pasados 10 min (`toleranciaLlegadaMin`) es **no-show** (automático, cada minuto) y no se reembolsa.
- **Pedido anticipado:** queda `EN_ESPERA`. Recepción cobra el 70% restante (efectivo/tarjeta) en `POST /api/staff/pedidos/:id/cobrar-saldo` y pasa a `PREPARANDO` (cola de barra).
- **Tiempo extra:** solo si no hay reservación después; se paga en el establecimiento (`POST .../:id/extender`).
- **Sin registro (mostrador):** `POST /api/staff/reservaciones/mostrador` (recepción/admin) con solo nombre; puede iniciar de inmediato si hay sala lista.
- **Cierre de cuenta:** suma sala + extras + pedidos, promo 50% en alimentos del consumo en la 4ª visita del mes, y cobra lo que falte.
- Pagos: solo EFECTIVO y TARJETA. El pago en línea está **simulado** (`PAGOS_SIMULADOS`).

## Rutas
`/api/publico/*` (sin login: catálogo, salas, disponibilidad) · `/api/cliente/*` (registro, login, mis reservaciones) · `/api/auth/*` (login del personal) · `/api/staff/*` (por rol).
El frontend (HTML) va en `public/`. Lee SEGURIDAD.md antes de subir al dominio.

## Por definir (valores configurables en la tabla `configuracion`)
- `retencionTardiaPct` (30): % retenido si el cliente cancela con menos de 24 h. Hoy es un supuesto.
- Horario del sábado: se asumió 17:00 a 01:00.
- Precios por hora, temática de cada sala, fotos y descripciones (campos `fotoUrl`, `descripcion` listos para llenarse).

## Flujo de ramas (Git)
- `main` = producción (lo que está publicado en el dominio). Nadie trabaja directo aquí.
- `dev` = pruebas e integración. Todo el desarrollo nuevo entra primero a `dev`.
- Cambios grandes: rama `feature/<nombre>` desde `dev` → Pull Request a `dev`.
- Cuando `dev` esté probado: Pull Request `dev` → `main` (con el CI en verde).
- El CI (`.github/workflows/ci.yml`) valida el esquema Prisma y compila el TypeScript en cada push y PR.
- Nunca subas `.env` (está en `.gitignore`). En producción las variables van en el hosting, no en el repo.
- Recomendado en GitHub → Settings → Branches: proteger `main` (exigir Pull Request y que el CI pase).
