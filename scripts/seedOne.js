// scripts/seedOne.js  (ESM)
import 'dotenv/config'; // carga .env (usa override si quieres forzar)
// Si necesitas forzar ruta/override:
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const usernameArg = (process.argv[2] || '').trim().toLowerCase(); // ej: rodrigo
  const csvPath = process.argv[3] || './data/users.csv';
  if (!usernameArg) {
    console.error('Uso: node scripts/seedOne.js <usuario> [ruta_csv]');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`No existe el CSV: ${csvPath}`);
    process.exit(1);
  }

  // CSV con separador ';'
  const rows = parse(fs.readFileSync(csvPath), {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    bom: true,
  });

  const row = rows.find(
    (r) => String(r.user || '').trim().toLowerCase() === usernameArg
  );
  if (!row) {
    console.error(`No encontré al usuario "${usernameArg}" en el CSV.`);
    process.exit(1);
  }

  const name = String(row.name || '').trim();
  const day = String(row.day || '').trim();
  const user = String(row.user || '').trim().toLowerCase();
  const nip = String(row.password ?? '').trim();
  if (!nip) {
    console.error(`El usuario "${user}" no tiene NIP en CSV (password vacío).`);
    process.exit(1);
  }

  const codeHash = await bcrypt.hash(nip, 10);

  // ⚠️ Usa los nombres REALES de tu schema:
  // - `username` (no userId)
  // - update por `id` (único)
  const data = {
    username: user,
    name,
    day,
    codeHash,
    points: 5,
  };

  const existing = await prisma.user.findFirst({
    where: { username: user },
    select: { id: true },
  });

  let saved;
  if (existing) {
    saved = await prisma.user.update({
      where: { id: existing.id },
      data,
    });
  } else {
    saved = await prisma.user.create({ data });
  }

  console.log('Listo. Usuario grabado:', {
    id: saved.id,
    username: saved.username,
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
  .finally(async () => {
    await prisma.$disconnect();
  });
