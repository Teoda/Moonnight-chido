// Tipos globales de SvelteKit (https://svelte.dev/docs/kit/types#app.d.ts)
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // estado de historial sin cambiar de página (goto shallow): categoría o paquete abierto en el Menú, o tamaño de sala abierto en Salas,
    // así el botón "atrás" del teléfono cierra el panel en lugar de salir de la página
    interface PageState { categoria?: string; paquete?: number; tipoSala?: number }
    // interface Platform {}
  }
}

export {}
