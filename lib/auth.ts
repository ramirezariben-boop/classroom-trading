// lib/auth.ts
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const SECRET = process.env.JWT_SECRET || 'supersecret'

// Firma el JWT para la cookie de sesión
export function signSession(payload: { uid: string; name: string; role: 'ADMIN' | 'USER' }) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

// Lee y valida la cookie ct_session
export function readSessionFromHeaders(_headers?: Headers) {
  const token = cookies().get('ct_session')?.value
  if (!token) throw new Error('unauthorized')
  try {
    return jwt.verify(token, SECRET) as { uid: string; name: string; role: 'ADMIN' | 'USER' }
  } catch {
    throw new Error('unauthorized')
  }
}
