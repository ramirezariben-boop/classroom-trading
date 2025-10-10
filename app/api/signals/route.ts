import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SIGNALS_PATH = path.join(process.cwd(), "data", "signals.json");

export async function GET() {
  try {
    const raw = await fs.readFile(SIGNALS_PATH, "utf8");
    // Evitar cache en Vercel/Next
    const res = NextResponse.json(JSON.parse(raw));
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    return res;
  } catch (e) {
    // Si no existe o está mal, devuelve valores seguros por defecto
    const fallback = {
      groupAvg: 75,
      workers: { baumxp: 80, dsgmxp: 70, rftmxp: 85 },
      demand: {},
      participations: { SON: 0, SAM: 0, expected: 35, eta: 0.04 }
    };
    const res = NextResponse.json(fallback);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
