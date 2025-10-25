// app/api/transfer/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSessionUser } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const toUserId = body.toUserId;
  const amount = Number(body.amount);

  if (!toUserId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Faltan datos válidos" }, { status: 400 });
  }

  const fromUser = await prisma.user.findUnique({ where: { id: Number(user.id) } });
  const toUser = await prisma.user.findUnique({ where: { id: Number(toUserId) } });

  if (!fromUser || !toUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (fromUser.points < amount) {
    return NextResponse.json({ error: "Fondos insuficientes" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedFrom = await tx.user.update({
      where: { id: fromUser.id },
      data: { points: { decrement: amount } },
    });

    const updatedTo = await tx.user.update({
      where: { id: toUser.id },
      data: { points: { increment: amount } },
    });

    // Registra ambas transacciones
    await tx.tx.createMany({
      data: [
        {
          userId: fromUser.id,
          type: "TRANSFER_OUT",
          deltaPts: -amount,
        },
        {
          userId: toUser.id,
          type: "TRANSFER_IN",
          deltaPts: amount,
        },
      ],
    });

    return { updatedFrom, updatedTo };
  });

  return NextResponse.json({
    ok: true,
    from: { id: fromUser.id, newPoints: result.updatedFrom.points },
    to: { id: toUser.id, newPoints: result.updatedTo.points },
    amount,
  });
}
