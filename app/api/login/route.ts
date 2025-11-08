// app/api/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").map((x) => x.trim().toLowerCase());

export async function POST(req: Request) {
  const { userId, code } = await req.json();

  console.log("📥 LOGIN:", { userId, code });

  if (!userId || !code)
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

  // 🔹 Buscar usuario por ID numérico
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
  });

  if (!user)
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // 🔹 Validar contra el NIP (no contra password)
  const isValid = String(user.nip ?? user.password ?? "") === String(code).trim();

  if (!isValid)
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });

  // 🧩 Rol admin
  const isAdmin =
    ADMIN_IDS.includes(String(user.id).toLowerCase()) ||
    ADMIN_IDS.includes(String(user.name).toLowerCase());
  const role = isAdmin ? "ADMIN" : "USER";

  // 🔹 Crear token
  const token = jwt.sign(
    { id: user.id, name: user.name, role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  // 🔹 Enviar respuesta con cookie de sesión
  const res = NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, role },
  });

  res.cookies.set({
    name: "session_token",
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
