export const runtime = "nodejs";

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { parse as parseCSV } from "csv-parse/sync";

type RowIn = Record<string, string | number | null | undefined>;
type Row = { name: string; nip: string; role?: string; day?: string | null };

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}
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
      const codeHash = await bcrypt.hash(r.nip, 12);

      // Tu modelo no tiene unique(name), así que buscamos por name y actualizamos por id
      const prev = await prisma.user.findFirst({ where: { name: r.name } });
      if (prev) {
        await prisma.user.update({
          where: { id: prev.id },
          data: { codeHash, day: r.day ?? prev.day },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: { name: r.name, codeHash, day: r.day ?? null },
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
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const buf = Buffer.from(await req.arrayBuffer());

  let rows: Row[] = [];

  try {
    if (ct.includes("application/json")) {
      // JSON: asumimos UTF-8
      const data = JSON.parse(buf.toString("utf8"));
      const list = Array.isArray(data) ? data : data?.users;
      if (!Array.isArray(list)) {
        return Response.json({ error: "JSON debe ser array o {users:[...]}" }, { status: 400 });
      }
      rows = (list as RowIn[]).map(mapRow);
    } else {
      // CSV/TSV: primero probamos UTF-8 (aceptando BOM), si falla intentamos Latin-1 y luego UTF-16 LE
      const tryParse = (text: string) =>
        parseCSV(text, {
          columns: true,
          bom: true,                 // acepta UTF-8 con BOM
          skip_empty_lines: true,
          trim: true,
          delimiter: [",", ";", "\t"],
          relax_column_count: true,
          relax_quotes: true,
        }) as RowIn[];

      let parsed: RowIn[] | null = null;
      let errorMsg = "";

      // 1) UTF-8
      try { parsed = tryParse(buf.toString("utf8")); } catch (e: any) { errorMsg = String(e?.message || e); }

      // 2) Latin-1 si falló
      if (!parsed) {
        try { parsed = tryParse(buf.toString("latin1")); } catch {}
      }

      // 3) UTF-16 LE heurístico (si hay muchos 0x00)
      if (!parsed) {
        const zeros = buf.slice(0, Math.min(buf.length, 2048)).filter(b => b === 0).length;
        if (zeros > 10) {
          try {
            const textUtf16 = new TextDecoder("utf-16le").decode(buf);
            parsed = tryParse(textUtf16);
          } catch {}
        }
      }

      if (!parsed) {
        return Response.json({ error: "No pude leer el cuerpo", detail: errorMsg || "CSV no reconocido" }, { status: 400 });
      }

      rows = parsed.map(mapRow);
    }
  } catch (e: any) {
    return Response.json({ error: "No pude leer el cuerpo", detail: String(e?.message || e) }, { status: 400 });
  }

  const { created, updated, errors } = await upsertUsers(rows);
  return Response.json({ ok: true, created, updated, errorsCount: errors.length, errors });
}
