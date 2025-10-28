import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 🔄 Leemos directamente los datos actuales de la base
    const users = await prisma.user.findMany({
      select: { id: true, name: true, points: true },
      orderBy: { points: "desc" },
      take: 5, // top 5
    });

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      top5: users.map(u => ({
        id: u.id,
        user: u.name,
        points: u.points,
      })),
    });
  } catch (err: any) {
    console.error("Error en /api/top:", err);
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 });
  }
}
