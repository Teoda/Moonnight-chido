// Sesiones: la del cliente (sitio) y la del personal (panel) son independientes.
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { api, olvidarCsrf, sesionDe } from '../api/client.ts'
import type { Cliente, Usuario } from '../api/types.ts'

interface Estado {
  cliente: Cliente | null
  usuario: Usuario | null
  revisada: { cliente: boolean; staff: boolean } // ya se preguntó a la API si había sesión
}

// ── inicio de sesión unificado: el back decide si son credenciales del personal o de un cliente ──
export type Acceso = { tipo: 'staff'; usuario: Usuario } | { tipo: 'cliente'; cliente: Cliente }
export const iniciarSesion = createAsyncThunk('sesion/iniciar', async (b: { email: string; password: string }) =>
  api.post<Acceso>('/acceso/login', b))

// ── personal: nombre + llave de 8 dígitos ──
export const iniciarPersonal = createAsyncThunk('sesion/iniciarPersonal', async (b: { usuarioId: number; llave: string }) =>
  (await api.post<{ tipo: 'staff'; usuario: Usuario }>('/acceso/personal/login', b)).usuario)

// ── cliente ──
export const revisarCliente = createAsyncThunk('sesion/revisarCliente', async () =>
  (await sesionDe<{ cliente: Cliente }>('cliente'))?.cliente ?? null)

export const loginCliente = createAsyncThunk('sesion/loginCliente', async (b: { email: string; password: string }) =>
  (await api.post<{ cliente: Cliente }>('/cliente/login', b)).cliente)

export const registrarCliente = createAsyncThunk('sesion/registrarCliente',
  async (b: { nombre: string; email: string; password: string; telefono?: string; aceptaPromos: boolean }) =>
    (await api.post<{ cliente: Cliente }>('/cliente/registro', b)).cliente)

export const salirCliente = createAsyncThunk('sesion/salirCliente', async () => {
  await api.post('/cliente/logout').catch(() => {})
  olvidarCsrf('cliente')
})

// ── personal ──
export const revisarStaff = createAsyncThunk('sesion/revisarStaff', async () =>
  (await sesionDe<{ usuario: Usuario }>('staff'))?.usuario ?? null)

export const salirStaff = createAsyncThunk('sesion/salirStaff', async (todas: boolean) => {
  await api.post(todas ? '/auth/logout-todas' : '/auth/logout').catch(() => {})
  olvidarCsrf('staff')
})

const slice = createSlice({
  name: 'sesion',
  initialState: { cliente: null, usuario: null, revisada: { cliente: false, staff: false } } as Estado,
  reducers: {
    // la API respondió 401: la sesión se cerró (inactividad, contraseña cambiada en otro equipo...)
    clienteExpirado(s) { s.cliente = null },
    staffExpirado(s) { s.usuario = null },
    setCliente(s, a: PayloadAction<Cliente | null>) { s.cliente = a.payload },
  },
  extraReducers: (b) => {
    b.addCase(iniciarSesion.fulfilled, (s, a) => {
      if (a.payload.tipo === 'staff') { s.usuario = a.payload.usuario; s.revisada.staff = true }
      else { s.cliente = a.payload.cliente; s.revisada.cliente = true }
    })
    b.addCase(revisarCliente.fulfilled, (s, a) => { s.cliente = a.payload; s.revisada.cliente = true })
    b.addCase(loginCliente.fulfilled, (s, a) => { s.cliente = a.payload })
    b.addCase(registrarCliente.fulfilled, (s, a) => { s.cliente = a.payload })
    b.addCase(salirCliente.fulfilled, (s) => { s.cliente = null })
    b.addCase(revisarStaff.fulfilled, (s, a) => { s.usuario = a.payload; s.revisada.staff = true })
    b.addCase(iniciarPersonal.fulfilled, (s, a) => { s.usuario = a.payload; s.revisada.staff = true })
    b.addCase(salirStaff.fulfilled, (s) => { s.usuario = null })
  },
})

export const { clienteExpirado, staffExpirado } = slice.actions
export default slice.reducer
