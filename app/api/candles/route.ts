import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker") ?? "BAUMXP";
  const timeframe = searchParams.get("tf") ?? "1m";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Number(searchParams.get("limit") ?? 2000);

  const where: any = { ticker, timeframe };
  if (from || to) where.ts = {};
  if (from) where.ts.gte = new Date(from);
  if (to) where.ts.lte = new Date(to);

  const rows = await prisma.candle.findMany({
    where,
    orderBy: { ts: "asc" },
    take: limit,
  });

  return NextResponse.json({ candles: rows });
}
