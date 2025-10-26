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

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as {
      id: number;
      name: string;
    };

    const { mode, valueId, qty, price } = await req.json();

    if (!mode || !valueId || !qty || !price)
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );

    // ✅ Recuperamos la categoría del valor
    const value = await prisma.value.findUnique({
      where: { id: valueId },
      select: { categoryId: true },
    });

    if (!value)
      return NextResponse.json(
        { error: "Valor no encontrado" },
        { status: 404 }
      );

    // 🚫 Bloqueo de ventas de bienes ("Güter")
    if (mode === "SELL" && value.categoryId === "guter") {
      return NextResponse.json(
        { error: "No se pueden vender bienes (Güter)." },
        { status: 400 }
      );
    }

    const cantidad = Number(qty);
    const precio = Number(price);
    const total = +(cantidad * precio).toFixed(2);
    const ts = new Date();

    // ✅ Validar puntos suficientes ANTES de cualquier operación (solo en compras)
    if (mode === "BUY" && user.points < total) {
      return NextResponse.json(
        { error: "Fondos insuficientes" },
        { status: 400 }
      );
    }

    // 🔹 COMPRA
    if (mode === "BUY") {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { points: { decrement: total } },
        }),
        prisma.tx.create({
          data: {
            userId: user.id,
            type: "BUY",
            valueId,
            qty: cantidad,
            deltaPts: -total,
            ts,
          },
        }),
        prisma.position.upsert({
          where: { userId_valueId: { userId: user.id, valueId } },
          update: {
            qty: { increment: cantidad },
            avgPrice: precio, // simplificado
          },
          create: { userId: user.id, valueId, qty: cantidad, avgPrice: precio },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    // 🔹 VENTA
    if (mode === "SELL") {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { points: { decrement: total } },
        }),
        prisma.tx.create({
          data: {
            userId: user.id,
            type: "SELL",
            valueId,
            qty: cantidad,
            deltaPts: -total, // 🔻 siempre negativo
            ts,
          },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  } catch (err) {
    console.error("❌ Error en /api/trade:", err);
    return NextResponse.json(
      { error: "Error en el servidor" },
      { status: 500 }
    );
  }
}
