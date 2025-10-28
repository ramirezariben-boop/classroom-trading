import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parse as parseCSV } from "csv-parse/sync";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // === Autorización temporal con clave secreta ===
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // ==============================================

  try {
    const csvPath = path.join(process.cwd(), "data", "users_utf8.csv");

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ ok: false, error: "Archivo CSV no encontrado" }, { status: 404 });
    }

    const csvText = fs.readFileSync(csvPath, "utf8");
    const rows = parseCSV(csvText, { columns: true, skip_empty_lines: true });

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

for (const row of rows) {
  try {
    const id = Number(row.id);
    const name = String(row.name).trim();
    const nip = String(row.nip).trim();
    const points = Number(row.points) || 0;

    if (!id || !name || !nip) continue;

    await prisma.user.upsert({
      where: { id },
      update: {
        name,
        nip,
        points, // ⚡️ Forzamos actualización de puntos
      },
      create: {
        id,
        name,
        nip,
        points,
      },
    });

    updated++;
  } catch (err: any) {
    errors.push(err.message || String(err));
  }
}


    return NextResponse.json({
      ok: true,
      source: "local",
      rowsRead: rows.length,
      updated,
      created,
      errorsCount: errors.length,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 });
  }
}
