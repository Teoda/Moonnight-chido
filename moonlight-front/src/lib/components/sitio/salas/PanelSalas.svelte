<!-- Panel "Explorar salas" de un tamaño (sobre PanelLateral: dialog, animación, foco, Esc, fondo inerte).
     Muestra cada sala registrada de ese tamaño con su estado actual (en servicio, limpieza o mantenimiento).
     El cliente no elige número de sala: "Reservar" lleva al asistente con el tamaño elegido y el sistema
     asigna la sala libre según la disponibilidad del horario. -->
<script lang="ts">
  import type { SalaPublica, TipoSala } from '#lib/api/types.ts'
  import PanelLateral from '../carta/PanelLateral.svelte'
  import { PRESENTACION_TIPO_SALA } from '#lib/utils/carta.ts'
  import { money } from '#lib/utils/formato.ts'

  let { tipos, salas, abierto, cortesia, oncambiar, oncerrar, onreservar }: {
    tipos: TipoSala[]; salas: SalaPublica[]; abierto: number | undefined
    cortesia: (tipoId: number) => boolean
    oncambiar: (id: number) => void; oncerrar: () => void; onreservar: (t: TipoSala) => void
  } = $props()

  const actual = $derived(tipos.find((t) => t.id === abierto) ?? null)
  const deTipo = (t: TipoSala) => salas.filter((s) => s.tipoSalaId === t.id)
  const ESTADO = { ACTIVA: ['ok', 'En servicio'], LIMPIEZA: ['warn', 'En limpieza'], MANTENIMIENTO: ['bad', 'En mantenimiento'] } as const
</script>

<PanelLateral item={actual} idTitulo="panel-salas-titulo" etiquetaCerrar={(t) => `Cerrar Sala ${t.nombre}`} {oncerrar}>
  {#snippet barra(m)}
    <nav class="atajos" aria-label="Tamaños de sala">
      {#each tipos as t (t.id)}
        <button type="button" class="atajo" aria-current={t.id === m.id ? 'true' : undefined} onclick={() => oncambiar(t.id)}>Sala {t.nombre}</button>
      {/each}
    </nav>
  {/snippet}

  {#snippet children(t)}
    {@const p = PRESENTACION_TIPO_SALA[t.codigo]}
    {@const lista = deTipo(t)}
    <figure class="portada tipo-sala">
      {#if p}<img src={p.foto.src} alt={p.foto.alt} width={p.foto.ancho} height={p.foto.alto} decoding="async" />{/if}
    </figure>

    <div class="contenido">
      <h2 id="panel-salas-titulo" class="titulo">Sala {t.nombre}</h2>
      <p class="desc">{t.capacidadMin}–{t.capacidadMax} personas · <b class="text-gold">{money(t.precioHora)}</b> por hora</p>
      {#if cortesia(t.id)}<p class="cortesia">🍾 Incluye una botella de cortesía a elegir</p>{/if}

      <h3 class="subtitulo">{lista.length} {lista.length === 1 ? 'sala registrada' : 'salas registradas'}</h3>
      <ul class="salas">
        {#each lista as s (s.numero)}
          {@const [clase, texto] = ESTADO[s.estado]}
          <li class="sala" class:fuera={!s.disponibleParaReservar}>
            <span class="numero" aria-hidden="true">{s.numero}</span>
            <span class="info">
              <span class="nombre">Sala {s.numero}</span>
              <span class="estado {clase}">{texto}</span>
            </span>
          </li>
        {/each}
      </ul>

      <p class="nota">
        Al reservar eliges fecha, horario y tu música; el sistema te asigna una sala libre de este tamaño.
        «En servicio» indica el estado actual de la sala, no la disponibilidad de un horario.
      </p>
    </div>
  {/snippet}

  {#snippet pie(t)}
    {@const enServicio = deTipo(t).some((s) => s.disponibleParaReservar)}
    <p class="pie-texto">{enServicio ? 'La sala se asigna según la disponibilidad.' : 'Por ahora ninguna sala de este tamaño está en servicio.'}</p>
    <button type="button" class="btn primary" disabled={!enServicio} onclick={() => onreservar(t)}>Reservar Sala {t.nombre}</button>
  {/snippet}
</PanelLateral>

<style>
  .atajos { display: flex; gap: 6px; min-width: 0; overflow-x: auto; scrollbar-width: none; padding: 2px; }
  .atajos::-webkit-scrollbar { display: none; }
  .atajo {
    flex: none; padding: 7px 12px; border: 1px solid var(--line); border-radius: 999px; background: transparent;
    color: var(--muted); font: inherit; font-size: .84rem; white-space: nowrap; cursor: pointer; transition: color .2s, border-color .2s, background .2s;
  }
  .atajo:hover { color: var(--text); border-color: rgba(180, 92, 255, .6); }
  .atajo[aria-current='true'] { color: #fff; background: var(--accent); border-color: var(--accent); }
  .atajo:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

  /* la foto trae su propio marco redondeado: un zoom leve lo deja fuera del recorte */
  .portada.tipo-sala { aspect-ratio: 900 / 366; }
  .portada.tipo-sala img { transform: scale(1.08); }
  .cortesia { margin: -8px 0 14px; color: var(--gold); font-size: .9rem; }
  .subtitulo { margin: 4px 0 10px; color: var(--color-lila); font-size: .95rem; }

  .salas { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr)); margin: 0; padding: 0; list-style: none; }
  .sala { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(21, 15, 42, .6); }
  .sala.fuera { opacity: .65; }
  .numero {
    display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 10px;
    border: 1px solid rgba(255, 194, 61, .45); background: rgba(255, 194, 61, .07);
    color: var(--gold); font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .info { display: grid; gap: 2px; min-width: 0; }
  .nombre { font-weight: 600; }
  .estado { display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; }
  .estado::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .estado.ok { color: var(--ok); }
  .estado.warn { color: var(--warn); }
  .estado.bad { color: var(--bad); }
</style>
