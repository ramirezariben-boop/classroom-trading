// app/api/close/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ===== 1. Autenticación =====
    const cookie = cookies().get("session_token");
    if (!cookie)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number };

    // ===== 2. Datos recibidos =====
    const { valueId, price } = await req.json();
    if (!valueId || typeof price !== "number" || price <= 0)
      return NextResponse.json({ error: "Datos incompletos o inválidos" }, { status: 400 });

    // ===== 3. Obtener usuario y posición =====
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user)
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const pos = await prisma.position.findUnique({
      where: { userId_valueId: { userId: user.id, valueId } },
    });
    if (!pos || pos.qty <= 0)
      return NextResponse.json({ error: "No hay posición abierta" }, { status: 400 });

    // ===== 4. Calcular resultados =====
    const invested = pos.avgPrice * pos.qty;
    const current = price * pos.qty;
    const profit = +(current - invested).toFixed(2);
    const totalReturn = +(invested + profit).toFixed(2);
    const ts = new Date();

    // ===== 5. Actualizar puntos y registrar transacción =====
    await prisma.$transaction([
      // 💰 Regresar al usuario el capital invertido + ganancia/pérdida
      prisma.user.update({
        where: { id: user.id },
        data: { points: { increment: totalReturn } },
      }),

      // 🧾 Registrar la transacción
      prisma.tx.create({
        data: {
          userId: user.id,
          type: "SELL", // ✅ usamos "SELL" en lugar de "CLOSE" para mantener consistencia con el sistema
          valueId,
          qty: pos.qty,
          deltaPts: totalReturn,
          ts,
          note: `Cierre con ${profit >= 0 ? "ganancia" : "pérdida"} de ${profit.toFixed(2)} MXP`,
        },
      }),

      // 📉 Eliminar la posición (o dejarla con qty = 0)
      prisma.position.update({
        where: { userId_valueId: { userId: user.id, valueId } },
        data: { qty: 0 },
      }),
    ]);

    console.log(
      `✅ ${user.id} cerró ${valueId} → Invertido ${invested.toFixed(
        2
      )}, Ganancia ${profit.toFixed(2)}, Total devuelto ${totalReturn.toFixed(2)}`
    );

    // ===== 6. Respuesta final =====
    return NextResponse.json({
      ok: true,
      profit,
      returned: totalReturn,
    });
  } catch (err: any) {
    console.error("❌ Error en /api/close:", err);
    return NextResponse.json(
      { error: "Error en el servidor", details: err.message },
      { status: 500 }
    );
  }
}
