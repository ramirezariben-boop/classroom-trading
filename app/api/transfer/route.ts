import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSessionFromHeaders } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // ❌ antes: const { uid } = readSessionFromHeaders()
    const { uid } = await readSessionFromHeaders();

    const { toUserId, amount } = await req.json();
    const nAmount = Number(amount);
    if (!toUserId || !nAmount || nAmount <= 0) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    // ejemplo mínimo con Prisma: resta al que envía y suma al que recibe
    await prisma.$transaction([
      prisma.user.update({
        where: { id: uid },
        data: { points: { decrement: nAmount } },
      }),
      prisma.user.update({
        where: { id: toUserId },
        data: { points: { increment: nAmount } },
      }),
      prisma.tx.create({
        data: { userId: uid, ts: new Date(), type: "TRANSFER_OUT", deltaPts: -nAmount },
      }),
      prisma.tx.create({
        data: { userId: toUserId, ts: new Date(), type: "TRANSFER_IN", deltaPts: nAmount },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === "unauthorized" ? 401 : 500;
    return new Response(e?.message || "error", { status: code });
  }
}
