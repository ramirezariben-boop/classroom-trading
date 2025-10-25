import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * Lee la cookie JWT y devuelve el usuario si es válido.
 * Si no hay sesión válida, devuelve null.
 */
export function getSessionUser() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded; // contiene { id, name, role }
  } catch {
    return null;
  }
}
