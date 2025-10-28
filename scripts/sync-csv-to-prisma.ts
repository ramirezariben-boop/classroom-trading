import fs from "fs";
import path from "path";
import { parse as parseCSV } from "csv-parse/sync";
import { prisma } from "@/app/lib/prisma";

async function main() {
  const filePath = path.join(process.cwd(), "data", "users_utf8.csv");
  if (!fs.existsSync(filePath)) {
    console.error("❌ No se encontró el archivo CSV:", filePath);
    process.exit(1);
  }

  const csvText = fs.readFileSync(filePath, "utf8");
  const rows = parseCSV(csvText, { columns: true, skip_empty_lines: true });
  console.log(`📄 Leyendo ${rows.length} filas de users_utf8.csv...`);

  let updated = 0;
  let created = 0;
  let errors: string[] = [];

  for (const row of rows) {
    try {
      const id = Number(row.id);
      const name = String(row.name).trim();
      const nip = String(row.nip).trim();
      const points = Number(row.points) || 0;
      const day = row.day ? String(row.day).trim() : null;
      const user = row.user ? String(row.user).trim() : null;
      const password = row.password ? String(row.password).trim() : "";

      if (!id || !name || !nip) continue;

      const existing = await prisma.user.findUnique({ where: { id } });

      if (existing) {
        await prisma.user.update({
          where: { id },
          data: { name, nip, points, day, user, password },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: { id, name, nip, points, day, user, password },
        });
        created++;
      }
    } catch (err: any) {
      console.error("⚠️ Error en fila:", err.message);
      errors.push(err.message);
    }
  }

  console.log(`✅ Sincronización completada`);
  console.log(`   → ${updated} actualizados`);
  console.log(`   → ${created} creados`);
  if (errors.length) console.log(`   ⚠️ ${errors.length} errores`);
}

main()
  .catch((err) => {
    console.error("❌ Error general:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
