import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import adapter from '@sveltejs/adapter-node'

export default defineConfig({
  plugins: [
    tailwindcss(),
    // En SvelteKit 3 la configuración de Kit va aquí (ya no existe svelte.config.js)
    sveltekit({
      adapter: adapter(),
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
