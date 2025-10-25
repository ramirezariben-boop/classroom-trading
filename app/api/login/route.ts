import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: Request) {
  const { userId, code } = await req.json();

  console.log("📥 LOGIN:", { userId, code });

  if (!userId || !code)
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
  });

  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // compara nip (sin hash si lo guardaste plano)
  const isValid =
    user.password === code ||
    (await bcrypt.compare(String(code), user.password));

  if (!isValid)
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });

  const token = jwt.sign(
    { id: user.id, name: user.name, role: "USER" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const res = NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, role: "USER" },
  });

  // crea cookie JWT segura
  res.cookies.set({
    name: "session_token",
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  return res;
}
