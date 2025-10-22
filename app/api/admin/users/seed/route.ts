export const runtime = "nodejs";

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { parse as parseCSV } from "csv-parse/sync";

type RowIn = Record<string, string | number | null | undefined>;
type Row = { name: string; nip: string; role?: string; day?: string | null };

// normaliza encabezados: quita espacios y pasa a minúsculas
function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

// mapea tus columnas reales:
// name, day, id, user, password  (tabuladas)
// - name -> name
// - password o id -> nip (preferimos password; si falta, tomamos id)
// - day (opcional)
// - user lo ignoramos aquí (si lo necesitas, dime cómo guardarlo)
function mapRow(r: RowIn): Row {
  const obj: Record<string, any> = {};
  for (const k of Object.keys(r)) obj[normalizeHeader(k)] = r[k];

  const name = (obj["name"] ?? obj["username"] ?? obj["user"] ?? "").toString().trim();
  const nipRaw = (obj["password"] ?? obj["nip"] ?? obj["id"] ?? "").toString().trim();
  const nip = nipRaw;
  const day = obj["day"] != null ? String(obj["day"]).trim() || null : null;
  const role = (obj["role"] ?? "student").toString().trim() || "student";

  return { name, nip, role, day };
}

async function upsertUsers(rows: Row[]) {
  let created = 0, updated = 0;
  const errors: Array<{ name?: string; error: string }> = [];

  for (const r of rows) {
    try {
      if (!r.name || !r.nip) {
        errors.push({ name: r.name, error: "name/nip requeridos" });
        continue;
      }

      // Si tu NIP debe ser numérico, puedes validar aquí:
      // if (!/^\d{1,12}$/.test(r.nip)) { ... }

      const codeHash = await bcrypt.hash(r.nip, 12);

      // Tu User no tiene unique en "name", así que buscamos el existente por name
      const prev = await prisma.user.findFirst({ where: { name: r.name } });

      if (prev) {
        await prisma.user.update({
          where: { id: prev.id },           // id SÍ es único en tu modelo
          data: { codeHash, day: r.day ?? prev.day },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: {
            name: r.name,
            codeHash,
            day: r.day ?? null,
            // agrega aquí otros defaults que tu modelo exija, ej:
            // points: 0,
          },
        });
        created++;
      }
    } catch (e: any) {
      errors.push({ name: r.name, error: String(e?.message || e) });
    }
  }

  return { created, updated, errors };
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  const buf = Buffer.from(await req.arrayBuffer());

  let rows: Row[] = [];
  try {
    if (ct.includes("application/json")) {
      const data = JSON.parse(buf.toString("utf8"));
      const list = Array.isArray(data) ? data : data?.users;
      if (!Array.isArray(list)) {
        return Response.json({ error: "JSON debe ser array o {users:[...]}" }, { status: 400 });
      }
      rows = (list as RowIn[]).map(mapRow);
    } else {
      // CSV con delimitador flexible: coma, punto y coma, o tabulador
      const parsed = parseCSV(buf, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: [",", ";", "\t"],
      }) as RowIn[];
      rows = parsed.map(mapRow);
    }
  } catch (e: any) {
    return Response.json({ error: "No pude leer el cuerpo", detail: String(e?.message || e) }, { status: 400 });
  }

  const { created, updated, errors } = await upsertUsers(rows);
  return Response.json({ ok: true, created, updated, errorsCount: errors.length, errors });
}
