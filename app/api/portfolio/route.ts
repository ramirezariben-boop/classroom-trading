// app/api/portfolio/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ✅ cookies() ahora requiere "await"
    const cookieStore = await cookies();
    const cookie = cookieStore.get("session_token");
    if (!cookie)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number };

    // 🧩 Traer usuario con posiciones y transacciones
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        positions: true, // incluye isShort
        txs: { orderBy: { ts: "desc" }, take: 50 },
      },
    });

    if (!user)
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // ⚙️ Obtener precios actuales
    const allValues = await prisma.value.findMany({
      select: { id: true, price: true, categoryId: true, description: true },
    });
    const priceMap = Object.fromEntries(allValues.map((v) => [v.id, v]));

    // 🧮 Cálculo de capital invertido y ganancia/pérdida
    let invested = 0;
    let profit = 0;

    for (const p of user.positions) {
      if (p.qty <= 0) continue;

      const currentPrice = priceMap[p.valueId]?.price ?? p.avgPrice;
      const investedPos = p.avgPrice * p.qty;
      const currentValue = currentPrice * p.qty;

      // 🔁 Lógica short
      const profitPos = p.isShort
        ? investedPos - currentValue // gana si baja
        : currentValue - investedPos; // gana si sube

      invested += investedPos;
      profit += profitPos;
    }

    // ✅ Total correcto: puntos + invertido + ganancia/pérdida
    const total = user.points + invested + profit;

    // 🧾 Formatear respuesta
    return NextResponse.json({
      points: user.points,
      invested,
      profit,
      total,
      positions: user.positions.map((p) => ({
        valueId: p.valueId,
        qty: p.qty,
        avgPrice: p.avgPrice,
        isShort: p.isShort,
        categoryId: priceMap[p.valueId]?.categoryId,
        description: priceMap[p.valueId]?.description,
      })),
      txs: user.txs,
    });
  } catch (err: any) {
    console.error("❌ Error en /api/portfolio:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
