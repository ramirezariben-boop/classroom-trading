// app/api/candles/stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/candles/stats
 * Devuelve un resumen del número de velas por valueId y timeframe.
 * 
 * Opcional: /api/candles/stats?valueId=baumxp
 * (filtra por un solo activo)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const valueId = searchParams.get("valueId");

    const whereClause = valueId ? { valueId } : {};

    const data = await prisma.candle.groupBy({
      by: ["valueId", "timeframe"],
      where: whereClause,
      _count: { _all: true },
      orderBy: [
        { valueId: "asc" },
        { timeframe: "asc" },
      ],
    });

    // Reorganiza por valor
    const summary: Record<string, { [tf: string]: number }> = {};
    for (const row of data) {
      if (!summary[row.valueId]) summary[row.valueId] = {};
      summary[row.valueId][row.timeframe] = row._count._all;
    }

    return NextResponse.json({
      ok: true,
      total: data.reduce((acc, r) => acc + r._count._all, 0),
      activos: Object.keys(summary).length,
      summary,
    });
  } catch (err) {
    console.error("❌ Error en /api/candles/stats:", err);
    return NextResponse.json(
      { error: "Error al generar las estadísticas" },
      { status: 500 }
    );
  }
}
