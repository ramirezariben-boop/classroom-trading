import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, points: true }
    });

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    console.error("❌ Error en /api/users:", err);
    return NextResponse.json({ ok: false, error: "Error interno" });
  }
}
