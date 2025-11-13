import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idString = searchParams.get("id");

    if (!idString) {
      return NextResponse.json({ ok: false, error: "Falta el id" });
    }

    const id = Number(idString);

    if (isNaN(id)) {
      return NextResponse.json({ ok: false, error: "ID inválido" });
    }

    const user = await prisma.user.findUnique({
      where: { id }, // tu id es INT, así que esto es perfecto
      select: { id: true, name: true, points: true }
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuario no encontrado" });
    }

    return NextResponse.json({ ok: true, user });

  } catch (err) {
    console.error("❌ Error interno en /api/user:", err);
    return NextResponse.json({ ok: false, error: "Error interno" });
  }
}
