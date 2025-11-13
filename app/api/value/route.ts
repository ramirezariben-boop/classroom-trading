import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 📊 Devuelve todos los valores (id, name, price)
export async function GET() {
  try {
    const values = await prisma.value.findMany({
      select: { id: true, name: true, price: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({
      ok: true,
      total: values.length,
      values,
    });
  } catch (err) {
    console.error("❌ Error en /api/value:", err);
    return NextResponse.json({ ok: false, error: "Error al leer valores" }, { status: 500 });
  }
}
