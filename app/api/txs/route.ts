// app/api/txs/route.ts
import { NextResponse } from "next/server";

// Transacciones “globales” en memoria
const GLOBAL_TXS = [
  { id: "tx1", ts: new Date().toISOString(), type: "BUY", valueId: "baumxp", qty: 3, deltaPts: -435, userId: "ana01", userName: "Ana" },
  { id: "tx2", ts: new Date().toISOString(), type: "SELL", valueId: "grmmxp", qty: 1, deltaPts: +40, userId: "luis03", userName: "Luis" },
  { id: "tx3", ts: new Date().toISOString(), type: "TRANSFER_OUT", valueId: "baumxp", qty: 1, deltaPts: -100, userId: "ben_admin", userName: "Ben" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "me";

  // Devuelve todas si el scope = all
  const txs = scope === "all" ? GLOBAL_TXS : GLOBAL_TXS.filter((t) => t.userId === "ana01");
  return NextResponse.json({ txs });
}
