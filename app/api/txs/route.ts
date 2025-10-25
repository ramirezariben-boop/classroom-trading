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
    const cookie = cookies().get("session_token");
    if (!cookie)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number; name: string };

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "me";

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
          });

    return NextResponse.json({
      txs: txs.map((t) => ({
        id: t.id,
        type: t.type,
        valueId: t.valueId,
        qty: t.qty,
        deltaPts: t.deltaPts,
        ts: t.ts,
        userId: "user" in t ? t.user.id : decoded.id,
        userName: "user" in t ? t.user.name : decoded.name,
      })),
    });
  } catch (err) {
    console.error("❌ Error en /api/txs:", err);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
