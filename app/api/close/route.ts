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
    const { valueId, price, isShort } = await req.json();

    if (!valueId || typeof price !== "number" || price <= 0)
      return NextResponse.json({ error: "Datos incompletos o inválidos" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user)
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const pos = await prisma.position.findUnique({
      where: { userId_valueId_isShort: { userId: user.id, valueId, isShort: !!isShort } },
    });

    if (!pos || pos.qty <= 0)
      return NextResponse.json({ error: "No hay posición abierta" }, { status: 400 });

    // === Calcular ganancia/pérdida ===
    const invested = pos.avgPrice * pos.qty;
    const current = price * pos.qty;

    // 🧮 Invertir el cálculo si es posición corta
    const profit = pos.isShort
      ? +(invested - current).toFixed(2) // gana si baja
      : +(current - invested).toFixed(2); // gana si sube

    const totalReturn = +(invested + profit).toFixed(2);
    const ts = new Date();

    await prisma.$transaction([
      // 💰 Regresar capital + ganancia/pérdida
      prisma.user.update({
        where: { id: user.id },
        data: { points: { increment: totalReturn } },
      }),

      // 🧾 Registrar transacción
      prisma.tx.create({
        data: {
          userId: user.id,
          type: "SELL", // mantenemos consistencia
          valueId,
          qty: pos.qty,
          deltaPts: totalReturn,
          ts,
          note: `Cierre ${pos.isShort ? "short" : "long"} con ${
            profit >= 0 ? "ganancia" : "pérdida"
          } de ${profit.toFixed(2)} MXP`,
        },
      }),

      // 📉 Cerrar posición
      prisma.position.update({
        where: { userId_valueId_isShort: { userId: user.id, valueId, isShort: !!isShort } },
        data: { qty: 0 },
      }),
    ]);

    console.log(
      `✅ ${user.id} cerró ${valueId} (${pos.isShort ? "short" : "long"}) → Invertido ${invested.toFixed(
        2
      )}, Ganancia ${profit.toFixed(2)}, Total devuelto ${totalReturn.toFixed(2)}`
    );

    return NextResponse.json({ ok: true, profit, returned: totalReturn });
  } catch (err: any) {
    console.error("❌ Error en /api/close:", err);
    return NextResponse.json(
      { error: "Error en el servidor", details: err.message },
      { status: 500 }
    );
  }
}
