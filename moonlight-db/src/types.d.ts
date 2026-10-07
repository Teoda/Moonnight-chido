import type { Sesion, Usuario, Cliente } from '@prisma/client'
declare global {
  namespace Express {
    interface Request { auth?: { token: string; sesion: Sesion; usuario?: Usuario; cliente?: Cliente } }
  }
}
export {}
