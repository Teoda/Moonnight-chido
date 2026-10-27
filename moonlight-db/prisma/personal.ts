// Alta del personal con llave de acceso de 8 dígitos (npm run personal:crear).
// - Crea a cada trabajador de la lista con rol de Administración y una llave al azar, que se muestra UNA sola vez
//   en esta terminal (en la base solo queda su hash). Si el trabajador ya tiene llave, no se toca.
// - Crea a cada súper administradora de la lista (Agenda, Salas, Finanzas, Reportes, Paneles solares; llaves del
//   personal y turnos), también con su propia llave. La cuenta genérica "Súper administrador" se desactiva.
// - Desactiva las cuentas anteriores por área (correo + contraseña): ya no pueden entrar y sus sesiones se cierran.
//   No se borran, para conservar el historial de quién hizo cada operación.
// Es seguro volver a ejecutarlo. Para cambiar la llave de alguien después, el súper administrador usa "Personal".
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, type Rol } from '@prisma/client'
import { nuevaLlave } from '../src/llaves'

const PERSONAL = ['Teobaldo', 'Isa', 'Daniel', 'Susy', 'Johan', 'Tadeo', 'Ari']
const SUPERADMINS = ['Johana S.', 'Naomi R.', 'Estefania L.', 'Esmeralda G.', 'Eliangel V.', 'Jocelyn C.']
const SUPER_GENERICO = 'Súper administrador'
const prisma = new PrismaClient()

async function main() {
  const nuevas: [string, string][] = []
  const alta = async (nombre: string, rol: Rol) => {
    const existe = await prisma.usuario.findFirst({ where: { nombre, llaveHash: { not: null } } })
    if (existe) return void console.log(`· ${nombre}: ya tiene llave (sin cambios)`)
    const llave = nuevaLlave()
    await prisma.usuario.create({ data: { nombre, rol, llaveHash: await bcrypt.hash(llave, 12) } })
    nuevas.push([nombre, llave])
  }
  for (const nombre of SUPERADMINS) await alta(nombre, 'SUPERADMIN')
  for (const nombre of PERSONAL) await alta(nombre, 'ADMIN')

  const generico = await prisma.usuario.updateMany({ where: { nombre: SUPER_GENERICO, rol: 'SUPERADMIN', activo: true }, data: { activo: false } })
  if (generico.count) console.log(`· ${SUPER_GENERICO}: cuenta genérica desactivada`)
  const viejas = await prisma.usuario.updateMany({ where: { llaveHash: null, activo: true }, data: { activo: false } })
  await prisma.sesion.deleteMany({ where: { usuario: { activo: false } } })

  console.log(`\nCuentas anteriores por área desactivadas: ${viejas.count}`)
  if (nuevas.length) {
    console.log('\nLLAVES DE ACCESO (se muestran solo esta vez; entrégalas a cada persona y no las guardes en el repositorio):')
    for (const [nombre, llave] of nuevas) console.log(`  ${nombre.padEnd(20)} ${llave}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
