// app/api/transfer/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { toUserId, amount } = await req.json();
  if (!toUserId || !amount) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  // Aquí podrías guardar en DB o actualizar saldo
  console.log(`Transferencia simulada de ${amount} MXP a ${toUserId}`);

  return NextResponse.json({ ok: true, toUserId, amount });
}
