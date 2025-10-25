// app/api/portfolio/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSessionUser } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: Number(user.id) },
    include: {
      positions: true,
      txs: { orderBy: { ts: "desc" }, take: 20 },
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    points: dbUser.points,
    positions: dbUser.positions,
    txs: dbUser.txs,
  });
}
