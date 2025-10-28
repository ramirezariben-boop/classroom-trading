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
    console.log("🧩 Iniciando /api/portfolio");

    const cookie = cookies().get("session_token");
    if (!cookie) {
      console.warn("⚠️ No hay cookie de sesión");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log("🔑 Cookie encontrada, verificando JWT...");
    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number };
    console.log("✅ Usuario decodificado:", decoded);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        positions: {
          include: {
            value: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                description: true,
              },
            },
          },
        },
        txs: { orderBy: { ts: "desc" }, take: 50 },
      },
    });

    console.log("📦 Usuario encontrado:", user?.id);

    if (!user) {
      console.error("❌ Usuario no encontrado");
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

const payload = {
  points: user.points,
  positions: user.positions.map((p) => ({
    valueId: p.valueId,
    qty: p.qty,
    avgPrice: p.avgPrice,
    categoryId: p.value?.categoryId?.toLowerCase?.() ?? "(sin categoría)",
    description: p.value?.description ?? "(sin descripción)",
  })),
  txs: user.txs.map((t) => ({
    id: t.id,
    type: t.type,
    valueId: t.valueId,
    qty: t.qty,
    deltaPts: t.deltaPts,
    ts: t.ts,
  })),
};


    console.log("✅ Payload listo:", payload);
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("❌ Error en /api/portfolio:", err);
    return NextResponse.json({ error: "Error en el servidor", details: err.message }, { status: 500 });
  }
}

