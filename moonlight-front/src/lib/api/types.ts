// Tipos de las respuestas de la API (moonlight-db). Los importes llegan como texto (Decimal de Prisma).
export type Dinero = string | number

export type Rol = 'ADMIN' | 'OPERACIONES' | 'FINANZAS' | 'RECEPCION' | 'BARRA' | 'MARKETING' | 'LIMPIEZA'
export type EstadoReservacion = 'PENDIENTE_PAGO' | 'CONFIRMADA' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA' | 'NO_SHOW'
export type EstadoPedido = 'EN_ESPERA' | 'NUEVO' | 'PREPARANDO' | 'ENTREGADO' | 'CANCELADO'
export type EstadoSala = 'ACTIVA' | 'LIMPIEZA' | 'MANTENIMIENTO'
export type EstadoLimpieza = 'PENDIENTE' | 'EN_PROCESO' | 'LISTA'
export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'REEMBOLSADO' | 'FALLIDO'
export type MetodoPago = 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'TARJETA'
export type MetodoMostrador = Exclude<MetodoPago, 'TARJETA'>
export type Categoria = 'ALIMENTO' | 'BEBIDA' | 'PAQUETE'
export type OrigenPedido = 'PREORDEN' | 'QR_SALA' | 'MOSTRADOR'

// ── catálogo público ──
export interface TipoSala {
  id: number; codigo: string; nombre: string; capacidadMin: number; capacidadMax: number
  precioHora: Dinero; descripcion: string | null
}
export interface Tematica { id: number; nombre: string; descripcion: string | null }
export interface Producto {
  id: number; nombre: string; categoria: Categoria; seccion: string; descripcion: string | null
  precio: Dinero; alcohol: boolean; orden: number; tipoSalaId: number | null
}
export interface Horario { diaSemana: number; abre: string; cierra: string }
export interface Reglas {
  limpiezaMin: number; pasoMin: number; anticipoSalaPct: number; anticipoPedidoPct: number
  horasCancelacion: number; toleranciaMin: number
}
export interface Cortesia { tipoSalaId: number; botellas: { id: number; nombre: string; precio: Dinero }[] }
export interface Catalogo {
  tipos: TipoSala[]; tematicas: Tematica[]; menu: Producto[]; horarios: Horario[]
  cortesia: Cortesia | null; reglas: Reglas
}
export interface SalaPublica {
  numero: number; descripcion: string | null; fotoUrl: string | null; tipo: string; capacidad: string
  precioHora: Dinero; tipoSalaId: number; estado: EstadoSala; disponibleParaReservar: boolean
}
export interface Disponibilidad { cerrado: boolean; tipo?: string; slots: { inicio: string; disponibles: number }[] }

// ── sesión ──
export interface Cliente { id: number; nombre: string; email: string | null }
export interface Usuario { id: number; nombre: string; rol: Rol }

// ── reservaciones ──
export interface ItemPedido { id?: number; cantidad: number; precioUnitario?: Dinero; producto: { nombre: string } }
export interface Pedido {
  id: number; origen: OrigenPedido; estado: EstadoPedido; total: Dinero; anticipo: Dinero
  creadoEn: string; items: ItemPedido[]; notas?: string | null
}
export interface Pago {
  id: number; tipo: string; metodo: MetodoPago; estado: EstadoPago; monto: Dinero; enLinea: boolean
}
export interface Cuenta {
  subtotalSala: Dinero; subtotalExtras: Dinero; subtotalPedidosAnticipados: Dinero; subtotalConsumo: Dinero
  descuento: Dinero; total: Dinero; pagadoPrevio: Dinero; saldo: Dinero
}
export interface Extension { minutos: number; monto: Dinero }

export interface ReservacionCliente {
  id: number; codigo: string; inicio: string; fin: string; personas: number; estado: EstadoReservacion
  canal: 'WEB' | 'MOSTRADOR'; subtotalSala: Dinero; anticipoSala: Dinero; expiraEn: string | null
  retrasoMin: number; tiempoPerdidoMin: number; artistas: string | null; canciones: string | null
  sala: { numero: number; tipoSalaId: number; tipoSala: { nombre: string } }
  tematica: { id: number; nombre: string } | null
  pedidos: Pedido[]; pagos?: Pago[]; extensiones?: Extension[]; cuenta?: Cuenta | null
}
export interface NuevaReservacion {
  codigo: string; sala: number; totalSala: Dinero; anticipoSala: Dinero; anticipoPedido: Dinero
  aPagarEnLinea: Dinero; expiraEn: string | null
}
export interface TarjetaGuardada { id: number; marca: string; ultimos4: string; mesExp: number; anioExp: number }

// ── personal ──
export interface ReservacionStaff {
  id: number; codigo: string; inicio: string; fin: string; finOriginal: string | null; personas: number
  estado: EstadoReservacion; canal: 'WEB' | 'MOSTRADOR'; subtotalSala: Dinero; saldoSala?: Dinero
  retrasoMin: number; tiempoPerdidoMin: number; checkInEn: string | null
  artistas: string | null; canciones: string | null; tematica: { nombre: string } | null
  cliente: { nombre: string; telefono: string | null }
  sala: { numero: number; estado: EstadoSala; tipoSalaId?: number; tipoSala?: { nombre: string } }
  pagos: Pago[]; pedidos: Pedido[]; extensiones: Extension[]
}
export interface PedidoBarra extends Pedido {
  reservacion: { codigo: string; estado?: EstadoReservacion; sala: { numero: number } }
  restante?: Dinero
}
export interface SalaStaff {
  id: number; numero: number; estado: EstadoSala; tipoSala: TipoSala
  reservaciones: { codigo: string; estado: EstadoReservacion; inicio: string; fin: string; artistas: string | null; tematica: { nombre: string } | null }[]
}
export interface TareaLimpieza {
  id: number; estado: EstadoLimpieza; creadaEn: string; iniciadaEn: string | null
  reservacionId: number | null; sala: { numero: number }
}
export interface Kpis {
  ingresosNetos: Dinero
  pagos: { tipo: string; metodo: MetodoPago; estado: EstadoPago; monto: Dinero }[]
  reservacionesPorEstado: Record<string, number>
}
