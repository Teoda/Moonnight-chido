import express from 'express'
import { existsSync } from 'node:fs'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { ZodError } from 'zod'
import { config } from './config'
import { prisma } from './db'
import { HttpError } from './util'
import { cargarSesion } from './middleware/auth'
import { floodLimiter, generalLimiter } from './middleware/limiters'
import auth from './routes/auth'
import publico from './routes/publico'
import staff from './routes/staff'
import cliente from './routes/cliente'
import { mantenimiento } from './jobs'

const app = express()
app.disable('x-powered-by')

if (config.isProd) {
  app.set('trust proxy', config.trustProxy) // necesario detrás de Nginx/Caddy/hosting para ver HTTPS e IP reales
  app.use((req, res, next) => (req.secure ? next() : res.redirect(301, config.allowedOrigins[0] + req.originalUrl)))
}

app.use(helmet({
  contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'upgrade-insecure-requests': config.isProd ? [] : null } },
  hsts: config.isProd ? { maxAge: 15_552_000, includeSubDomains: true } : false,
}))
app.use(cors({ origin: (o, cb) => cb(null, !o || config.allowedOrigins.includes(o)), credentials: true }))
app.use(express.json({ limit: '50kb' }))
app.use(cookieParser())

app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
app.use('/api', floodLimiter, cargarSesion, generalLimiter) // generalLimiter va después para reconocer al personal
app.use('/api/auth', auth)
app.use('/api/publico', publico)
app.use('/api/cliente', cliente)
app.use('/api/staff', staff)
app.use('/api', (_req, res) => void res.status(404).json({ error: 'No encontrado' }))
app.use(express.static(config.frontendDir)) // el frontend (carpeta hermana moonlight-front) se sirve en el mismo origen = sin CORS

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) return void res.status(400).json({ error: 'Datos inválidos', detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })) })
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message })
  if (err?.code === 'P2002') return void res.status(409).json({ error: 'Ese dato ya está registrado' })
  if (err?.code === 'P2034') return void res.status(409).json({ error: 'Conflicto simultáneo, intenta de nuevo' })
  if (err?.type === 'entity.too.large') return void res.status(413).json({ error: 'Solicitud demasiado grande' })
  if (err?.type === 'entity.parse.failed') return void res.status(400).json({ error: 'JSON inválido' })
  console.error(err) // el detalle se queda en el servidor; el cliente no ve trazas
  res.status(500).json({ error: 'Error interno' })
})

setInterval(() => mantenimiento().catch(console.error), 60_000).unref()
if (!existsSync(config.frontendDir)) console.warn(`[aviso] No se encontró el frontend en ${config.frontendDir} (define FRONTEND_DIR)`)
app.listen(config.port, () => console.log(`Moonlight API en http://localhost:${config.port} (${config.isProd ? 'producción' : 'desarrollo'})`))
