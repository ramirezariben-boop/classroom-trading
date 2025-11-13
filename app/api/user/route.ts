import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta el id" });
    }

    // busca el usuario por ID NUMÉRICO
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, points: true }
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error("Error en /api/user:", err);
    return NextResponse.json({ ok: false, error: "Error interno" });
  }
}
