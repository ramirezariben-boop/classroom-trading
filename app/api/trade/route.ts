// app/api/trade/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma"; // AJUSTA ruta si es necesario
import { readSessionFromHeaders } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "BUY" | "SELL";

export async function POST(req: Request) {
  try {
    const { uid } = await readSessionFromHeaders(); // lanza "unauthorized" si no
    const body = await req.json().catch(() => ({} as any));
    const { mode, valueId } = body as { mode?: Mode; valueId?: string };
    let { qty, price } = body as { qty?: number; price?: number };

    if (mode !== "BUY" && mode !== "SELL") {
      return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
    }
    if (!valueId) return NextResponse.json({ error: "Falta valueId" }, { status: 400 });

    qty = Math.floor(Number(qty));
    price = Number(price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Datos inválidos: qty/price" }, { status: 400 });
    }

    const deltaPts = Number((price * qty).toFixed(2)) * (mode === "BUY" ? -1 : 1);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: uid } });
      if (!user) throw new Error("404");

      const currentPts = Number(user.points);

      if (mode === "BUY") {
        if (currentPts + 1e-9 < -deltaPts) throw new Error("saldo");

        await tx.user.update({
          where: { id: uid },
          data: { points: currentPts + deltaPts },
        });

        await tx.position.upsert({
          where: { userId_valueId: { userId: uid, valueId } },
          update: { qty: { increment: qty } },
          create: { userId: uid, valueId, qty },
        });
      } else {
        const pos = await tx.position.findUnique({
          where: { userId_valueId: { userId: uid, valueId } },
        });
        if (!pos || pos.qty < qty) throw new Error("pos");

        await tx.user.update({
          where: { id: uid },
          data: { points: currentPts + deltaPts },
        });

        const newQty = pos.qty - qty;
        if (newQty > 0) {
          await tx.position.update({ where: { id: pos.id }, data: { qty: newQty } });
        } else {
          await tx.position.delete({ where: { id: pos.id } });
        }
      }

      await tx.tx.create({
        data: { userId: uid, type: mode, valueId, qty, deltaPts },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === "unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (e?.message === "saldo") {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    }
    if (e?.message === "pos") {
      return NextResponse.json({ error: "Posición insuficiente" }, { status: 400 });
    }
    if (e?.message === "404") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
