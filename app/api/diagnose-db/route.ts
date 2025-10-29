import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { safePrisma } from "@/app/lib/safePrisma";

/**
 * GET /api/diagnose-db
 * Prueba la conexión a PostgreSQL usando Prisma.
 * Devuelve tiempo de respuesta, estado y mensaje de diagnóstico.
 */
export async function GET() {
  const start = Date.now();
  let ok = false;
  let message = "Sin errores";

  try {
    // Ejecuta una consulta mínima, protegida con safePrisma
    await safePrisma(() => prisma.$queryRaw`SELECT 1`);
    ok = true;
  } catch (err: any) {
    message = `❌ Error: ${err.message || "desconocido"}`;
    console.error("⛔ Error en /api/diagnose-db:", err);
  }

  const ms = Date.now() - start;

  return NextResponse.json(
    {
      ok,
      latencyMs: ms,
      message,
      checkedAt: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

// === Loop interno opcional de diagnóstico cada 60 s ===
if (!(globalThis as any).__DIAG_LOOP__) {
  (globalThis as any).__DIAG_LOOP__ = true;

  (async function loop() {
    while (true) {
      try {
        await fetch("http://localhost:3000/api/diagnose-db?ping=1");
      } catch (err) {
        console.error("⚠️ Error en loop de diagnóstico:", err);
      }
      await new Promise((r) => setTimeout(r, 60_000)); // cada 60 s
    }
  })();
}
