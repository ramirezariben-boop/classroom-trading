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

    const ts = new Date();

    // === COMPRA o VENTA (simétricas) ===
    if (mode === "BUY" || mode === "SELL") {
      const cantidad = Number(qty);
      const precio = Number(price);
      if (cantidad <= 0 || precio <= 0)
        return NextResponse.json({ error: "Cantidad o precio inválido" }, { status: 400 });

      const total = +(cantidad * precio).toFixed(2);
      const isShort = mode === "SELL";

      if (user.points < total)
        return NextResponse.json({ error: "Fondos insuficientes" }, { status: 400 });

      const existing = await prisma.position.findUnique({
        where: { userId_valueId_isShort: { userId: user.id, valueId, isShort } },
      });

      await prisma.$transaction([
        // 💸 Resta puntos al abrir la posición (long o short)
        prisma.user.update({
          where: { id: user.id },
          data: { points: { decrement: total } },
        }),

        // 🧾 Registrar la transacción
        prisma.tx.create({
          data: {
            userId: user.id,
            type: mode,
            valueId,
            qty: cantidad,
            deltaPts: -total,
            ts,
          },
        }),

        // 📊 Crear o actualizar la posición con su flag long/short
        prisma.position.upsert({
          where: { userId_valueId_isShort: { userId: user.id, valueId, isShort } },
          update: {
            avgPrice:
              existing && existing.qty > 0
                ? (existing.avgPrice * existing.qty + precio * cantidad) /
                  (existing.qty + cantidad)
                : precio,
            qty: { increment: cantidad },
          },
          create: {
            userId: user.id,
            valueId,
            qty: cantidad,
            avgPrice: precio,
            isShort,
          },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    // === CIERRE de posición ===
    if (mode === "CLOSE") {
      // Para cierre explícito usa /api/close
      return NextResponse.json(
        { error: "Usa /api/close para cerrar posiciones" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  } catch (err: any) {
    console.error("❌ Error en /api/trade:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
