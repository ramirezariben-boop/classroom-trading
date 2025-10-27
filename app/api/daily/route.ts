// app/api/daily/route.ts
import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.resolve(process.cwd(), "public/daily_input.json");
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);

    // 🧮 Calcular ratio likes/vistas
    const likes = json.youtube?.likes ?? 0;
    const vistas = json.youtube?.vistas ?? 1;
    const ratio = +(likes / vistas).toFixed(3);

    const sab = json.grupos?.sabado || {};
    const dom = json.grupos?.domingo || {};

    const out = {
      date: new Date(json.date + "T18:00:00-06:00").toISOString(),
      canal_ratio: ratio,
      sabado: {
        participacion: sab.participacion?.puntos_totales ?? null,
        evaluaciones: sab.evaluaciones?.promedio_hoy ?? null,
        tareas_extra: sab.tareas_extra?.total_hoy ?? null,
        asistencia: sab.asistencia ?? null,
      },
      domingo: {
        participacion: dom.participacion?.puntos_totales ?? null,
        evaluaciones: dom.evaluaciones?.promedio_hoy ?? null,
        tareas_extra: dom.tareas_extra?.total_hoy ?? null,
        asistencia: dom.asistencia ?? null,
      },
    };

    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("❌ Error leyendo daily_input.json:", err);
    return NextResponse.json({ error: "No se pudo leer daily_input.json" }, { status: 500 });
  }
}
