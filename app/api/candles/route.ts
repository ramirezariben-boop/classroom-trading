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

    // 🕒 Medir duración (opcional para debug)
    console.time(`[Candles] ${id}-${tf}`);

    const rows = await prisma.candle.findMany({
      where: { valueId: id, timeframe: tf },
      orderBy: { ts: "desc" },
      take: limit, // ✅ límite real 300 velas
    });

    const candles = rows
      .map((r) => ({
        // 🩹 Asegura timestamp válido
        time: r.time ? new Date(r.time).getTime() : new Date(r.ts).getTime(),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
      }))
      .filter((c) => !Number.isNaN(c.open) && c.open > 0)
      .sort((a, b) => a.time - b.time)
      .slice(-limit); // ✅ mantiene solo las últimas N velas pedidas

    // ✅ Log breve y silencioso: solo muestra resumen
    console.timeEnd(`[Candles] ${id}-${tf}`);
    console.log(`📊 ${id} (${tf}) → ${candles.length} velas cargadas`);

    return NextResponse.json(
      { ok: true, id, tf, count: candles.length, candles },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("❌ Error en /api/candles:", err.message);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
