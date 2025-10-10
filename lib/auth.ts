// lib/auth.ts
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SECRET = process.env.JWT_SECRET || "dev_secret";

/** Lee y valida la cookie ct_session */
export async function readSessionFromHeaders() {
  const cookieStore = await cookies(); // en Vercel es Promise<RequestCookies>
  const token = cookieStore.get("ct_session")?.value;
  if (!token) throw new Error("unauthorized");
  try {
    return jwt.verify(token, SECRET) as { uid: string; role: "ADMIN" | "USER" };
  } catch {
    throw new Error("unauthorized");
  }
}

/** Exige ADMIN (útil para endpoints protegidos) */
export async function requireAdmin() {
  const sess = await readSessionFromHeaders();
  if (sess.role !== "ADMIN") throw new Error("forbidden");
  return sess;
}

/** Firma sesión y **setea cookie** ct_session en la respuesta dada */
export function signSession(
  res: NextResponse,
  payload: { uid: string; role: "ADMIN" | "USER" },
  maxAgeDays = 30
) {
  const token = jwt.sign(payload, SECRET, { expiresIn: `${maxAgeDays}d` });
  res.cookies.set("ct_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  });
  return res;
}

/** Borra la cookie de sesión */
export function clearSession(res: NextResponse) {
  res.cookies.delete("ct_session");
  return res;
}
