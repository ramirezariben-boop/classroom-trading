// app/api/candles/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  // body: { candles: Array<{ticker,timeframe,ts,open,high,low,close,volume?}> }
  const candles = body?.candles ?? [];
  if (!Array.isArray(candles) || candles.length === 0)
    return NextResponse.json({ inserted: 0 });

  // upsert por (ticker,timeframe,ts)
  await prisma.$transaction(
    candles.map(c => prisma.candle.upsert({
      where: { ticker_timeframe_ts: { ticker: c.ticker, timeframe: c.timeframe, ts: new Date(c.ts) } },
      create: { ...c, ts: new Date(c.ts) },
      update: { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? null }
    }))
  );

  return NextResponse.json({ inserted: candles.length });
}
