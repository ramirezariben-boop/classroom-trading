// app/api/portfolio/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookie = cookies().get("session_token");
    if (!cookie)
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as {
      id: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        positions: true,
        txs: {
          orderBy: { ts: "desc" },
          take: 50,
        },
      },
    });

    if (!user)
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // 🧮 Mapea posiciones y txs
    const positions = user.positions.map((p) => ({
      valueId: p.valueId,
      qty: p.qty,
      avgPrice: p.avgPrice,
    }));

    const txs = user.txs.map((t) => ({
      id: t.id,
      ts: t.ts,
      type: t.type,
      valueId: t.valueId,
      qty: t.qty,
      deltaPts: t.deltaPts,
    }));

    return NextResponse.json({
      points: user.points,
      positions,
      txs,
    });
  } catch (err) {
    console.error("❌ Error en /api/portfolio:", err);
    return NextResponse.json(
      { error: "Error en el servidor" },
      { status: 500 }
    );
  }
}
