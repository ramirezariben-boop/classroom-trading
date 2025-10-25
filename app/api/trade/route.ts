// app/api/trade/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSessionUser } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "BUY" | "SELL";

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { mode, valueId, qty, price } = body;

  if (!mode || !valueId || !qty || !price) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: Number(user.id) },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const total = price * qty;

  // Busca si ya hay posición del activo
  const pos = await prisma.position.findUnique({
    where: { userId_valueId: { userId: dbUser.id, valueId } },
  });

  let deltaPoints = 0;

  // === COMPRAR ===
  if (mode === "BUY") {
    if (dbUser.points < total) {
      return NextResponse.json({ error: "Fondos insuficientes" }, { status: 400 });
    }

    // Calcula nuevo promedio ponderado
    const newQty = (pos?.qty ?? 0) + qty;
    const newAvg =
      pos ? (pos.avgPrice * pos.qty + price * qty) / newQty : price;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dbUser.id },
        data: { points: { decrement: total } },
      });

      await tx.position.upsert({
        where: { userId_valueId: { userId: dbUser.id, valueId } },
        update: { qty: newQty, avgPrice: newAvg },
        create: { userId: dbUser.id, valueId, qty, avgPrice: price },
      });

      await tx.tx.create({
        data: {
          userId: dbUser.id,
          type: "BUY",
          valueId,
          qty,
          deltaPts: -total,
        },
      });
    });

    deltaPoints = -total;
  }

  // === VENDER ===
  if (mode === "SELL") {
    if (!pos || pos.qty < qty) {
      return NextResponse.json({ error: "No tienes suficientes unidades para vender" }, { status: 400 });
    }

    const remainingQty = pos.qty - qty;
    const proceeds = price * qty;

    await prisma.$transaction(async (tx) => {
      // Actualiza posición (si llega a 0, la borra)
      if (remainingQty > 0) {
        await tx.position.update({
          where: { id: pos.id },
          data: { qty: remainingQty },
        });
      } else {
        await tx.position.delete({ where: { id: pos.id } });
      }

      // Descuenta también una pequeña comisión (por ejemplo 1%)
      const commission = proceeds * 0.01;
      const netProceeds = proceeds - commission;

      await tx.user.update({
        where: { id: dbUser.id },
        data: { points: { increment: netProceeds } },
      });

      await tx.tx.create({
        data: {
          userId: dbUser.id,
          type: "SELL",
          valueId,
          qty,
          deltaPts: netProceeds,
        },
      });
    });

    deltaPoints = proceeds;
  }

  // Devuelve saldo actualizado
  const updatedUser = await prisma.user.findUnique({
    where: { id: dbUser.id },
  });

  return NextResponse.json({
    success: true,
    newPoints: updatedUser?.points ?? 0,
    delta: deltaPoints,
  });
}
