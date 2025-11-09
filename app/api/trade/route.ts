// app/api/trade/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const cookie = cookies().get("session_token");
    if (!cookie)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number };
    const { mode, valueId, qty, price } = await req.json();

    if (!mode || !valueId)
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user)
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const pos = await prisma.position.findUnique({
      where: { userId_valueId: { userId: user.id, valueId } },
    });

    const ts = new Date();

    // === CIERRE ===
    if (mode === "CLOSE") {
      if (!pos || pos.qty <= 0)
        return NextResponse.json({ error: "No hay posición abierta" }, { status: 400 });

      const invested = pos.avgPrice * pos.qty;
      const current = price * pos.qty;
      const profit = +(current - invested).toFixed(2);
      const totalReturn = +(invested + profit).toFixed(2);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { points: { increment: totalReturn } },
        }),
        prisma.tx.create({
          data: {
            userId: user.id,
            type: "SELL",
            valueId,
            qty: pos.qty,
            deltaPts: totalReturn,
            ts,
            note: `Cierre con ${profit >= 0 ? "ganancia" : "pérdida"} de ${profit}`,
          },
        }),
        prisma.position.update({
          where: { userId_valueId: { userId: user.id, valueId } },
          data: { qty: 0 },
        }),
      ]);

      return NextResponse.json({ ok: true, profit, returned: totalReturn });
    }

    // === COMPRA / VENTA ===
    if (mode === "BUY" || mode === "SELL") {
      const cantidad = Number(qty);
      const total = +(cantidad * price).toFixed(2);
      if (cantidad <= 0) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

      const ops =
        mode === "BUY"
          ? [
              prisma.user.update({ where: { id: user.id }, data: { points: { decrement: total } } }),
              prisma.tx.create({
                data: { userId: user.id, type: "BUY", valueId, qty: cantidad, deltaPts: -total, ts },
              }),
              prisma.position.upsert({
                where: { userId_valueId: { userId: user.id, valueId } },
                update: { qty: { increment: cantidad }, avgPrice: price },
                create: { userId: user.id, valueId, qty: cantidad, avgPrice: price },
              }),
            ]
          : [
              prisma.user.update({ where: { id: user.id }, data: { points: { increment: total } } }),
              prisma.tx.create({
                data: { userId: user.id, type: "SELL", valueId, qty: cantidad, deltaPts: total, ts },
              }),
              prisma.position.updateMany({
                where: { userId: user.id, valueId },
                data: { qty: { decrement: cantidad } },
              }),
            ];

      await prisma.$transaction(ops);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  } catch (err: any) {
    console.error("❌ Error en /api/trade:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
