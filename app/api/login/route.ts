// app/api/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
// ⬇️ AJUSTA a donde esté tu prisma:
import { prisma } from "@/app/lib/prisma"; // o: "@/lib/prisma"

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deriva el rol desde ADMIN_IDS (sin tocar la DB)
function roleOf(id: string): "ADMIN" | "USER" {
  const list = (process.env.ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(id) ? "ADMIN" : "USER";
}

export async function POST(req: Request) {
  try {
    const { userId, code } = await req.json();

    if (!userId || !code) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const ok = await bcrypt.compare(code, user.codeHash);
    if (!ok) {
      return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
    }

    const role = roleOf(user.id);

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, role },
    });

    // Cookie de sesión
    res.cookies.set("ct_session", JSON.stringify({ id: user.id, role }), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    return res;
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Error en login" }, { status: 500 });
  }
}
