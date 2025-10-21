// app/api/factors/route.ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Factors = {
  views24hPct?: number;
  coeff?: Record<string, number>;
  note?: string;
  updatedAt?: string;
};

export async function GET() {
  // 1) prefer public/factors.txt
  const txtPath = path.join(process.cwd(), "public", "factors.txt");
  // 2) fallback a data/factors.json
  const jsonPath = path.join(process.cwd(), "data", "factors.json");

  const headers = { "Cache-Control": "no-store" };

  async function readAndParseJSON(p: string) {
    const raw = await fs.readFile(p, "utf8");
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("JSON inválido");
    }
  }

  try {
    let data: any;
    try {
      data = await readAndParseJSON(txtPath);
    } catch (eTxt: any) {
      // fallback a JSON en /data
      data = await readAndParseJSON(jsonPath);
    }

    const out: Factors = {
      views24hPct: typeof data.views24hPct === "number" ? data.views24hPct : undefined,
      coeff: typeof data.coeff === "object" && data.coeff ? data.coeff : undefined,
      note: typeof data.note === "string" ? data.note : undefined,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    };

    return NextResponse.json(out, { headers });
  } catch (err: any) {
    const code = err?.code === "ENOENT" ? 404 : 500;
    const msg =
      err?.code === "ENOENT"
        ? "No se encontró factors.txt ni factors.json."
        : (err?.message || "Error leyendo factors.");
    return NextResponse.json({ error: msg }, { status: code, headers });
  }
}
