// app/api/price/fullreset/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

import { BASE_DEFAULTS } from "../base-prices";
import { updateIndicators } from "../update-indicators";
import { priceState } from "../state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// === HANDLER PRINCIPAL ===
export async function GET() {
  console.time("⏱ FullReset Price API");

  // 1️⃣ Copia inicial de los precios base
  let DEFAULTS = { ...BASE_DEFAULTS };

  // 2️⃣ Aplicar indicadores dinámicos
  DEFAULTS = await updateIndicators(DEFAULTS);

  // 3️⃣ Actualizar tabla Value con los nuevos precios base
  let updated = 0;
  for (const [id, base] of Object.entries(DEFAULTS)) {
    const res = await prisma.value.updateMany({
      where: { id },
      data: { price: base },
    });
    updated += res.count;
  }

  // 4️⃣ Reiniciar simulador en memoria
  priceState.lastPrices.clear();
  for (const [id, base] of Object.entries(DEFAULTS)) {
    priceState.lastPrices.set(id, base);
  }

  // 5️⃣ Forzar a usar los valores de la DB en /api/price
  priceState.forceValuePrice = true;

  console.timeEnd("⏱ FullReset Price API");

  return NextResponse.json({
    ok: true,
    reset: true,
    message: `Se restablecieron ${updated} valores + simulador reiniciado.`,
    prices: DEFAULTS,
  });
}
