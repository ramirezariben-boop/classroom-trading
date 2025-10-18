// scripts/syncUsers.js
// Uso:
//   npm run sync:users -- ./data/users.json
//   npm run sync:users -- ./data/users.csv
//
// Soporta JSON (array de objetos) o CSV (cabeceras: name,day,id,user,password,points)

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseCSV(raw) {
  // Limpia BOM y normaliza saltos de línea
  raw = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();

  // Detecta delimitador: coma, punto y coma o tabulador
  const firstLine = raw.split("\n")[0];
  const delim = firstLine.includes(";") ? ";" : (firstLine.includes("\t") ? "\t" : ",");

  const lines = raw.split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split(delim).map((h) => h.trim().toLowerCase());
  const idx = (key) => header.indexOf(key);

  const nameIdx = idx("name");
  const idIdx   = idx("id");
  const userIdx = idx("user");
  const passIdx = idx("password");
  const dayIdx  = idx("day");
  const ptsIdx  = idx("points");

  if (nameIdx < 0 || idIdx < 0) {
    console.error("❌ Encabezados detectados:", header);
    console.error("   Se requiere al menos: name,id (y opcionalmente: day,user,password,points).");
    return [];
  }

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delim).map((s) => s.trim());
    const row = {
      name: parts[nameIdx] ?? "",
      id: (parts[idIdx] ?? "").toString(),
      user: userIdx >= 0 ? (parts[userIdx] ?? "") : "",
      day: dayIdx >= 0 ? (parts[dayIdx] ?? "") : "",
      code: passIdx >= 0 ? (parts[passIdx] ?? "") : "",
      points: ptsIdx >= 0 && parts[ptsIdx] !== "" ? Number(parts[ptsIdx]) : undefined,
    };
    out.push(row);
  }
  return out;
}

function normalizeUser(u) {
  // id y name obligatorios (como en tu versión)
  const id = String(u.id ?? "").trim();
  const name = String(u.name ?? "").trim();
  if (!id || !name) return null;

  const codeRaw = u.code != null ? String(u.code).trim() : "";
  const code = codeRaw || `TEMP-${Math.floor(1000 + Math.random() * 9000)}`;

  const points = Number.isFinite(Number(u.points)) ? Number(u.points) : 1000;

  // Campos opcionales (no se usan si tu modelo no los tiene)
  const user = u.user != null ? String(u.user).trim() : "";
  const day = u.day != null ? String(u.day).trim() : "";

  return { id, name, code, points, user, day, hasTemp: !codeRaw };
}

async function main() {
  try {
    const argFile = process.argv[2];
    if (!argFile) {
      console.error("❌ Uso: npm run sync:users -- <ruta a users.json|users.csv>");
      process.exit(1);
    }

    const file = path.resolve(argFile);
    if (!fs.existsSync(file)) {
      console.error(`❌ No existe el archivo: ${file}`);
      process.exit(1);
    }

    const ext = path.extname(file).toLowerCase();
    const raw = fs.readFileSync(file, "utf8");
    let list;

    if (ext === ".json") {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("users.json debe ser un array");
      list = parsed;
    } else if (ext === ".csv") {
      list = parseCSV(raw);
    } else {
      console.error("❌ Extensión no soportada. Usa .json o .csv");
      process.exit(1);
    }

    let ok = 0, skipped = 0;

    for (const u of list) {
      const n = normalizeUser(u);
      if (!n) {
        skipped++;
        console.warn("⚠️  Registro inválido, falta id o name:", u);
        continue;
      }

      const codeHash = await bcrypt.hash(n.code, 10);

      // ⬇️ Minimal: solo los campos que ya tenías
      await prisma.user.upsert({
        where: { id: n.id },
        update: { name: n.name, points: n.points, codeHash },
        create: { id: n.id, name: n.name, points: n.points, codeHash },
      });

      // Si TU MODELO tiene campos extra (p. ej. username/day), descomenta y ajusta:

      /*
      await prisma.user.upsert({
        where: { id: n.id },
        update: { name: n.name, points: n.points, codeHash, username: n.user || undefined, day: n.day || undefined },
        create: { id: n.id, name: n.name, points: n.points, codeHash, username: n.user || undefined, day: n.day || undefined },
      });
      */

      ok++;
      const tag = n.hasTemp ? "temp" : "ok";
      console.log(`✅ ${String(n.id).padEnd(4)} | ${String(n.user || "").padEnd(10)} | ${n.name} (${tag})`);
    }

    console.log(`\n🎉 Sincronización terminada. OK: ${ok} · Omitidos: ${skipped}`);
  } catch (e) {
    console.error("❌ Error:", e?.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
