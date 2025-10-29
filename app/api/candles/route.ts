import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/candles?id=baumxp&tf=5m&limit=300
 * Devuelve las velas de un activo (valueId) y temporalidad (tf)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const tf = searchParams.get("tf") ?? "5m";
    const limit = Number(searchParams.get("limit") ?? 300);

    if (!id) {
      return NextResponse.json(
        { error: "Falta parámetro 'id'" },
        { status: 400 }
      );
    }

    const rows = await prisma.candle.findMany({
      where: { valueId: id, timeframe: tf },
      orderBy: { ts: "desc" },
      take: limit,
    });

    const candles = rows
      .map((r) => ({
        time: Number(r.time),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
      }))

  // 🔹 Asegura que no haya valores corruptos
  .filter((c) => !Number.isNaN(c.open) && c.open > 0)
  // 🔹 Ordena cronológicamente ascendente (de la más vieja a la más nueva)
  .sort((a, b) => a.time - b.time)
  // 🔹 Limita a las 1500 más recientes (siempre)
  .slice(-1500);

    return NextResponse.json(
      { ok: true, id, tf, count: candles.length, candles },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("❌ Error en /api/candles:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
