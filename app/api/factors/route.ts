// app/api/factors/route.ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

type Factors = {
  views24hPct?: number;
  coeff?: Record<string, number>;
  note?: string;
  updatedAt?: string;
};

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "factors.txt");

  try {
    const raw = await fs.readFile(filePath, "utf8");

    // Intenta parsear como JSON
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "El archivo factors.txt no contiene JSON válido." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Sanitiza/valida lo básico
    const out: Factors = {
      views24hPct: typeof data.views24hPct === "number" ? data.views24hPct : undefined,
      coeff: typeof data.coeff === "object" && data.coeff ? data.coeff : undefined,
      note: typeof data.note === "string" ? data.note : undefined,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    };

    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return NextResponse.json(
        { error: "No se encontró /public/factors.txt." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Error leyendo factors.txt." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
