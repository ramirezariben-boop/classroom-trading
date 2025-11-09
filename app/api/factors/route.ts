// app/api/factors/route.ts
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== Cache en memoria (para reducir lecturas de disco) =====
let cached: any = null;
let lastRead = 0;

export async function GET() {
  try {
    const now = Date.now();
    if (cached && now - lastRead < 60_000) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "s-maxage=60" },
      });
    }

    // === Rutas de origen ===
    const jsonPath = path.join(process.cwd(), "data", "factors-daily.json");
    const txtPath = path.join(process.cwd(), "public", "factors.txt");

    let json: any = null;

    // === Intentar leer JSON principal ===
    try {
      const raw = await fs.readFile(jsonPath, "utf8");
      json = JSON.parse(raw);
    } catch {
      // === Si no existe, intentar leer el TXT público ===
      try {
        const txt = await fs.readFile(txtPath, "utf8");
        json = parseTxtToJson(txt);
      } catch {
        json = null;
      }
    }

    if (!json) {
      return NextResponse.json(
        { error: "No se encontró ni data/factors-daily.json ni public/factors.txt" },
        { status: 404 }
      );
    }

    // === Normalizar campos esperados ===
    cached = {
      views24hPct: json.views24hPct ?? json.vistas24hPct ?? 0,
      coeff: json.coeff ?? json.coeficientes ?? {},
      note: json.note ?? json.nota ?? "",
      updatedAt: json.updatedAt ?? new Date().toISOString(),
    };
    lastRead = now;

    return NextResponse.json(cached, {
      headers: { "Cache-Control": "s-maxage=60" },
    });
  } catch (err: any) {
    console.error("❌ Error en /api/factors:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ===== Parser auxiliar para factors.txt =====
function parseTxtToJson(txt: string) {
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  const coeff: Record<string, number> = {};
  let note = "";
  let views24hPct = 0;

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    if (line.includes("views24hPct")) {
      const val = line.split("=").pop()?.trim();
      views24hPct = parseFloat(val || "0");
    } else if (line.startsWith("note=")) {
      note = line.slice("note=".length).trim();
    } else if (line.includes("=")) {
      const [k, v] = line.split("=");
      const key = k.replace(/^coeff\.|^coef\./, "").trim();
      const val = parseFloat(v.trim());
      if (!isNaN(val)) coeff[key] = val;
    }
  }

  return { views24hPct, coeff, note, updatedAt: new Date().toISOString() };
}
