// app/api/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers"; // 👈 agregado para manejar la cookie de sesión

export async function POST(req: Request) {
  const body = await req.json();

  console.log("📥 BODY RECIBIDO:", body);

  // Acepta diferentes nombres posibles
  const id =
    body.id ||
    body.user ||
    body.username ||
    body.userid ||
    body.userId;

  const nip =
    body.nip ||
    body.password ||
    body.clave ||
    body.code;

  if (!id || !nip) {
    console.log("⚠️ Datos incompletos:", { id, nip });
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // Busca al usuario por ID (numérico)
  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
  });

  if (!user) {
    console.log("❌ Usuario no encontrado:", id);
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Compara el NIP con el hash bcrypt guardado
  const isValid = await bcrypt.compare(String(nip), user.password);

  if (!isValid) {
    console.log("❌ Credenciales incorrectas:", { id, nip });
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  console.log("✅ Login exitoso:", id);

  // 🔹 Guarda cookie de sesión (segura y accesible solo en el servidor)
  const res = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      points: user.points,
    },
  });

  res.cookies.set("userId", String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production" ? true : false,
  });

  return res;
}
