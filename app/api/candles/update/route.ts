// app/api/candles/update/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/candles/update
 * Guarda o actualiza velas de un activo
 * body: { valueId, timeframe, candles: [{ time, open, high, low, close }] }
 */
export async function POST(req: Request) {
  try {
    const { valueId, timeframe, candles } = await req.json();

    if (!valueId || !timeframe || !Array.isArray(candles)) {
      return NextResponse.json(
        { error: "Datos incompletos o formato incorrecto" },
        { status: 400 }
      );
    }

    // Inserta o actualiza cada vela
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

    return NextResponse.json({
      ok: true,
      count: candles.length,
      message: `✅ ${candles.length} vela(s) guardada(s) para ${valueId} (${timeframe})`,
    });
  } catch (err) {
    console.error("❌ Error en /api/candles/update:", err);
    return NextResponse.json(
      { error: "Error al guardar las velas" },
      { status: 500 }
    );
  }
}
