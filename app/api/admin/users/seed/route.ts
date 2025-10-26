export const runtime = "nodejs";

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { parse as parseCSV } from "csv-parse/sync";

type RowIn = Record<string, string | number | null | undefined>;
type Row = {
  id?: number;
  name: string;
  nip: string;
  role?: string;
  day?: string | null;
  points?: number | null;
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

function mapRow(r: RowIn): Row {
  const obj: Record<string, any> = {};
  for (const k of Object.keys(r)) {
    const key = normalizeHeader(k.replace(/^\uFEFF/, "")); // 🔹 quita BOM invisible si existe
    obj[key] = r[k];
  }

  const id = obj["id"] ? Number(obj["id"]) : undefined;
  const name = (obj["name"] ?? obj["user"] ?? "").toString().trim();
  const nip = (obj["password"] ?? obj["nip"] ?? obj["id"] ?? "").toString().trim();
  const day = obj["day"] != null ? String(obj["day"]).trim() || null : null;
  const role = (obj["role"] ?? "student").toString().trim() || "student";
  const points =
    obj["points"] != null && obj["points"] !== ""
      ? Number(String(obj["points"]).replace(",", "."))
      : null;

  return { id, name, nip, role, day, points };
}


async function upsertUsers(rows: Row[]) {
  let created = 0, updated = 0;
  const errors: Array<{ id?: number; error: string }> = [];

  for (const r of rows) {
    try {
      if (!r.id || !r.nip) {
        errors.push({ id: r.id, error: "id/nip requeridos" });
        continue;
      }

      const passwordHash = await bcrypt.hash(r.nip, 12);

      // Buscar por ID
      const prev = await prisma.user.findUnique({ where: { id: r.id } });

      if (prev) {
        await prisma.user.update({
          where: { id: r.id },
          data: {
            name: r.name,
            day: r.day ?? prev.day,
            password: passwordHash,   // ✅ actualiza hash
            nip: r.nip,               // guarda nip en texto claro si quieres
            points: r.points ?? prev.points, // ✅ actualiza puntos
          },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: {
            id: r.id,
            name: r.name,
            user: r.name.split(" ")[0].toLowerCase(), // opcional
            day: r.day ?? null,
            password: passwordHash,
            nip: r.nip,
            points: r.points ?? 0,
          },
        });
        created++;
      }
    } catch (e: any) {
      errors.push({ id: r.id, error: String(e?.message || e) });
    }
  }

  console.log(`✅ Usuarios creados: ${created}, actualizados: ${updated}`);
  return { created, updated, errors };
}


export async function POST(req: NextRequest) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
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
      const tryParse = (text: string) =>
        parseCSV(text, {
          columns: true,
          bom: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: [",", ";", "\t"],
          relax_column_count: true,
          relax_quotes: true,
        }) as RowIn[];

      let parsed: RowIn[] | null = null;
      let errorMsg = "";

      try {
        parsed = tryParse(buf.toString("utf8"));
      } catch (e: any) {
        errorMsg = String(e?.message || e);
      }

      if (!parsed) {
        try {
          parsed = tryParse(buf.toString("latin1"));
        } catch {}
      }

      if (!parsed) {
        const zeros = buf.slice(0, Math.min(buf.length, 2048)).filter((b) => b === 0).length;
        if (zeros > 10) {
          try {
            const textUtf16 = new TextDecoder("utf-16le").decode(buf);
            parsed = tryParse(textUtf16);
          } catch {}
        }
      }

      if (!parsed) {
        return Response.json(
          { error: "No pude leer el cuerpo", detail: errorMsg || "CSV no reconocido" },
          { status: 400 }
        );
      }

      rows = parsed.map(mapRow);
    }
  } catch (e: any) {
    return Response.json(
      { error: "No pude leer el cuerpo", detail: String(e?.message || e) },
      { status: 400 }
    );
  }

  const { created, updated, errors } = await upsertUsers(rows);
  return Response.json({
    ok: true,
    created,
    updated,
    errorsCount: errors.length,
    errors,
  });
}
