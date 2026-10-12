# Moonlight · Backend (Express + Prisma + MySQL)

## Arranque local
1. `npm install`
2. Copia `.env.example` a `.env` (en Windows: `copy .env.example .env`)
3. `npm run db:up`                          (MySQL en Docker, puerto 3309)
4. `npx prisma migrate dev`                 (crea las tablas)
5. `npm run db:seed`                        (salas, menú, promos, horario, configuración, usuarios de prueba)
6. `npm run dev`                            (API en http://localhost:3000)

> Si ya habías hecho migraciones con la versión anterior del esquema: `npm run db:reset` (borra datos de prueba y recrea todo).

HeidiSQL → MySQL (TCP/IP) · 127.0.0.1 · puerto 3309 · moonlight / moonlight_pass · base moonlight
Usuarios de prueba (contraseña `Moonlight2026!`): admin@, recepcion@, barra@, operaciones@, limpieza@ moonlight.mx

## Reglas de negocio implementadas
- **Horario:** lunes a sábado, 12:00 a 02:00; domingo cerrado (tabla `horarios_operacion`, se define en `prisma/seed.ts`). **Para pruebas** `HORARIO_24H=true` en `.env` + `npm run db:seed` abre los 7 días las 24 h (las reservaciones pueden cruzar la medianoche); quítalo y vuelve a correr el seed para el horario real. Los horarios de inicio van cada 30 min; duración de 1 a 4 h.
- **Limpieza:** cada reservación bloquea la sala 15 min después de terminar (`limpiezaMin`). Sala 18:00–19:00 → la siguiente puede iniciar a las 19:30 (rejilla de 30 min).
  Al cerrar la cuenta la sala pasa a `LIMPIEZA`; el rol LIMPIEZA la marca lista y vuelve a `ACTIVA`. No se hace check-in en una sala que no esté `ACTIVA`.
- **Mantenimiento:** una sala en `MANTENIMIENTO` o `LIMPIEZA` no se ofrece para ninguna reservación nueva (web ni sin registro). Al presionar "Reactivar" pasa a `LIMPIEZA` con su tarea; queda `ACTIVA` cuando limpieza la termina.
- **Avisos al cliente:** su página revisa sus reservaciones cada 20 s (en cualquier sección). Le avisa al entrar, cuando le quedan 10 y 5 min, cuando termina su tiempo (con su estado de cuenta) y cuando recepción cierra la cuenta (con el desglose y los pagos). En "Mis reservaciones" cada reservación tiene "🧾 Estado de cuenta".
- **Flujo del cliente (con cuenta):** explorar salas y horarios sin login → al reservar pide iniciar sesión/registrarse → paga en línea con tarjeta el **50% de la sala (`anticipoSalaPct`) + 30% del pedido de alimentos/bebidas** (si lo hizo) → recibe su **número de reservación** (`ML` + 8 hex). Si elige una fecha cerrada se le muestra "Día no laboral".
- **Tarjetas:** el cliente puede guardar la tarjeta para próximas reservaciones o pagar sin guardarla. Solo se guardan marca, últimos 4 dígitos, vencimiento, titular y un token (tabla `tarjetas_guardadas`); nunca el número completo ni el CVV. Tarjeta de prueba: 4242 4242 4242 4242.
- **Ingreso:** el cliente da su número en recepción → `GET /api/staff/reservaciones/buscar/:codigo` → `POST .../:id/check-in`, donde recepción **cobra el 50% restante de la sala** (efectivo o tarjeta). Puede entrar hasta 15 min antes (`ingresoAnticipadoMin`) si la sala está lista y ya no la ocupa la reservación anterior; el fin no cambia.
- **Retraso:** si llega tarde y no hay otra reservación después (limpieza incluida), el fin se recorre; si no hay espacio, ese tiempo se pierde. Pasados 10 min (`toleranciaLlegadaMin`) es **no-show** (automático, cada minuto) y no se reembolsa.
- **Pedido anticipado:** queda `EN_ESPERA`. Recepción cobra el 70% restante (efectivo/tarjeta) en `POST /api/staff/pedidos/:id/cobrar-saldo` y pasa a `PREPARANDO` (cola de barra).
- **Tiempo extra:** solo si no hay reservación después; se paga en el establecimiento (`POST .../:id/extender`).
- **Cliente sin registro (mostrador):** botón "+ Cliente sin registro" → `POST /api/staff/reservaciones/mostrador` (recepción/admin) con solo nombre; paga la sala completa y puede iniciar de inmediato si hay sala lista.
- **Sala y música:** el cliente elige el tamaño de la sala (Pequeña, Mediana o Premium; deben caber las personas) y su música: un género (tabla `tematicas`, se definen en `prisma/seed.ts`) o "mi propia lista" con al menos 3 artistas; también puede pedir canciones. Las salas ya no tienen temática fija: se ambientan con lo que elige el cliente. La música se puede cambiar hasta antes de terminar la visita (`PATCH /api/cliente/reservaciones/:codigo/musica`). En mostrador la música es opcional.
- **Botella de cortesía (Sala Premium):** toda reservación Premium incluye una botella a elegir entre las de hasta `cortesiaTopePrecio` ($550: Bacardí Carta Blanca, Presidente Solera, Smirnoff No. 21). Se registra a $0 en el pedido anticipado y recepción la envía a barra tras el check-in. El tipo de sala y el tope se cambian en la tabla `configuracion`.
- **Cierre de cuenta:** suma sala + extras + pedidos, promo 50% en alimentos del consumo en la 4ª visita del mes, y cobra lo que falte.
- Pagos: en el establecimiento EFECTIVO, TARJETA_DEBITO o TARJETA_CREDITO (recepción elige en cada cobro: check-in, cliente sin registro, tiempo extra, saldo de pedidos y cierre); en línea TARJETA. El pago en línea está **simulado** (`PAGOS_SIMULADOS`): valida la tarjeta pero no cobra.
- **Sesiones:** clientes, 1 h sin actividad; Administración, abierta hasta que cierre sesión; resto del personal, 30 min sin actividad. Clientes y personal usan cookies distintas, así que pueden estar abiertas a la vez en el mismo navegador.

## Rutas
`/api/publico/*` (sin login: catálogo, salas, disponibilidad) · `/api/cliente/*` (registro, login, mis reservaciones) · `/api/auth/*` (login del personal) · `/api/staff/*` (por rol).
El frontend vive en la carpeta hermana `../moonlight-front` (configurable con `FRONTEND_DIR`). Lee SEGURIDAD.md antes de subir al dominio.
La CLI de Prisma se configura en `prisma.config.ts` (ruta del esquema, migraciones y seed).

## Frontend (`../moonlight-front`, lo sirve Express en el mismo origen)
- `http://localhost:3000/` → sitio de clientes: inicio con "Conócenos" (fachada, misión, visión y mapa de ubicación), salas, menú (con foto del bar), reservar (horario → pedido anticipado → pago simulado → número de reservación) y "Mis reservaciones" (pagar, cancelar, reagendar, pedir a la sala).
- `http://localhost:3000/staff.html` → panel del personal (el sitio de clientes solo muestra el enlace "Panel de administración" si hay una sesión de Administración abierta en ese navegador); las pestañas dependen del rol: Recepción (buscar código, check-in, no-show, tiempo extra, pedidos, cerrar cuenta, mostrador, cobrar saldo de preórdenes), Agenda, Barra, Salas, Limpieza y Finanzas.
- HTML/CSS/JS sin dependencias ni build. Sin scripts inline (compatible con la CSP de helmet) y todo el texto se inserta con `textContent`.

## Por definir (valores configurables en la tabla `configuracion`)
- `retencionTardiaPct` (30): % retenido si el cliente cancela con menos de 24 h. Hoy es un supuesto.
- Precios por hora (tabla `tipos_sala`) y descripciones de cada sala (campo `descripcion`). Las fotos ya están por tipo de sala.

## Flujo de ramas (Git)
- `main` = producción (lo que está publicado en el dominio). Nadie trabaja directo aquí.
- `dev` = pruebas e integración. Todo el desarrollo nuevo entra primero a `dev`.
- Cambios grandes: rama `feature/<nombre>` desde `dev` → Pull Request a `dev`.
- Cuando `dev` esté probado: Pull Request `dev` → `main` (con el CI en verde).
- El CI (`.github/workflows/ci.yml`) valida el esquema Prisma y compila el TypeScript en cada push y PR.
- Nunca subas `.env` (está en `.gitignore`). En producción las variables van en el hosting, no en el repo.
- Recomendado en GitHub → Settings → Branches: proteger `main` (exigir Pull Request y que el CI pase).
