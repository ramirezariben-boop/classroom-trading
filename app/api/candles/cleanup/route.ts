// app/api/candles/cleanup/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/candles/cleanup
 * Limpia velas antiguas globalmente, deja solo las más recientes (máx. 300 por timeframe y valueId)
 */
export async function GET() {
  try {
    const combos = await prisma.candle.findMany({
      select: { valueId: true, timeframe: true },
      distinct: ["valueId", "timeframe"],
    });

    let totalDeleted = 0;

    for (const combo of combos) {
      const { valueId, timeframe } = combo;

      const total = await prisma.candle.count({
        where: { valueId, timeframe },
      });

      if (total > 300) {
        const toDelete = total - 300;

        const old = await prisma.candle.findMany({
          where: { valueId, timeframe },
          orderBy: { time: "asc" },
          take: toDelete,
          select: { valueId: true, timeframe: true, time: true },
        });

        for (const c of old) {
          await prisma.candle.delete({
            where: {
              valueId_timeframe_time: {
                valueId: c.valueId,
                timeframe: c.timeframe,
                time: c.time,
              },
            },
          });
        }

        totalDeleted += toDelete;
        console.log(
          `🧹 Eliminadas ${toDelete} velas antiguas de ${valueId} (${timeframe})`
        );
      }
    }

    return NextResponse.json({
      ok: true,
      deleted: totalDeleted,
      message: `🧽 Limpieza completada. ${totalDeleted} velas antiguas eliminadas.`,
    });
  } catch (err) {
    console.error("❌ Error en /api/candles/cleanup:", err);
    return NextResponse.json({ error: "Error al limpiar las velas" }, { status: 500 });
  }
}
