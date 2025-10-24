// app/api/candles/capture/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getLivePrice } from "@/lib/price"; // tu función real

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker") ?? "BAUMXP";
  const timeframe = searchParams.get("tf") ?? "1m";

  // 1) Precio actual
  const price = await getLivePrice(ticker); // devuelve número

  // 2) Redondea ts al inicio del minuto
  const now = new Date();
  const ts = new Date(now);
  ts.setSeconds(0, 0);

  // 3) Upsert de la vela (OHLC)
  await prisma.candle.upsert({
    where: { ticker_timeframe_ts: { ticker, timeframe, ts } },
    create: { ticker, timeframe, ts, open: price, high: price, low: price, close: price },
    update: {
      high: { set: prisma.raw`GREATEST(high, ${price})` as any }, // o calcula en JS
      low:  { set: prisma.raw`LEAST(low, ${price})`  as any },
      close: price
    }
  });

  return NextResponse.json({ ok: true, ts });
}
