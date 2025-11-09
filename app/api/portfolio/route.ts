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
    const cookie = cookies().get("session_token");
    if (!cookie)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        positions: true,
        txs: { orderBy: { ts: "desc" }, take: 50 },
      },
    });

    if (!user)
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // ⚙️ Obtener todos los precios en un solo query
    const allValues = await prisma.value.findMany({
      select: { id: true, price: true, categoryId: true, description: true },
    });
    const priceMap = Object.fromEntries(allValues.map(v => [v.id, v]));

    // 🧮 Cálculos
    let invested = 0, profit = 0;
    for (const p of user.positions) {
      const current = priceMap[p.valueId]?.price ?? p.avgPrice;
      invested += p.avgPrice * p.qty;
      profit += (current - p.avgPrice) * p.qty;
    }

    const total = user.points + invested + profit;

    return NextResponse.json({
      points: user.points,
      invested,
      profit,
      total,
      positions: user.positions.map(p => ({
        valueId: p.valueId,
        qty: p.qty,
        avgPrice: p.avgPrice,
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
