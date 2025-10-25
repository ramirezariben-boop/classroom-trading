// app/api/transfer/route.ts
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

    const { toUserId, amount, concept } = await req.json();

    if (!toUserId || !amount || amount <= 0 || !concept?.trim())
      return NextResponse.json({ error: "Datos inválidos o concepto vacío" }, { status: 400 });

    const sender = await prisma.user.findUnique({ where: { id: decoded.id } });
    const receiver = await prisma.user.findUnique({ where: { id: Number(toUserId) } });

    if (!sender || !receiver)
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (sender.points < amount)
      return NextResponse.json({ error: "Fondos insuficientes" }, { status: 400 });

    const ts = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: sender.id },
        data: { points: { decrement: amount } },
      }),
      prisma.user.update({
        where: { id: receiver.id },
        data: { points: { increment: amount } },
      }),
      prisma.tx.create({
        data: {
          userId: sender.id,
          type: "TRANSFER_OUT",
          valueId: null,
          qty: amount,
          deltaPts: -amount,
          ts,
          note: concept, // 🔹 guardamos concepto
        },
      }),
      prisma.tx.create({
        data: {
          userId: receiver.id,
          type: "TRANSFER_IN",
          valueId: null,
          qty: amount,
          deltaPts: amount,
          ts,
          note: concept, // 🔹 también en el receptor
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Error en /api/transfer:", err);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
