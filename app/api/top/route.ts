// app/api/top/route.ts
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

    if (!users.length)
      return NextResponse.json({ ok: false, top5: [] }, { status: 200 });

    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      top5: users.map((u) => ({
        id: u.id,
        user: u.name,
        points: Number(u.points ?? 0),
      })),
    };

    // ✅ cache control
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err: any) {
    console.error("❌ Error en /api/top:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
