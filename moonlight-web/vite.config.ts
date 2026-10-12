import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import adapterNode from '@sveltejs/adapter-node'
import adapterVercel from '@sveltejs/adapter-vercel'

// En Vercel (que define VERCEL=1 al compilar) se usa su adaptador; en cualquier otro lado,
// un servidor Node propio (npm run build && npm start).
const enVercel = !!process.env.VERCEL

export default defineConfig({
  plugins: [
    tailwindcss(),
    // En SvelteKit 3 la configuración de Kit va aquí (ya no existe svelte.config.js)
    sveltekit({
      adapter: enVercel ? adapterVercel({ runtime: 'nodejs22.x' }) : adapterNode(),
      // CSP equivalente a la del back (helmet): SvelteKit agrega nonces/hashes a sus propios scripts.
      csp: {
        mode: 'auto',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
          'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
          'img-src': ['self', 'data:'],
          'connect-src': ['self'],
          'frame-src': ['https://www.google.com', 'https://maps.google.com'], // mapa de ubicación
          'object-src': ['none'],
          'base-uri': ['self'],
          'form-action': ['self'],
          'frame-ancestors': ['self'],
        },
      },
    }),
  ],
})
