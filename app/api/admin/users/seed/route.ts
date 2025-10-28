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

    console.log("🟡 Intentando actualizar:", { id, name, points });

    const existing = await prisma.user.findUnique({ where: { id } });
    console.log("🔍 Usuario existente:", existing ? existing.id : "NO ENCONTRADO");

    if (existing) {
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { name, nip, points },
      });
      console.log("🟢 Actualizado:", updatedUser.id, updatedUser.points);
      updated++;
    } else {
      const createdUser = await prisma.user.create({
        data: { id, name, nip, points },
      });
      console.log("🆕 Creado:", createdUser.id);
      created++;
    }
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
