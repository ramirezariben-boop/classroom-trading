import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULTS: Record<string, number> = {
  baumxp: 126, dsgmxp: 110, rftmxp: 96,
  krimxp: 46, grmmxp: 46, litmxp: 53, hormxp: 57,
  sonmxp: 1.32, sammxp: 1.08,
  anwmpx: 86.03,
  xhamxp: 2.95,
  aufmxp: 90.63,
  notmxp: 81.01,
  zhnmxp: 13.4, anlmxp: 1.05,
  gzehntel: 13.4, gkrimi: 46, ggramm: 46, glit: 53, ghor: 57,
};

export async function GET() {
  try {
    const result: Record<string, number> = {};

    // 1️⃣ Recorremos cada valor posible del catálogo
    for (const id of Object.keys(DEFAULTS)) {

      // Buscar la ÚLTIMA vela
      const lastCandle = await prisma.candle.findFirst({
        where: { valueId: id },
        orderBy: { time: "desc" },
      });

      if (lastCandle) {
        // Si hay vela → usamos su CLOSE REAL
        result[id] = lastCandle.close;
      } else {
        // Si no hay nada → fallback
        result[id] = DEFAULTS[id];
      }
    }

    return NextResponse.json({ ok: true, prices: result });

  } catch (err) {
    console.error("❌ Error en Price API:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
