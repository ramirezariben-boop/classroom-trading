import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // host del servidor Postgres (útil para confirmar pooler/direct)
    const rs = await prisma.$queryRawUnsafe<any[]>('select inet_server_addr() as host');
    const host = rs?.[0]?.host ?? 'unknown';
    return NextResponse.json({ ok: true, dbHost: String(host) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
