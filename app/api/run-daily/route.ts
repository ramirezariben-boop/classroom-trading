// app/api/run-daily/route.ts
import { NextResponse } from "next/server";
import { runDailyUpdate } from "@/lib/engine/pricing"; // o ruta relativa

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const state = runDailyUpdate();
    return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("run-daily failed:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.stack || err?.message || err) },
      { status: 500 }
    );
  }
}

export async function GET() { return POST(); }
