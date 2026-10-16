// Alta del personal con llave de acceso de 8 dígitos (npm run personal:crear).
// - Crea a cada trabajador de la lista con rol de Administración y una llave al azar, que se muestra UNA sola vez
//   en esta terminal (en la base solo queda su hash). Si el trabajador ya tiene llave, no se toca.
// - Crea la cuenta del Súper administrador (control total: llaves del personal y turnos) si aún no existe.
// - Desactiva las cuentas anteriores por área (correo + contraseña): ya no pueden entrar y sus sesiones se cierran.
//   No se borran, para conservar el historial de quién hizo cada operación.
// Es seguro volver a ejecutarlo. Para cambiar la llave de alguien después, el súper administrador usa "Personal".
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { nuevaLlave } from '../src/llaves'

const PERSONAL = ['Teobaldo', 'Isa', 'Daniel', 'Susy', 'Johan', 'Tadeo', 'Ari']
const SUPER = 'Súper administrador'
const prisma = new PrismaClient()

async function main() {
  const nuevas: [string, string][] = []
  for (const nombre of PERSONAL) {
    const existe = await prisma.usuario.findFirst({ where: { nombre, llaveHash: { not: null } } })
    if (existe) { console.log(`· ${nombre}: ya tiene llave (sin cambios)`); continue }
    const llave = nuevaLlave()
    await prisma.usuario.create({ data: { nombre, rol: 'ADMIN', llaveHash: await bcrypt.hash(llave, 12) } })
    nuevas.push([nombre, llave])
  }
  if (!(await prisma.usuario.findFirst({ where: { rol: 'SUPERADMIN', activo: true, llaveHash: { not: null } } }))) {
    const llave = nuevaLlave()
    await prisma.usuario.create({ data: { nombre: SUPER, rol: 'SUPERADMIN', llaveHash: await bcrypt.hash(llave, 12) } })
    nuevas.unshift([SUPER, llave])
  } else console.log(`· ${SUPER}: ya existe (sin cambios)`)
  const viejas = await prisma.usuario.updateMany({ where: { llaveHash: null, activo: true }, data: { activo: false } })
  await prisma.sesion.deleteMany({ where: { usuario: { activo: false } } })

  console.log(`\nCuentas anteriores por área desactivadas: ${viejas.count}`)
  if (nuevas.length) {
    console.log('\nLLAVES DE ACCESO (se muestran solo esta vez; entrégalas a cada persona y no las guardes en el repositorio):')
    for (const [nombre, llave] of nuevas) console.log(`  ${nombre.padEnd(20)} ${llave}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
