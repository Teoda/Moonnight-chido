# Seguridad de sesiones y cookies

## Qué protege cada medida
| Amenaza | Defensa |
|---|---|
| Robo de la cookie con JavaScript (XSS) | Cookie `HttpOnly`; CSP estricta (helmet); la API solo devuelve JSON, el front debe escapar texto (usa `textContent`) |
| Robo de la cookie en la red | `Secure` + HSTS + redirección a HTTPS en producción |
| Cookie enviada desde otro sitio (CSRF) | `SameSite=Strict` + verificación de `Origin` + header `X-CSRF-Token` (HMAC por sesión) |
| Fijación de sesión | Se crea un token nuevo en cada login y se borra el anterior |
| Filtración de la base de datos | Solo se guarda el hash SHA-256 del token de sesión |
| Sesión olvidada abierta | Personal: 30 min de inactividad / 8 h máx. Clientes: 2 h de inactividad / 7 días máx. |
| Contraseña cambiada tras sospecha | `cambiar-password` y `logout-todas` cierran las demás sesiones |
| Cookie manipulada desde un subdominio | Prefijo `__Host-` en producción |
| Fuerza bruta de contraseñas | Límite por IP + bloqueo de la cuenta 15 min tras 5 fallos + bcrypt |
| Enumeración de usuarios | Mismo mensaje y mismo tiempo de respuesta haya o no usuario |
| Manipulación de precios | Los precios siempre se leen de la BD, nunca del navegador |
| Adivinar códigos de reservación | El cliente solo ve sus reservaciones con sesión; recepción busca por código con sesión de personal |
| Cuenta de cliente usada en rutas del personal | Las rutas `/api/staff` exigen sesión de personal; una sesión de cliente nunca pasa (y viceversa) |
| Ver reservaciones de otro cliente | Toda consulta se filtra por el cliente de la sesión; si no es suyo responde 404 |
| Registro masivo de cuentas falsas | Límite de registros por IP |
| Inyección SQL | Prisma parametriza todo; entradas validadas con zod |

## Antes de subirlo al dominio
1. HTTPS obligatorio (Caddy, Nginx + Let's Encrypt, Cloudflare o el hosting). Sin HTTPS la cookie `Secure` no funciona.
2. `NODE_ENV=production`, `ALLOWED_ORIGINS=https://tu-dominio`, `TRUST_PROXY=1` (si hay proxy delante).
3. `SESSION_SECRET` nuevo de 48+ bytes (comando en `.env.example`). Nunca subir `.env` a Git.
4. Cambiar las contraseñas de los usuarios de prueba (`SEED_PASSWORD` propio; el seed se niega a usar la de ejemplo en producción).
5. MySQL NO expuesto a Internet (sin puerto público) y un usuario de BD propio sin `GRANT ALL *.*` (ese permiso es solo para el entorno de desarrollo).
6. Si la presentación necesita el pago simulado: `PAGOS_SIMULADOS=true`. Con pagos reales, confirmar solo por webhook firmado.

## Límites conocidos
- El límite de peticiones vive en memoria: con varias instancias del servidor se necesita un almacén compartido (Redis).
- El bloqueo por cuenta puede usarse para molestar a un usuario real (15 min); es el costo de frenar la fuerza bruta.
- Si el dispositivo del usuario tiene malware, ninguna cookie lo salva.
