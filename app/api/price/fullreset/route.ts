// app/api/price/fullreset/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

import { BASE_DEFAULTS } from "../base-prices";
import { updateIndicators } from "../update-indicators";
import { priceState } from "../state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    // 4️⃣ Forzar que /api/price lea Value.price en vez de velas
    priceState.forceValuePrice = true;

    console.timeEnd("⏱ FullReset Price API");

    return NextResponse.json({
      ok: true,
      reset: true,
      message: `Se restablecieron ${updated} valores (usando factores actualizados).`,
      prices: DEFAULTS,
    });
  } catch (err) {
    console.error("❌ Error en /api/price/fullreset:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
