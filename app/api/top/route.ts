import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { NOT: { id: 64 } },
      orderBy: { points: "desc" },
      take: 5,
      select: { id: true, name: true, points: true },
    });

    if (!users || users.length === 0) {
      return NextResponse.json(
        { ok: false, top5: [], message: "No hay usuarios registrados." },
        { status: 200 }
      );
    }

    const now = new Date();

    const payload = {
      ok: true,
      generatedAt: now.toISOString(),
      nextUpdate: null,
      top5: users.map((u) => ({
        id: u.id,
        user: u.name,
        points: Number(u.points ?? 0),
      })),
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("❌ Error en /api/top:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
