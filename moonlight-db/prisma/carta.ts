// Carta de Moonlight (propuesta de octubre de 2026, precios sugeridos en MXN).
// Para cambiar precios o productos edita esta lista y corre `npm run db:seed`: se actualizan por nombre.
// Los productos que ya no estén aquí se desactivan (no se borran, porque hay pedidos que los usan).

type Cat = 'ALIMENTO' | 'BEBIDA' | 'PAQUETE'
export type Producto = {
  nombre: string; categoria: Cat; seccion: string; precio: number
  alcohol?: boolean; descripcion?: string; tipoSala?: 'PEQUENA' | 'MEDIANA' | 'PREMIUM'
}

const grupo = (categoria: Cat, seccion: string, filas: [string, number][], extra: Partial<Producto> = {}): Producto[] =>
  filas.map(([nombre, precio]) => ({ nombre, categoria, seccion, precio, ...extra }))
const botellas = (tipo: string, filas: [string, number][]) =>
  grupo('BEBIDA', `Botellas · ${tipo}`, filas.map(([n, p]) => [`${n} (botella)`, p]), { alcohol: true })

export const CARTA: Producto[] = [
  // 1. Botellas (700–750 ml aprox.)
  ...botellas('Tequila', [['José Cuervo Tradicional', 750], ['Don Julio Blanco', 950], ['1800 Reposado', 1050], ['Don Julio 70', 1400]]),
  ...botellas('Ron', [['Bacardí Carta Blanca', 500], ['Bacardí Añejo', 600], ['Havana Club 7 Años', 800], ['Matusalem Gran Reserva 15', 950]]),
  ...botellas('Vodka', [['Smirnoff No. 21', 550], ['Absolut Vodka', 700], ['Grey Goose', 1300], ['Belvedere', 1400]]),
  ...botellas('Whisky', [['Johnnie Walker Red Label', 700], ['Jack Daniel’s Old No. 7', 850], ['Johnnie Walker Black Label', 1050], ['Buchanan’s Deluxe 12', 1100]]),
  ...botellas('Brandy', [['Presidente Solera', 500], ['Torres 10', 650], ['Fundador', 700]]),

  // 2. Refrescos, aguas y mezcladores
  ...grupo('BEBIDA', 'Refrescos y aguas · Individuales', [
    ['Coca-Cola Original 355 ml', 35], ['Coca-Cola Sin Azúcar 355 ml', 35], ['Coca-Cola Light 355 ml', 35],
    ['Sprite 355 ml', 35], ['7Up 355 ml', 35], ['Squirt 355 ml', 35], ['Fresca 355 ml', 35],
    ['Peñafiel agua mineral', 35], ['Topo Chico agua mineral', 45], ['Schweppes Ginger Ale', 45],
    ['Agua tónica', 40], ['Agua natural (Ciel o Bonafont)', 25], ['Jugo (Jumex o Del Valle)', 35],
  ]),
  ...grupo('BEBIDA', 'Refrescos y aguas · Para compartir', [
    ['Coca-Cola Original 1.5 L', 65], ['Coca-Cola Original 2 L', 80], ['Sprite o Squirt 2 L', 80],
  ]),

  // 3. Botanas y frituras
  ...grupo('ALIMENTO', 'Botanas · Papas y frituras', [
    ['Sabritas Originales', 25], ['Doritos Nacho', 30], ['Takis Fuego', 30], ['Ruffles Queso', 30],
    ['Cheetos Torciditos', 25], ['Fritos Sal y Limón', 25],
  ]),
  ...grupo('ALIMENTO', 'Botanas · Cacahuates', [
    ['Cacahuates salados', 25], ['Cacahuates japoneses', 30], ['Cacahuates enchilados', 30],
    ['Cacahuates estilo cantinero', 35], ['Bowl grande de cacahuates', 85],
  ]),
  ...grupo('ALIMENTO', 'Botanas · Churritos (salados)', [
    ['Churritos naturales', 25], ['Churritos con chile y limón', 30], ['Churritos preparados', 40],
    ['Charola de churritos para compartir', 100],
  ]),
  ...grupo('ALIMENTO', 'Botanas · Para compartir', [['Charola mixta de botanas', 120]]),

  // 4. Paquetes por tipo de sala (no incluyen la renta de la sala)
  { nombre: 'Moon Mini', categoria: 'PAQUETE', seccion: 'Paquetes', precio: 399, tipoSala: 'PEQUENA',
    descripcion: '1 Coca-Cola de 2 L\n2 bolsas de frituras a elegir\n1 porción de cacahuates' },
  { nombre: 'Moon Mini Drinks', categoria: 'PAQUETE', seccion: 'Paquetes', precio: 699, tipoSala: 'PEQUENA', alcohol: true,
    descripcion: '1 botella de Bacardí Carta Blanca\n3 refrescos de 355 ml\n2 bolsas de frituras a elegir\n1 porción de cacahuates' },
  { nombre: 'Moon Friends', categoria: 'PAQUETE', seccion: 'Paquetes', precio: 599, tipoSala: 'MEDIANA',
    descripcion: '1 Coca-Cola de 2 L\n1 Sprite de 2 L\n3 bolsas de frituras surtidas\n1 bowl grande de cacahuates\n1 porción de churritos con chile y limón' },
  { nombre: 'Moon Friends Drinks', categoria: 'PAQUETE', seccion: 'Paquetes', precio: 899, tipoSala: 'MEDIANA', alcohol: true,
    descripcion: '1 botella de Smirnoff No. 21\n4 refrescos de 355 ml\n3 bolsas de frituras surtidas\n1 porción de cacahuates\n1 porción de churritos' },
  { nombre: 'Premium Snacks', categoria: 'PAQUETE', seccion: 'Paquetes', precio: 899, tipoSala: 'PREMIUM',
    descripcion: '3 refrescos de 2 L\n5 bolsas de frituras surtidas\n2 bowls grandes de cacahuates\n2 porciones de churritos preparados' },
  { nombre: 'Moon VIP Drinks', categoria: 'PAQUETE', seccion: 'Paquetes', precio: 1399, tipoSala: 'PREMIUM', alcohol: true,
    descripcion: '1 botella de Jack Daniel’s Old No. 7 o José Cuervo Tradicional (a elección)\n6 refrescos de 355 ml\n4 bolsas de frituras surtidas\n1 bowl grande de cacahuates\n1 porción de churritos' },
]
