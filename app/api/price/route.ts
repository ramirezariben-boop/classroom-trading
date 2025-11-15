// app/api/price/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

import { BASE_DEFAULTS } from "./base-prices";
import { updateIndicators } from "./update-indicators";
import { priceState } from "./state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Copia fresca de valores base
    let DEFAULTS = { ...BASE_DEFAULTS };

    // Aplicar indicadores (si existen)
    DEFAULTS = await updateIndicators(DEFAULTS);

    const result: Record<string, number> = {};

    for (const id of Object.keys(DEFAULTS)) {

      // 🔥 → Si estamos en modo reset, usar Value.price directo
      if (priceState.forceValuePrice) {
        const row = await prisma.value.findUnique({
          where: { id },
          select: { price: true },
        });

        result[id] = row?.price ?? DEFAULTS[id];
        continue;
      }

      // 🟢 → Modo normal: usar velas
      const lastCandle = await prisma.candle.findFirst({
        where: { valueId: id },
        orderBy: { time: "desc" },
      });

      if (lastCandle) {
        result[id] = lastCandle.close;
      } else {
        // Si no hay vela, usar DEFAULTS (base calculado)
        result[id] = DEFAULTS[id];
      }
    }

    return NextResponse.json({ ok: true, prices: result });
  } catch (err) {
    console.error("❌ Error en Price API:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
