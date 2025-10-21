// app/api/signals/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Señales de ejemplo */
export async function GET() {
  const todayKey = new Date().toISOString().slice(0, 10);

  const signals = {
    groupAvg: 78,
    workers: { baumxp: 82, dsgmxp: 74, rftmxp: 88 },
    demand: { krimxp: 12, grmmxp: 6, litmxp: 10, hormxp: 4 },
    participations: { SON: 28, SAM: 31, expected: 35, eta: 0.05 },
    redemptionsScore: 0.02,
    youtubeScore: 0.03,
    dayKey: todayKey,
  };

  return NextResponse.json(signals, { status: 200, headers: { "Cache-Control": "no-store" } });
}
