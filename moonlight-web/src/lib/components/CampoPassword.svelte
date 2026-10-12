<!-- Campo de contraseña con casilla "Mostrar contraseña". -->
<script lang="ts">
  let {
    valor = $bindable(''), etiqueta, nuevo = false, id,
  }: { valor?: string; etiqueta: string; nuevo?: boolean; id: string } = $props()
  let ver = $state(false)
</script>

<div class="field">
  <label for={id}>{etiqueta}</label>
  <input {id} type={ver ? 'text' : 'password'} bind:value={valor} required minlength={nuevo ? 10 : undefined}
    autocomplete={nuevo ? 'new-password' : 'current-password'} />
  <label class="check mt-1.5 text-[.82rem] cursor-pointer"><input type="checkbox" bind:checked={ver} /> Mostrar contraseña</label>
</div>
