// app/api/transfer/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const toUserId = body.toUserId as string | undefined;
  const amount = Number(body.amount);

  if (!toUserId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Faltan datos válidos" }, { status: 400 });
  }

  console.log(`Transferencia simulada de ${amount} MXP a ${toUserId}`);

  return NextResponse.json({ ok: true, toUserId, amount }, { headers: { "Cache-Control": "no-store" } });
}
