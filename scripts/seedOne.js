require("dotenv").config();

// scripts/seedOne.js
/* Ejecuta: node scripts/seedOne.js rodrigo ./data/users.csv */
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const username = (process.argv[2] || "").toLowerCase();
  const csvPath = process.argv[3] || "./data/users.csv";

  if (!username) {
    console.error("Uso: node scripts/seedOne.js <usuario> [ruta_csv]");
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`No existe el CSV: ${csvPath}`);
    process.exit(1);
  }

  // Lee CSV con separador ';'
  const raw = fs.readFileSync(csvPath);
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ";",
    bom: true,
  });

  const row = rows.find(
    (r) => String(r.user || "").trim().toLowerCase() === username
  );

  if (!row) {
    console.error(`No encontré al usuario "${username}" en el CSV.`);
    process.exit(1);
  }

  const name = String(row.name || "").trim();
  const day = String(row.day || "").trim();
  const user = String(row.user || "").trim();
  const nip = String(row.password ?? "").trim(); // NIP en CSV
  const csvId = row.id ? Number(row.id) : undefined;

  if (!nip) {
    console.error(`El usuario "${user}" no tiene NIP en CSV (password vacío).`);
    process.exit(1);
  }

  // Hashea el NIP
  const codeHash = await bcrypt.hash(nip, 10);

  // Ajusta estos nombres de campos según tu schema:
  // - Si tu campo se llama passwordHash en lugar de codeHash, cámbialo abajo.
  // - Si "userId" en DB es "user" o "username", cámbialo en where / create / update.
  // - Si id es Int y único, puedes usar where: { id: csvId } en vez de userId.
  const data = {
    userId: user,          // <-- cámbialo si tu clave única se llama distinto
    name: name,
    day: day,
    codeHash: codeHash,    // <-- cámbialo a passwordHash si así está en tu schema
    points: 5,             // arranque con 5 puntos como pediste
  };

  // Construye where usando tu campo único real:
  const where = { userId: user }; // <-- ajusta si tu unique es otro campo

  // Limpia undefined
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  const saved = await prisma.user.upsert({
    where,
    update: {
      name: data.name,
      day: data.day,
      codeHash: data.codeHash, // o passwordHash
      points: data.points,
    },
    create: data,
  });

  console.log("Listo. Usuario upserted:");
  console.log({
    id: saved.id,
    userId: saved.userId,
    name: saved.name,
    day: saved.day,
    points: saved.points,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
