import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { readSessionFromHeaders } from "../../../lib/auth";

export async function GET() {
  try {
    const { uid } = await readSessionFromHeaders();

    const [user, positions, txs] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid } }),
      prisma.position.findMany({ where: { userId: uid } }),
      prisma.tx.findMany({ where: { userId: uid }, orderBy: { ts: "desc" }, take: 100 }),
    ]);

    return NextResponse.json({
      points: user?.points ?? 0,
      positions,
      txs,
    });
  } catch (e: any) {
    const msg = e?.message === "unauthorized" ? 401 : 500;
    return new Response(e?.message || "error", { status: msg });
  }
}
