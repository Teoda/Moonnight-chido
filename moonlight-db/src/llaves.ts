// Llaves de acceso del personal: 8 dígitos al azar (generador criptográfico).
import { randomInt } from 'node:crypto'

export const nuevaLlave = () => String(randomInt(0, 100_000_000)).padStart(8, '0')
