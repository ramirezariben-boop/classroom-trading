// lib/auth.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const SECRET = process.env.JWT_SECRET || "dev_secret";
const COOKIE_NAME = "ct_session";

export type SessionPayload = {
  uid: string;
  name?: string;
  role: "ADMIN" | "USER";
};

/** Deriva el rol desde ADMIN_IDS en .env (coma-separado) */
function isAdminId(id: string) {
  const adminIds = (process.env.ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(id);
}

function deriveRole(uid: string): "ADMIN" | "USER" {
  return isAdminId(uid) ? "ADMIN" : "USER";
}

/** Firma un JWT con rol derivado y lo retorna */
export function signSessionToken(payload: { uid: string; name?: string }) {
  const role = deriveRole(payload.uid);
  const full: SessionPayload = { ...payload, role };
  return jwt.sign(full, SECRET, { expiresIn: "30d" });
}

/** Lee y valida la cookie ct_session; re-deriva role por si ADMIN_IDS cambió */
export async function readSessionFromHeaders(): Promise<SessionPayload> {
  const cookieStore = await cookies(); // en Vercel es Promise<RequestCookies>
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) throw new Error("unauthorized");
  try {
    const decoded = jwt.verify(token, SECRET) as SessionPayload;
    // Recalcula el rol (idempotente si no cambió ADMIN_IDS)
    const role = deriveRole(decoded.uid);
    return { ...decoded, role };
  } catch {
    throw new Error("unauthorized");
  }
}

/** Establece la cookie de sesión firmada (default 30 días) */
export function setSessionCookie(
  res: NextResponse,
  payload: { uid: string; name?: string },
  maxAgeDays = 30
) {
  const token = signSessionToken(payload);
  res.cookies.set(COOKIE_NAME, token, {
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
  res.cookies.delete(COOKIE_NAME);
  return res;
}

/** Helper para rutas protegidas de admin */
export async function requireAdmin(): Promise<SessionPayload | null> {
  try {
    const s = await readSessionFromHeaders();
    return s.role === "ADMIN" ? s : null;
  } catch {
    return null;
  }
}
