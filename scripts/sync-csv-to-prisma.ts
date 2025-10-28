import { prisma } from "@/lib/prisma";
import fs from "fs";
import { parse } from "csv-parse/sync";

async function main() {
  const filePath = "data/users_utf8.csv";
  let csvContent = fs.readFileSync(filePath, "utf8");
  csvContent = csvContent.replace(/^\uFEFF/, ""); // 💥 elimina el BOM

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📄 Leyendo ${rows.length} filas de ${filePath}...`);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    // Asegura que funcione aunque el encabezado tuviera BOM
    const id = Number(row.id ?? row["﻿id"]);
    if (!id || Number.isNaN(id)) continue;

    const data = {
      name: String(row.name ?? "").trim(),
      day: String(row.day ?? "").trim(),
      user: String(row.user ?? "").trim(),
      nip: String(row.password ?? "").trim(),
      points: Number(row.points ?? 0),
    };

    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing) {
      await prisma.user.update({ where: { id }, data });
      updated++;
    } else {
      await prisma.user.create({ data: { id, ...data } });
      created++;
    }
  }

  console.log("✅ Sincronización completada");
  console.log(`   → ${updated} actualizados`);
  console.log(`   → ${created} creados`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
