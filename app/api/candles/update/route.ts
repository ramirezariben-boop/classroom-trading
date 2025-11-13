// app/api/candles/update/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/candles/update
 * Guarda o actualiza velas SOLO de 5 minutos.
 * 
 * ✅ Límite: 52,416 velas (~6 meses)
 * ✅ Si excede el límite, elimina las más antiguas.
 */

const DAYS_TO_KEEP = 182; // 🔹 medio año
const LIMIT = 288 * DAYS_TO_KEEP; // 288 velas de 5m por día

export async function POST(req: Request) {
  try {
    const { valueId, timeframe, candles } = await req.json();

    if (!valueId || !Array.isArray(candles)) {
      return NextResponse.json(
        { error: "Datos incompletos o formato incorrecto" },
        { status: 400 }
      );
    }

    // 🔒 Siempre trabajamos en 5m (único timeframe persistido)
    const tf = "5m";
    const now = new Date();

    // 1️⃣ Inserta o actualiza cada vela
    for (const c of candles) {
      await prisma.candle.upsert({
        where: {
          valueId_timeframe_time: {
            valueId,
            timeframe: tf,
            time: new Date(c.time),
          },
        },
        update: {
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          ts: now,
        },
        create: {
          valueId,
          timeframe: tf,
          time: new Date(c.time),
          ts: now,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        },
      });
    }

    // 2️⃣ Contamos cuántas velas hay
    const count = await prisma.candle.count({
      where: { valueId, timeframe: tf },
    });

    let deleted = 0;

    // 3️⃣ Si excede el límite, elimina las más antiguas
    if (count > LIMIT) {
      const toDelete = count - LIMIT;

      await prisma.$executeRawUnsafe(`
        DELETE FROM "Candle"
        WHERE "valueId" = '${valueId}'
        AND "timeframe" = '${tf}'
        AND "time" < (
          SELECT "time"
          FROM "Candle"
          WHERE "valueId" = '${valueId}' AND "timeframe" = '${tf}'
          ORDER BY "time" DESC
          OFFSET ${LIMIT - 1}
          LIMIT 1
        );
      `);

      deleted = toDelete;
      console.log(`🧹 Eliminadas ${deleted} velas antiguas para ${valueId} (${tf})`);
    }

    return NextResponse.json({
      ok: true,
      saved: candles.length,
      deleted,
      timeframe: tf,
      limit: LIMIT,
      message: `✅ ${candles.length} vela(s) procesada(s) en ${valueId} (5m).`,
    });
  } catch (err: any) {
    console.error("❌ Error en /api/candles/update:", err);
    return NextResponse.json(
      { error: "Error al guardar las velas" },
      { status: 500 }
    );
  }
}
