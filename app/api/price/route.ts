import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// ====== CONFIG GENERAL ======
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ====== CATALOGO BASE (fallback) ======
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

// ====== ESTADO EN MEMORIA ======
export const state = {
  lastPrices: new Map<string, number>(),
  lastUpdate: Date.now(),
};

// ====== MAIN HANDLER ======
export async function GET(req: Request) {
  console.time("⏱ Price API");

  try {
    // 1️⃣ Intenta leer precios reales desde la BD
    const dbValues = await prisma.value.findMany({
      select: { id: true, price: true },
    });

    // Limpia el mapa de memoria
    state.lastPrices.clear();

    // 2️⃣ Carga los precios desde BD o fallback
    for (const [id, val] of Object.entries(DEFAULTS)) {
      const dbVal = dbValues.find((v) => v.id === id);
      const finalPrice = dbVal?.price ?? val;
      state.lastPrices.set(id, finalPrice);
    }

    // 3️⃣ Prepara salida
    const prices: Record<string, number> = {};
    for (const [id, price] of state.lastPrices.entries()) {
      prices[id] = price;
    }

    state.lastUpdate = Date.now();

    console.timeEnd("⏱ Price API");
    return NextResponse.json({
      ok: true,
      total: Object.keys(prices).length,
      lastUpdate: new Date(state.lastUpdate).toISOString(),
      prices,
    });
  } catch (err) {
    console.error("❌ Error en /api/price:", err);
    return NextResponse.json({ ok: false, error: "Error interno en Price API" }, { status: 500 });
  }
}
