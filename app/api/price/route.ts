// app/api/price/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

import { BASE_DEFAULTS } from "./base-prices";
import { priceState } from "./state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const DEFAULTS = { ...BASE_DEFAULTS };
    const result: Record<string, number> = {};

    for (const id of Object.keys(DEFAULTS)) {

      // 🔥 MODO RESET: usar Value.price
      if (priceState.forceValuePrice) {
        const row = await prisma.value.findUnique({
          where: { id },
          select: { price: true }
        });

        result[id] = row?.price ?? DEFAULTS[id];
        continue;
      }

      // 🟢 MODO NORMAL: velas
      const lastCandle = await prisma.candle.findFirst({
        where: { valueId: id },
        orderBy: { time: "desc" },
      });

      result[id] = lastCandle?.close ?? DEFAULTS[id];
    }

    return NextResponse.json({ ok: true, prices: result });

  } catch (err) {
    console.error("❌ Error en Price API:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
