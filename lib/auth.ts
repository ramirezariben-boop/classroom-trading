// lib/auth.ts
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SECRET = process.env.JWT_SECRET || "dev_secret";

// Lee y valida la cookie ct_session
export async function readSessionFromHeaders() {
  // En Vercel/Next (tu versión) cookies() es Promise<RequestCookies>
  const cookieStore = await cookies();
  const token = cookieStore.get("ct_session")?.value;
  if (!token) throw new Error("unauthorized");

  try {
    return jwt.verify(token, SECRET) as { uid: string; role: "ADMIN" | "USER" };
  } catch {
    throw new Error("unauthorized");
  }
}

// Helper para exigir ADMIN (por si lo usas)
export async function requireAdmin() {
  const sess = await readSessionFromHeaders();
  if (sess.role !== "ADMIN") throw new Error("forbidden");
  return sess;
}
