// Horario planeado del personal. Cada día abierto tiene dos turnos que cubren todo el horario del negocio
// (12:00 a 02:00) y en cada turno una persona por área: Planta baja (recepción y bar) y Salas (pisos 2 y 3).
// El súper administrador lo edita; la propuesta inicial reparte parejo y nadie repite turno el mismo día.
import type { AreaTrabajo, Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export const TURNOS = [
  { n: 1, inicio: '12:00', fin: '19:00' },
  { n: 2, inicio: '19:00', fin: '02:00' },
] as const
export const AREAS: AreaTrabajo[] = ['PLANTA_BAJA', 'SALAS']
export const HORAS_TURNO = 7

/** Días que abre el negocio, de lunes a domingo (0 = domingo va al final). */
export async function diasAbiertos(db: Db) {
  const hs = await db.horarioOperacion.findMany({ where: { activo: true }, select: { diaSemana: true } })
  return hs.map((h) => h.diaSemana).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
}

/** Quién puede tener horario: el personal activo con llave, sin las súper administradoras. */
export const asignables = (db: Db) =>
  db.usuario.findMany({
    where: { activo: true, llaveHash: { not: null }, rol: { not: 'SUPERADMIN' } },
    select: { id: true, nombre: true }, orderBy: { nombre: 'asc' },
  })

/** Reparto parejo: cada día toma a las siguientes personas del recorrido (con 4 lugares por día y al menos
 *  4 personas, nadie repite el mismo día) y las acomoda corridas un lugar por día, para que cada quien
 *  alterne turno y área a lo largo de la semana. */
export function propuesta(dias: number[], personal: { id: number }[]) {
  if (!personal.length) return []
  const porDia = TURNOS.length * AREAS.length
  return dias.flatMap((diaSemana, d) => TURNOS.flatMap((t, ti) => AREAS.map((area, ai) => {
    const lugar = (ti * AREAS.length + ai + d) % porDia // posición corrida según el día
    return { diaSemana, turno: t.n, area, usuarioId: personal[(d * porDia + lugar) % personal.length].id }
  })))
}
