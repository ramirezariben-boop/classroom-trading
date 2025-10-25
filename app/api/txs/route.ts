// app/api/txs/route.ts
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

  const scope = user.role === "ADMIN" ? "all" : "me";

  const txs = await prisma.tx.findMany({
    where: scope === "me" ? { userId: Number(user.id) } : undefined,
    orderBy: { ts: "desc" },
    include: {
      user: { select: { name: true } },
    },
  });

  const mapped = txs.map((t) => ({
    id: t.id,
    ts: t.ts,
    type: t.type,
    valueId: t.valueId,
    qty: t.qty,
    deltaPts: t.deltaPts,
    userId: t.userId,
    userName: t.user?.name,
  }));

  return NextResponse.json({ txs: mapped });
}
