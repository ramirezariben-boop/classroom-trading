// app/api/price/reset/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

import { BASE_DEFAULTS } from "../base-prices";
import { updateIndicators } from "../update-indicators";
import { priceState } from "../state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// === HANDLER PRINCIPAL ===
export async function GET() {
  console.time("⏱ Reset Price API");

  // 1️⃣ Copia de los precios base
  let DEFAULTS = { ...BASE_DEFAULTS };

  // 2️⃣ Aplicar indicadores dinámicos
  DEFAULTS = await updateIndicators(DEFAULTS);

  // 3️⃣ Guardar en la base de datos
  for (const [id, base] of Object.entries(DEFAULTS)) {
    await prisma.value.updateMany({
      where: { id },
      data: { price: base },
    });
  }

  // 4️⃣ Forzar a usar los precios guardados en BD
  priceState.forceValuePrice = true;

  console.timeEnd("⏱ Reset Price API");

  return NextResponse.json({
    ok: true,
    reset: true,
    message: "Precios restablecidos usando BASE_DEFAULTS + indicadores.",
    prices: DEFAULTS,
  });
}
