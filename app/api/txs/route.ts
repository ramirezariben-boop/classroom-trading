// app/api/txs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readSessionFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TxType = "BUY" | "SELL" | "RESET" | "TRANSFER_IN" | "TRANSFER_OUT";

export async function GET(req: NextRequest) {
  try {
    // readSessionFromHeaders ahora es async y no recibe headers
    const { uid, role } = await readSessionFromHeaders();
    const scope = (req.nextUrl.searchParams.get("scope") ?? "me") as "me" | "all";

    if (scope === "all") {
      if (role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const txs = await prisma.tx.findMany({
        orderBy: { ts: "desc" },
        take: 500,
        include: { user: true }, // para userName
      });

      return NextResponse.json({
        txs: txs.map((t) => ({
          id: t.id,
          ts: t.ts.toISOString(),
          type: t.type as TxType,
          valueId: t.valueId ?? undefined,
          qty: t.qty ?? undefined,
          deltaPts: Number(t.deltaPts),
          userId: t.userId,
          userName: t.user?.name ?? undefined,
        })),
      });
    }

    // scope = "me"
    const mine = await prisma.tx.findMany({
      where: { userId: uid },
      orderBy: { ts: "desc" },
      take: 200,
    });

    return NextResponse.json({
      txs: mine.map((t) => ({
        id: t.id,
        ts: t.ts.toISOString(),
        type: t.type as TxType,
        valueId: t.valueId ?? undefined,
        qty: t.qty ?? undefined,
        deltaPts: Number(t.deltaPts),
      })),
    });
  } catch (e) {
    console.error("GET /api/txs error:", e);
    // Si la sesión falta/expiró, nuestra lib lanza "unauthorized"; si quieres,
    // podrías detectar ese mensaje y responder 401. Por ahora dejamos 500 genérico.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
