// app/api/portfolio/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 🔹 Recuperar el ID del usuario desde la cookie de sesión
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
    }

    // 🔹 Buscar al usuario real en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      include: {
        positions: true,
        txs: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // 🔹 Armar respuesta con datos reales
    const data = {
      points: user.points ?? 10,
      positions: user.positions ?? [],
      txs:
        user.txs?.map((t) => ({
          id: t.id,
          ts: t.ts,
          type: t.type,
          valueId: t.valueId,
          qty: t.qty,
          deltaPts: t.deltaPts,
        })) ?? [],
    };

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("❌ Error en /api/portfolio:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
