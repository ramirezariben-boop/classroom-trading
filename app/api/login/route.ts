// app/api/login/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { signSession } from '../../../lib/auth'
// Si validas pin/hash, descomenta bcrypt:
// import bcrypt from 'bcrypt'

// Lee ADMIN_IDS del .env para resolver el rol
function resolveRole(userId: string): 'ADMIN' | 'USER' {
  const raw = process.env.ADMIN_IDS || ''
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
  return ids.includes(userId) ? 'ADMIN' : 'USER'
}

export async function POST(req: Request) {
  const { userId, code } = await req.json()

  if (!userId || !code) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // Busca al usuario en BD
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'Usuario no existe' }, { status: 401 })
  }

  // === Validación del código ===
  // Opción 1: texto plano (si guardas el code como string en BD)
  if ((user as any).code && (user as any).code !== code) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }

  // Opción 2: hash (si tienes user.codeHash)
  // const ok = await bcrypt.compare(code, user.codeHash)
  // if (!ok) return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })

  // Resuelve rol por .env
  const role = resolveRole(user.id)

  // Firma cookie de sesión con role
  const token = signSession({ uid: user.id, name: user.name, role })
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role }, // <-- la UI necesita este role
  })

  // Setea cookie
  res.cookies.set('ct_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return res
}
