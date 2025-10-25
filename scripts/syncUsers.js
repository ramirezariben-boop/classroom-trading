// scripts/syncUsers.js
// Uso:
//   node scripts/syncUsers.js ./data/users_utf8.csv
//
// Soporta CSV con cabeceras: id,name,day,user,password,points

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseCSV(raw) {
  raw = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (key) => header.indexOf(key);

  const nameIdx = idx("name");
  const idIdx = idx("id");
  const userIdx = idx("user");
  const passIdx = idx("password");
  const dayIdx = idx("day");
  const ptsIdx = idx("points");

  if (nameIdx < 0 || idIdx < 0) {
    console.error("❌ Encabezados detectados:", header);
    console.error("   Se requiere al menos: id,name (y opcionalmente: day,user,password,points).");
    return [];
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((s) => s.trim());
    if (!parts[idIdx] || !parts[nameIdx]) continue;

    out.push({
      id: Number(parts[idIdx]),
      name: parts[nameIdx],
      user: userIdx >= 0 ? parts[userIdx] : "",
      password: passIdx >= 0 ? parts[passIdx] : "",
      day: dayIdx >= 0 ? parts[dayIdx] : "",
      points: ptsIdx >= 0 && parts[ptsIdx] !== "" ? Number(parts[ptsIdx]) : 10,
    });
  }
  return out;
}

async function main() {
  const argFile = process.argv[2];
  if (!argFile) {
    console.error("❌ Uso: node scripts/syncUsers.js ./data/users_utf8.csv");
    process.exit(1);
  }

  const file = path.resolve(argFile);
  if (!fs.existsSync(file)) {
    console.error(`❌ No existe el archivo: ${file}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(file, "utf8");
  const list = parseCSV(raw);
  if (!list.length) {
    console.error("❌ No se pudieron leer usuarios del CSV.");
    process.exit(1);
  }

  let ok = 0;
  for (const u of list) {
    const hash = await bcrypt.hash(u.password || "0000", 10);

    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        name: u.name,
        points: u.points ?? 10,
        password: hash,
        day: u.day,
        user: u.user,
      },
      create: {
        id: u.id,
        name: u.name,
        points: u.points ?? 10,
        password: hash,
        day: u.day,
        user: u.user,
      },
    });

    console.log(`✅ ${u.id} | ${u.user} | ${u.name}`);
    ok++;
  }

  console.log(`\n🎉 Sincronización completada. ${ok} usuarios actualizados.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
