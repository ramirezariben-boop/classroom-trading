// app/lib/saveCandle.ts
import { prisma } from "@/app/lib/prisma";

/**
 * Guarda o actualiza una vela y mantiene solo las 300 más recientes.
 */
export async function saveCandle(
  valueId: string,
  timeframe: string,
  candle: { time: number; open: number; high: number; low: number; close: number }
) {
  try {
    await prisma.candle.upsert({
      where: { valueId_time: { valueId, time: BigInt(candle.time) } },
      update: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        ts: new Date(candle.time),
        timeframe,
      },
      create: {
        valueId,
        timeframe,
        time: BigInt(candle.time),
        ts: new Date(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      },
    });

    // 🔁 Mantiene solo las 300 más recientes
    const old = await prisma.candle.findMany({
      where: { valueId, timeframe },
      orderBy: { time: "desc" },
      skip: 300,
      select: { valueId: true, time: true },
    });

    if (old.length > 0) {
      await prisma.candle.deleteMany({
        where: {
          OR: old.map((c) => ({
            valueId: c.valueId,
            time: c.time,
          })),
        },
      });
    }
  } catch (err) {
    console.error("Error al guardar vela:", err);
  }
}
