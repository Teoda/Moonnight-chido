// Configuración de la CLI de Prisma (reemplaza a "prisma" en package.json, que Prisma 7 elimina).
// Con este archivo Prisma ya no lee .env por su cuenta: lo carga dotenv.
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
