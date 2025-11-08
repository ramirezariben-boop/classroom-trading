import { prisma } from "@/lib/prisma";
import fs from "fs";
import { parse } from "csv-parse/sync";

async function main() {
  const filePath = "data/users_utf8.csv";
  let csvContent = fs.readFileSync(filePath, "utf8");
  csvContent = csvContent.replace(/^\uFEFF/, ""); // elimina BOM

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📄 Leyendo ${rows.length} filas de ${filePath}...`);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const id = Number(row.id ?? row["﻿id"]);
    if (!id || Number.isNaN(id)) continue;

    const data = {
      name: String(row.name ?? "").trim(),
      day: String(row.day ?? "").trim() || null,
      user: String(row.user ?? "").trim() || null,
      password: String(row.password ?? "").trim(), // ✅ campo correcto
      nip: String(row.nip ?? "").trim() || null,   // ✅ separado de password
      points: Number(row.points ?? 0),             // ✅ puntos reales
    };

    await prisma.user.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });

    const exists = await prisma.user.findUnique({ where: { id } });
    if (exists) updated++;
    else created++;
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
