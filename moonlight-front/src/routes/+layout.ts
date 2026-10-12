// La app se renderiza en el navegador. El servidor de SvelteKit entrega la app y reenvía /api al back;
// así el store de Redux vive en el navegador de cada usuario y nunca se comparte entre peticiones.
export const ssr = false
export const prerender = false
