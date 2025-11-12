// app/api/txs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // ✅ CORRECCIÓN: cookies() debe ser await en Next.js 15+
    const cookieStore = await cookies();
    const cookie = cookieStore.get("session_token");
    if (!cookie)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number; name: string };

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "me";

    // ✅ Incluimos usuario en ambos casos
    const txs =
      scope === "all"
        ? await prisma.tx.findMany({
            orderBy: { ts: "desc" },
            take: 100,
            include: { user: { select: { id: true, name: true } } },
          })
        : await prisma.tx.findMany({
            where: { userId: decoded.id },
            orderBy: { ts: "desc" },
            take: 50,
            include: { user: { select: { id: true, name: true } } },
          });

    // ✅ Aseguramos compatibilidad con deltaPoints y deltaPts
    return NextResponse.json({
      txs: txs.map((t) => ({
        id: t.id,
        type: t.type,
        valueId: t.valueId,
        qty: t.qty,
        deltaPoints: Number(t.deltaPoints ?? t.deltaPts ?? 0),
        ts: t.ts,
        userId: t.user?.id ?? decoded.id,
        userName: t.user?.name ?? decoded.name,
        note: t.note ?? null,
      })),
    });
  } catch (err) {
    console.error("❌ Error en /api/txs:", err);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
