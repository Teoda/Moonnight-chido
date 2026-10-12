// Variables de entorno (sistema de SvelteKit 3). Se leen del archivo .env y se validan al arrancar.
// Se usan con: import { API_URL } from '$app/env/private'  (solo en código del servidor).
import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
  API_URL: {
    description: 'Dirección del back de Express (moonlight-db). El servidor de SvelteKit le reenvía /api/*.',
    schema: (valor) => {
      const v = (valor || 'http://localhost:3000').trim().replace(/\/+$/, '')
      if (!/^https?:\/\/[^/\s]+$/.test(v)) throw new Error(`API_URL debe ser como http://host:puerto (sin ruta). Recibido: "${valor}"`)
      return v
    },
  },
})
