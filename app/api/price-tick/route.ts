import { NextResponse } from "next/server";

// ===== Utilidad =====
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ===== Valores base =====
const DEFAULTS: Record<string, number> = {
  baumxp: 110, dsgmxp: 95, rftmxp: 90,
  krimxp: 42, grmmxp: 41, litmxp: 50, hormxp: 56,
  sonmxp: 1.2, sammxp: 0.99,
  zhnmxp: 12.8, anlmxp: 1,
};

// ===== Estado persistente (solo local, se reinicia al cerrar el servidor) =====
const state =
  (globalThis as any).__PRICE_TICK_STATE__ ??
  ((globalThis as any).__PRICE_TICK_STATE__ = {
    prices: new Map<string, number>(),
    trends: new Map<string, number>(),
    lastTick: 0,
  });

// ===== Handler =====
export async function GET() {
  const now = Date.now();
  const dt = now - state.lastTick;
  const update = dt >= 1000; // actualiza al menos cada segundo
  state.lastTick = now;

  for (const [id, base] of Object.entries(DEFAULTS)) {
    const prev = state.prices.get(id) ?? base;
    const trend = state.trends.get(id) ?? 0;

    // ruido leve (normal)
    const sigma = 0.003; // ±0.3 %
    const noise = randn() * sigma * prev;

    // inercia: tendencia a continuar un poco en la dirección anterior
    const newTrend = 0.9 * trend + 0.1 * noise;
    const newPrice = prev + newTrend;

    state.prices.set(id, +(Math.max(0, newPrice).toFixed(base < 2 ? 4 : 2)));
    state.trends.set(id, newTrend);
  }

  const prices: Record<string, number> = {};
  for (const [id, value] of state.prices.entries()) {
    prices[id] = value;
  }

fetch("http://localhost:3000/api/price?key=dev").catch(() => {});

  return NextResponse.json({ prices, ts: now });
}

