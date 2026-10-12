<!-- Pago del anticipo con tarjeta guardada o nueva (simulado: no se realiza ningún cargo real). -->
<script lang="ts" module>
  import type { Dinero } from '#lib/api/types.ts'
  export interface DatosPago {
    codigo: string; sala: number | null; totalSala: Dinero; anticipoSala: Dinero; anticipo: Dinero; monto: Dinero; expiraEn: string | null
  }
</script>

<script lang="ts">
  import Modal from '../Modal.svelte'
  import TarjetaForm from './TarjetaForm.svelte'
  import { api } from '#lib/api/client.ts'
  import type { TarjetaGuardada } from '#lib/api/types.ts'
  import { ahora } from '#lib/fx/efectos.ts'
  import { confirmar } from '../confirmar.svelte.ts'
  import { dispatch } from '#lib/store/index.ts'
  import { avisar } from '#lib/store/ui.ts'
  import { falta, money, num } from '#lib/utils/formato.ts'
  import { tarjetaTxt } from '#lib/utils/tarjeta.ts'

  let { pago = $bindable(null), onpagado }: { pago: DatosPago | null; onpagado: (codigo: string, sala: number | null) => void } = $props()

  let guardadas = $state<TarjetaGuardada[]>([])
  let elegida = $state<number | null>(null) // tarjeta guardada elegida; null = tarjeta nueva
  let error = $state(''), enviando = $state(false)
  let form = $state<ReturnType<typeof TarjetaForm>>()

  $effect(() => {
    if (!pago) return
    error = ''
    api.get<TarjetaGuardada[]>('/cliente/tarjetas').then((l) => { guardadas = l; elegida = l[0]?.id ?? null }, () => { guardadas = []; elegida = null })
  })

  const resta = $derived(pago?.expiraEn ? new Date(pago.expiraEn).getTime() - $ahora : null)
  const restoSala = $derived(pago ? num(pago.totalSala) - num(pago.anticipoSala) : 0)

  async function eliminar(t: TarjetaGuardada) {
    if (!(await confirmar('Eliminar tarjeta', `¿Eliminar ${tarjetaTxt(t)}?`, { ok: 'Eliminar', peligro: true }))) return
    try {
      await api.delete(`/cliente/tarjetas/${t.id}`)
      guardadas = guardadas.filter((x) => x.id !== t.id)
      if (elegida === t.id) elegida = guardadas[0]?.id ?? null
    } catch (x) { dispatch(avisar((x as Error).message, 'bad')) }
  }

  async function pagar() {
    if (!pago) return
    error = ''
    let body: unknown
    if (elegida !== null) body = { tarjetaId: elegida }
    else {
      const d = form?.datos()
      if (!d) { error = 'Revisa los datos de la tarjeta'; return }
      body = d
    }
    enviando = true
    try {
      await api.post(`/cliente/reservaciones/${pago.codigo}/pagar`, body)
      const { codigo, sala } = pago
      pago = null
      onpagado(codigo, sala)
    } catch (x) { dispatch(avisar((x as Error).message, 'bad')) } finally { enviando = false }
  }

  function despues() {
    pago = null
    dispatch(avisar('Puedes pagar después desde "Mis reservaciones"'))
  }
</script>

{#if pago}
  <Modal abierto titulo="Pagar anticipo" onclose={() => (pago = null)}>
    <p>Apartamos la sala {pago.sala ?? ''} para ti.</p>
    {#if resta !== null}
      <p><span class="vivo {resta < 5 * 60_000 ? 'bad' : 'warn'}">{resta > 0 ? `Tienes ${falta(resta)} para pagar` : 'Se venció el tiempo: la sala se liberó'}</span></p>
    {/if}
    <dl class="mb-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
      <dt class="muted">Sala (total)</dt><dd class="text-right">{money(pago.totalSala)}</dd>
      <dt class="muted">Anticipo de la sala</dt><dd class="text-right">{money(pago.anticipoSala)}</dd>
      {#if num(pago.anticipo)}<dt class="muted">Anticipo del pedido</dt><dd class="text-right">{money(pago.anticipo)}</dd>{/if}
      <dt><b>A pagar ahora</b></dt><dd class="text-right"><b>{money(pago.monto)}</b></dd>
      {#if restoSala > 0}<dt class="muted small">Resto de la sala, en recepción al llegar</dt><dd class="muted small text-right">{money(restoSala)}</dd>{/if}
    </dl>

    {#if guardadas.length}
      <div class="mb-3 grid gap-2" role="radiogroup" aria-label="Tarjeta">
        {#each guardadas as t (t.id)}
          <label class="tarjeta-op" class:on={elegida === t.id}>
            <input type="radio" name="tarjeta" checked={elegida === t.id} onchange={() => (elegida = t.id)} />
            <span class="flex-1">{tarjetaTxt(t)}</span>
            <button type="button" class="x" title="Eliminar tarjeta" aria-label="Eliminar {tarjetaTxt(t)}" onclick={(e) => { e.preventDefault(); eliminar(t) }}>×</button>
          </label>
        {/each}
        <label class="tarjeta-op" class:on={elegida === null}>
          <input type="radio" name="tarjeta" checked={elegida === null} onchange={() => (elegida = null)} />
          <span class="flex-1">+ Usar otra tarjeta</span>
        </label>
      </div>
    {/if}
    <div hidden={elegida !== null}><TarjetaForm bind:this={form} /></div>
    <div class="err">{error}</div>
    <p class="muted small mt-3">Pago de demostración: no se realiza ningún cargo real.</p>

    {#snippet pie()}
      <button type="button" class="btn ghost" onclick={despues}>Pagar después</button>
      <button type="button" class="btn primary" disabled={enviando || (resta !== null && resta <= 0)} onclick={pagar}>Pagar {money(pago!.monto)}</button>
    {/snippet}
  </Modal>
{/if}
