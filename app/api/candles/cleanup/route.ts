// app/api/candles/cleanup/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/candles/cleanup
 * 🔹 Elimina velas antiguas manteniendo solo las más recientes.
 * 🔹 Límite: 52,416 velas (≈ 6 meses de datos de 5 minutos).
 * 🔹 Aplica por separado a cada valueId y timeframe.
 */

const DAYS_TO_KEEP = 182; // medio año
const LIMIT = 288 * DAYS_TO_KEEP; // 288 velas por día × 182 días = 52,416

export async function GET() {
  try {
    // 1️⃣ Encuentra todas las combinaciones únicas de (valueId, timeframe)
    const combos = await prisma.candle.findMany({
      select: { valueId: true, timeframe: true },
      distinct: ["valueId", "timeframe"],
    });

    let totalDeleted = 0;

    // 2️⃣ Procesa cada combinación
    for (const combo of combos) {
      const { valueId, timeframe } = combo;

      // Cuenta total de velas
      const total = await prisma.candle.count({
        where: { valueId, timeframe },
      });

      if (total > LIMIT) {
        const toDelete = total - LIMIT;

        // 🔍 Encuentra las más antiguas
        const old = await prisma.candle.findMany({
          where: { valueId, timeframe },
          orderBy: { time: "asc" },
          take: toDelete,
          select: { valueId: true, timeframe: true, time: true },
        });

        // Elimina en lote (seguro)
        const times = old.map((c) => c.time);
        if (times.length > 0) {
          await prisma.candle.deleteMany({
            where: {
              valueId,
              timeframe,
              time: { in: times },
            },
          });
        }

        totalDeleted += toDelete;
        console.log(`🧹 ${toDelete} velas antiguas eliminadas de ${valueId} (${timeframe})`);
      }
    }

    return NextResponse.json({
      ok: true,
      deleted: totalDeleted,
      keptPerCombo: LIMIT,
      message: `🧽 Limpieza completada: ${totalDeleted} velas antiguas eliminadas.`,
    });
  } catch (err) {
    console.error("❌ Error en /api/candles/cleanup:", err);
    return NextResponse.json(
      { error: "Error al limpiar las velas" },
      { status: 500 }
    );
  }
}
