<!-- Tarjeta nueva con validación por campo. El padre llama a `datos()` (bind:this) para obtener el cuerpo. -->
<script lang="ts">
  import { VALIDAR, cuerpoTarjeta, marcaTarjeta, soloDigitos, type CamposTarjeta, type ErroresTarjeta } from '#lib/utils/tarjeta.ts'

  const c = $state<CamposTarjeta>({ titular: '', numero: '', vence: '', cvv: '' })
  let guardar = $state(false)
  let errores = $state<ErroresTarjeta>({})
  const tocados = new Set<keyof CamposTarjeta>()
  const marca = $derived(marcaTarjeta(soloDigitos(c.numero)))

  // el error de un campo se muestra al salir de él; mientras se corrige, se actualiza en vivo
  const revisar = (k: keyof CamposTarjeta) => { if (tocados.has(k)) errores[k] = VALIDAR[k](c) }
  const salir = (k: keyof CamposTarjeta) => { if (c[k]) tocados.add(k); revisar(k) }

  function numero(e: Event) {
    const n = soloDigitos((e.target as HTMLInputElement).value).slice(0, 16)
    c.numero = n.replace(/(\d{4})(?=\d)/g, '$1 ')
    revisar('numero')
  }
  function vence(e: Event) {
    const d = soloDigitos((e.target as HTMLInputElement).value).slice(0, 4)
    c.vence = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
    revisar('vence')
  }
  function cvv(e: Event) { c.cvv = soloDigitos((e.target as HTMLInputElement).value); revisar('cvv') }

  /** Valida todo; regresa el cuerpo para la API o null (y muestra los errores). */
  export function datos() {
    let ok = true
    for (const k of Object.keys(VALIDAR) as (keyof CamposTarjeta)[]) {
      tocados.add(k)
      errores[k] = VALIDAR[k](c)
      if (errores[k]) ok = false
    }
    return ok ? cuerpoTarjeta(c, guardar) : null
  }
</script>

<div>
  <div class="field">
    <label for="t-titular">Titular</label>
    <input id="t-titular" autocomplete="cc-name" maxlength="120" placeholder="Como aparece en la tarjeta" bind:value={c.titular}
      oninput={() => revisar('titular')} onblur={() => salir('titular')} aria-invalid={!!errores.titular} />
    <div class="msg-campo" aria-live="polite">{errores.titular || ''}</div>
  </div>
  <div class="field">
    <label for="t-numero">Número de tarjeta {#if marca}<span class="badge accent ml-1.5">{marca}</span>{/if}</label>
    <input id="t-numero" autocomplete="cc-number" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000"
      value={c.numero} oninput={numero} onblur={() => salir('numero')} aria-invalid={!!errores.numero} />
    <div class="msg-campo" aria-live="polite">{errores.numero || ''}</div>
  </div>
  <div class="form-grid">
    <div class="field">
      <label for="t-vence">Vencimiento</label>
      <input id="t-vence" autocomplete="cc-exp" inputmode="numeric" maxlength="5" placeholder="MM/AA"
        value={c.vence} oninput={vence} onblur={() => salir('vence')} aria-invalid={!!errores.vence} />
      <div class="msg-campo" aria-live="polite">{errores.vence || ''}</div>
    </div>
    <div class="field">
      <label for="t-cvv">CVV</label>
      <input id="t-cvv" type="password" autocomplete="cc-csc" inputmode="numeric" maxlength="4" placeholder="•••"
        value={c.cvv} oninput={cvv} onblur={() => salir('cvv')} aria-invalid={!!errores.cvv} />
      <div class="msg-campo" aria-live="polite">{errores.cvv || ''}</div>
    </div>
  </div>
  <label class="check"><input type="checkbox" bind:checked={guardar} /> Guardar esta tarjeta para mis próximas reservaciones</label>
  <p class="muted small mt-2 mb-0">Si la guardas solo conservamos la marca, los últimos 4 dígitos y el vencimiento; nunca el número completo ni el CVV.</p>
</div>
