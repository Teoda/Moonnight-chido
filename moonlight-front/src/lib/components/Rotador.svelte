<!-- Texto que se escribe y se borra, rotando entre palabras ("Esta noche suena ..."). -->
<script lang="ts">
  import { calma } from '#lib/fx/efectos.ts'

  let { palabras }: { palabras: string[] } = $props()
  let texto = $state('')

  $effect(() => {
    const lista = palabras
    if (!lista.length) return
    let i = 0, borrando = false, id: ReturnType<typeof setTimeout>
    if (calma) {
      texto = lista[0]
      const iv = setInterval(() => (texto = lista[++i % lista.length]), 2500)
      return () => clearInterval(iv)
    }
    let txt = '' // copia local: leer `texto` aquí haría que el efecto se reinicie en cada letra
    const tick = () => {
      const meta = lista[i % lista.length]
      txt = borrando ? meta.slice(0, txt.length - 1) : meta.slice(0, txt.length + 1)
      texto = txt
      let espera = borrando ? 45 : 95
      if (!borrando && txt === meta) { borrando = true; espera = 1700 }
      else if (borrando && !txt) { borrando = false; i++; espera = 300 }
      id = setTimeout(tick, espera)
    }
    tick()
    return () => clearTimeout(id)
  })
</script>

<b class="text-accent-2">{texto}</b><span class="caret" aria-hidden="true"></span>
