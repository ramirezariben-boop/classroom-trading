// app/api/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").map((x) => x.trim().toLowerCase());

export async function POST(req: Request) {
  const { userId, code } = await req.json();

  console.log("📥 LOGIN:", { userId, code });

  if (!userId || !code)
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
  });

  if (!user)
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const isValid =
    user.password === code ||
    (await bcrypt.compare(String(code), user.password));

  if (!isValid)
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });

  // 🧩 Determinar si es admin
  const isAdmin =
    ADMIN_IDS.includes(String(user.id).toLowerCase()) ||
    ADMIN_IDS.includes(String(user.name).toLowerCase());

  const role = isAdmin ? "ADMIN" : "USER";

  const token = jwt.sign(
    { id: user.id, name: user.name, role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

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
