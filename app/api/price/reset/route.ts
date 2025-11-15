// app/api/price/reset/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

import { BASE_DEFAULTS } from "../base-prices";
import { updateIndicators } from "../update-indicators";
import { priceState } from "../state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  console.time("⏱ Reset Price API");

  // 🔥 Asegurar que no siga modo velas
  priceState.forceValuePrice = false;

  // 1️⃣ Copia base
  let DEFAULTS = { ...BASE_DEFAULTS };

  // 2️⃣ Indicadores
  DEFAULTS = await updateIndicators(DEFAULTS);

  // 3️⃣ Guardar en BD
  for (const [id, base] of Object.entries(DEFAULTS)) {
    await prisma.value.updateMany({
      where: { id },
      data: { price: base },
    });
  }

  // 4️⃣ Activar que PRICE lea DB
  priceState.forceValuePrice = true;

  console.timeEnd("⏱ Reset Price API");

  return NextResponse.json({
    ok: true,
    reset: true,
    message: "Precios restablecidos usando BASE_DEFAULTS + indicadores.",
    prices: DEFAULTS,
  });
}
