// app/api/run-daily/route.ts
import { NextResponse } from "next/server";
import { runDailyUpdate } from "@/lib/engine/pricing"; // si no tienes alias "@", usa ruta relativa: "../../lib/engine/pricing"

export async function POST() {
  try {
    const state = runDailyUpdate();
    return NextResponse.json({ ok: true, state });
  } catch (err: any) {
    console.error("run-daily failed:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.stack || err?.message || err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Permite probar desde el navegador
  return POST();
}
