// app/api/candles/update/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/candles/update
 * Guarda o actualiza velas de un activo y timeframe.
 * 
 * ✅ Cada timeframe tiene su propio límite independiente:
 *    5m: 1500, 15m: 600, 1h: 300, 4h: 150, 1d: 100, 1w: 64
 * 
 * Cuando se excede el límite, se eliminan las velas más antiguas
 * SOLO de ese valueId + timeframe (no toca las demás temporalidades).
 */

const LIMITS: Record<string, number> = {
  "5m": 300,
  "15m": 300,
  "1h": 300,
  "4h": 300,
  "1d": 300,
  "1w": 300,
};

export async function POST(req: Request) {
  try {
    const { valueId, timeframe, candles } = await req.json();

    if (!valueId || !timeframe || !Array.isArray(candles)) {
      return NextResponse.json(
        { error: "Datos incompletos o formato incorrecto" },
        { status: 400 }
      );
    }

    // 1️⃣ Inserta o actualiza las velas recibidas
    for (const c of candles) {
      await prisma.candle.upsert({
        where: {
          valueId_timeframe_time: {
            valueId,
            timeframe,
            time: new Date(c.time),
          },
        },
        update: {
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          ts: new Date(),
        },
        create: {
          valueId,
          timeframe,
          time: new Date(c.time),
          ts: new Date(),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        },
      });
    }

    // 2️⃣ Verifica cuántas velas hay para este timeframe
    const count = await prisma.candle.count({
      where: { valueId, timeframe },
    });

    const limit = LIMITS[timeframe] ?? 300; // fallback general
    let deleted = 0;

    // 3️⃣ Si excede el límite, borra las más antiguas
    if (count > limit) {
      const toDelete = count - limit;

      await prisma.$executeRawUnsafe(`
        DELETE FROM "Candle"
        WHERE "valueId" = '${valueId}'
        AND "timeframe" = '${timeframe}'
        AND "time" < (
          SELECT "time"
          FROM "Candle"
          WHERE "valueId" = '${valueId}' AND "timeframe" = '${timeframe}'
          ORDER BY "time" DESC
          OFFSET ${limit - 1}
          LIMIT 1
        )
      `);

      deleted = toDelete;
      console.log(`🧹 ${deleted} velas antiguas eliminadas para ${valueId} (${timeframe})`);
    }

    return NextResponse.json({
      ok: true,
      saved: candles.length,
      deleted,
      remaining: Math.max(count - deleted, limit),
      message: `✅ ${candles.length} vela(s) actualizada(s) en ${valueId} (${timeframe}).`,
    });
  } catch (err: any) {
    console.error("❌ Error en /api/candles/update:", err);
    return NextResponse.json(
      { error: "Error al guardar las velas" },
      { status: 500 }
    );
  }
}
