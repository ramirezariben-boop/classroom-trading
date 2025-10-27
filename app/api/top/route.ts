// app/api/top/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 📁 Archivo donde se guarda el top5 semanal
const CACHE_FILE = path.join(process.cwd(), "public", "top5_cache.json");

// 🧮 Calcula la próxima fecha de lunes 6:00 p.m. hora de México
function nextMondayAt18() {
  const now = new Date();
  const next = new Date(now);
  const day = now.getDay(); // 0=Dom, 1=Lun, ...
  const daysToMonday = (1 - day + 7) % 7 || 7;
  next.setDate(now.getDate() + daysToMonday);
  next.setHours(18, 0, 0, 0);
  return next;
}

// 🚀 API principal
export async function GET() {
  try {
    // 🔹 Intenta leer el cache existente
    let cached: any = null;
    try {
      const raw = await fs.readFile(CACHE_FILE, "utf8");
      cached = JSON.parse(raw);
    } catch {
      // si no existe, lo generamos más abajo
    }

    const now = new Date();
    const nextUpdate = cached?.nextUpdate ? new Date(cached.nextUpdate) : null;

    // ✅ Si el cache sigue siendo válido, úsalo
    if (cached && nextUpdate && now < nextUpdate) {
      return NextResponse.json(cached);
    }

    // ⚙️ Recalcula top5 desde Prisma
    const users = await prisma.user.findMany({
      where: { NOT: { id: 64 } },
      orderBy: { points: "desc" },
      take: 5,
      select: { id: true, name: true, points: true },
    });

    const top5 = users.map((u) => ({
      id: u.id,
      user: u.name,
      points: Number(u.points ?? 0),
    }));

    const payload = {
      ok: true,
      generatedAt: now.toISOString(),
      nextUpdate: nextMondayAt18().toISOString(),
      top5,
    };

    // 💾 Guarda en cache
    await fs.writeFile(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("❌ Error en /api/top:", err);
    return NextResponse.json(
      { error: "No se pudo obtener el top 5" },
      { status: 500 }
    );
  }
}
