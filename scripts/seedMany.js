require("dotenv").config();
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const listArg = (process.argv[2] || "").trim();
    const csvPath = process.argv[3] || "./data/users.csv";
    if (!listArg) throw new Error("Uso: node scripts/seedMany.js rodrigo,paulina ./data/users.csv");

    const wanted = new Set(listArg.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
    const rows = parse(fs.readFileSync(csvPath), {
      columns: true, delimiter: ";", bom: true, skip_empty_lines: true,
    });

    for (const r of rows) {
      const user = String(r.user || "").trim().toLowerCase();
      if (!wanted.has(user)) continue;

      const name = String(r.name || "").trim();
      const day = String(r.day || "").trim();
      const nip = String(r.password ?? "").trim();
      if (!nip) { console.warn(`[skip] ${user}: NIP vacío`); continue; }

      const codeHash = await bcrypt.hash(nip, 10);
      const data = { userId: user, name, day, codeHash, points: 5 }; // ajusta campos según tu schema

      const saved = await prisma.user.upsert({
        where: { userId: user },
        update: { name, day, codeHash, points: 5 },
        create: data,
      });
      console.log(`[ok] ${saved.userId} (${saved.name})`);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
