// app/api/portfolio/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Datos en memoria para demo
let demoPortfolio = {
  points: 1500,
  positions: [
    { userId: "ana01", valueId: "baumxp", qty: 3 },
    { userId: "ana01", valueId: "litmxp", qty: 2 },
  ],
  txs: [
    { id: "t1", ts: new Date().toISOString(), type: "BUY", valueId: "baumxp", qty: 3, deltaPts: -435 },
    { id: "t2", ts: new Date().toISOString(), type: "BUY", valueId: "litmxp", qty: 2, deltaPts: -140 },
  ],
};

export async function GET() {
  return NextResponse.json(demoPortfolio, { headers: { "Cache-Control": "no-store" } });
}
