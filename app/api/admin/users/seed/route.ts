export const runtime = "nodejs";

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { parse as parseCSV } from "csv-parse/sync";

type RowIn = Record<string, string | number | null | undefined>;
type Row = { username: string; nip: string; role?: string };

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}
function mapRow(r: RowIn): Row {
  const obj: Record<string, any> = {};
  for (const k of Object.keys(r)) obj[normalizeHeader(k)] = r[k];

  const username =
    (obj["username"] ?? obj["user"] ?? obj["name"] ?? "").toString().trim();
  const nip = (obj["nip"] ?? obj["password"] ?? "").toString().trim();
  const role = (obj["role"] ?? "student").toString().trim() || "student";
  return { username, nip, role };
}

async function upsertUsers(rows: Row[]) {
  let created = 0, updated = 0;
  const errors: Array<{ username?: string; error: string }> = [];

  for (const r of rows) {
    try {
      if (!r.username || !r.nip) {
        errors.push({ username: r.username, error: "username/nip requeridos" });
        continue;
      }
      const nipHash = await bcrypt.hash(r.nip, 12);

      const prev = await prisma.user.findUnique({ where: { username: r.username } });
      if (prev) {
        await prisma.user.update({ where: { username: r.username }, data: { nipHash, role: r.role ?? "student" } });
        updated++;
      } else {
        await prisma.user.create({ data: { username: r.username, nipHash, role: r.role ?? "student" } });
        created++;
      }
    } catch (e: any) {
      errors.push({ username: r.username, error: String(e?.message || e) });
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
