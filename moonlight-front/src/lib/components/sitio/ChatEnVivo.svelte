<!-- Vista previa del asistente: una conversación que se reproduce "en tiempo real" (el cliente escribe,
     el asistente teclea su respuesta) y se repite. Los datos salen del catálogo real. -->
<script lang="ts">
  import { seleccionar } from '#lib/store/index.ts'
  import { money } from '#lib/utils/formato.ts'
  import { calma } from '#lib/fx/efectos.ts'

  type Msg = { id: number; de: 'yo' | 'ia'; texto: string; tecleando?: boolean }

  const cat = seleccionar((s) => s.catalogo.datos)

  // guion de la conversación: la sala que admite 8 personas (o la de en medio) y la primera temática
  const guion = $derived.by((): Pick<Msg, 'de' | 'texto'>[] => {
    const tipos = $cat?.tipos ?? []
    const t = tipos.find((x) => x.capacidadMin <= 8 && 8 <= x.capacidadMax) ?? tipos[Math.floor(tipos.length / 2)]
    const musica = $cat?.tematicas[0]?.nombre ?? 'pop'
    const personas = t ? Math.min(Math.max(8, t.capacidadMin), t.capacidadMax) : 8
    return [
      { de: 'yo', texto: `Hola 👋 ¿tienen sala para ${personas} este viernes a las 9?` },
      { de: 'ia', texto: t
        ? `¡Claro! 🎤 La Sala ${t.nombre} es para ${t.capacidadMin}–${t.capacidadMax} personas y cuesta ${money(t.precioHora)} la hora.`
        : '¡Claro! 🎤 Tenemos salas para grupos chicos, medianos y premium.' },
      { de: 'yo', texto: `¿Y podemos ponerle ${musica}?` },
      { de: 'ia', texto: `¡Hecho! Ambientamos tu sala con ${musica}. ¿Te la aparto? 🌙` },
    ]
  })

  let mensajes = $state<Msg[]>([])
  let escribiendo = $state(false)

  $effect(() => {
    const pasos = guion
    if (calma) { mensajes = pasos.map((m, id) => ({ ...m, id })); return }
    let vivo = true, sig = 0
    const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms))
    ;(async () => {
      while (vivo) {
        mensajes = []
        await esperar(600)
        for (const m of pasos) {
          if (!vivo) return
          if (m.de === 'yo') {
            await esperar(500)
            mensajes.push({ ...m, id: sig++ })
          } else {
            escribiendo = true
            await esperar(1300)
            escribiendo = false
            mensajes.push({ de: 'ia', texto: '', id: sig++, tecleando: true })
            const ref = mensajes[mensajes.length - 1]
            for (let i = 1; i <= m.texto.length && vivo; i++) { ref.texto = m.texto.slice(0, i); await esperar(22) }
            ref.tecleando = false
          }
          await esperar(900)
        }
        await esperar(3500)
      }
    })()
    return () => { vivo = false }
  })
</script>

<figure class="ventana m-0 w-full" aria-label="Vista previa: conversación en tiempo real con el asistente de Moonlight">
  <div class="ventana-barra">
    <span class="avatar-ia" aria-hidden="true">🌙</span>
    <span class="min-w-0 flex-1 leading-tight">
      <b class="block text-[.85rem]">Asistente Moonlight</b>
      <span class="flex items-center gap-1.5 text-[.72rem] text-ok"><span class="dot-vivo" aria-hidden="true"></span>En línea</span>
    </span>
    <span class="eq flex h-3.5 items-end gap-0.5" aria-hidden="true">{#each Array(5) as _, i (i)}<i></i>{/each}</span>
  </div>
  <div class="chat-cuerpo" aria-hidden="true">
    {#each mensajes as m (m.id)}
      <p class="burbuja {m.de} m-0">{m.texto}{#if m.tecleando}<span class="caret"></span>{/if}</p>
    {/each}
    {#if escribiendo}<span class="escribiendo self-start"><i></i><i></i><i></i></span>{/if}
  </div>
  <figcaption class="flex items-center gap-2 border-t border-line px-3 py-2.5">
    <span class="flex-1 truncate rounded-full border border-line bg-fondo px-3.5 py-2 text-[.8rem] font-light text-muted">Escribe tu mensaje…</span>
    <a class="btn sm primary" href="/reservar">Reservar <span class="flecha" aria-hidden="true">→</span></a>
  </figcaption>
</figure>
