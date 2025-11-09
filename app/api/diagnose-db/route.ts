// app/api/diagnose-db/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { safePrisma } from "@/app/lib/safePrisma";

/**
 * GET /api/diagnose-db
 * Prueba la conexión a PostgreSQL usando Prisma.
 */
export async function GET() {
  const start = Date.now();
  let ok = false;
  let message = "Sin errores";

  try {
    await safePrisma(() => prisma.$queryRaw`SELECT 1`);
    ok = true;
  } catch (err: any) {
    message = `❌ Error: ${err.message || "desconocido"}`;
    console.error("⛔ Error en /api/diagnose-db:", err);
  }

  const latencyMs = Date.now() - start;
  return NextResponse.json(
    { ok, latencyMs, message, checkedAt: new Date().toISOString() },
    {
      status: ok ? 200 : 500,
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    }
  );
}
