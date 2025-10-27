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

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number; name: string };
    const { toUserId, amount, concept } = await req.json();

    if (!toUserId || !amount || !concept)
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

    const sender = await prisma.user.findUnique({ where: { id: decoded.id } });
    const receiver = await prisma.user.findUnique({ where: { id: toUserId } });

    if (!sender || !receiver)
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const amt = Number(amount);
    if (amt <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    if (sender.points < amt)
      return NextResponse.json({ error: "Fondos insuficientes" }, { status: 400 });

    const ts = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: sender.id },
        data: { points: { decrement: amt } },
      }),
      prisma.user.update({
        where: { id: receiver.id },
        data: { points: { increment: amt } },
      }),
      prisma.tx.create({
        data: {
          userId: sender.id,
          type: "TRANSFER_OUT",
          deltaPts: -amt,
          note: `→ ${receiver.name} (${receiver.id}) · ${concept}`,
          ts,
        },
      }),
      prisma.tx.create({
        data: {
          userId: receiver.id,
          type: "TRANSFER_IN",
          deltaPts: amt,
          note: `← ${sender.name} (${sender.id}) · ${concept}`,
          ts,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ Error en /api/transfer:", err);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
