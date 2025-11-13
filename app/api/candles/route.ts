import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/candles?id=baumxp&tf=5m&limit=1500
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const tf = searchParams.get("tf");
    const limit = Number(searchParams.get("limit") || 500);

    if (!id || !tf) {
      return NextResponse.json({ candles: [] });
    }

    const rows = await prisma.candle.findMany({
      where: {
        valueId: id,
        timeframe: tf,
      },
      orderBy: { time: "asc" },
      take: limit,
    });

    // Convertimos a segundos unix (TradingView estándar)
    const candles = rows.map((r) => ({
      time: r.time.getTime(),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    }));

    return NextResponse.json({ candles });
  } catch (err) {
    console.error("❌ Error /api/candles:", err);
    return NextResponse.json({ candles: [] });
  }
}
