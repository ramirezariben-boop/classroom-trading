export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { parse as parseCSV } from "csv-parse/sync";
import https from "https";

// === Tipos ===
type RowIn = Record<string, string | number | null | undefined>;
type Row = {
  id?: number;
  name: string;
  nip: string;
  day?: string | null;
  points?: number | null;
};

// === Helpers ===
function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

// === Descargar CSV desde GitHub ===
async function fetchCSVFromGitHub(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https
      .get(
        "https://raw.githubusercontent.com/ramirezariben-boop/classroom-trading/main/data/users_utf8.csv",
        (res) => {
          const data: Uint8Array[] = [];
          res.on("data", (chunk) => data.push(chunk));
          res.on("end", () => resolve(Buffer.concat(data)));
        }
      )
      .on("error", reject);
  });
}

// === mapRow ===
function mapRow(r: RowIn): Row {
  const obj: Record<string, any> = {};
  for (const k of Object.keys(r)) {
    const key = normalizeHeader(k.replace(/^\uFEFF/, ""));
    obj[key] = r[k];
  }

  const id = obj["id"] ? Number(obj["id"]) : undefined;
  const name = (obj["name"] ?? "").toString().trim();
  const nip = (obj["password"] ?? obj["nip"] ?? "").toString().trim();
  const day = obj["day"] != null ? String(obj["day"]).trim() || null : null;
  const points =
    obj["points"] != null && obj["points"] !== ""
      ? Number(String(obj["points"]).replace(",", "."))
      : null;

  return { id, name, nip, day, points };
}

// === upsertUsers ===
async function upsertUsers(rows: Row[]) {
  let created = 0,
    updated = 0;
  const errors: Array<{ id?: number; error: string }> = [];
  const touched: number[] = [];

  const BATCH_SIZE = 10; // ⚡ Procesa 10 usuarios simultáneamente
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (r) => {
        try {
          if (!r.id || !r.nip) throw new Error("id/nip requeridos");
          const passwordHash = await bcrypt.hash(r.nip, 12);
          const prev = await prisma.user.findUnique({ where: { id: r.id } });

          if (prev) {
            await prisma.user.update({
              where: { id: r.id },
              data: {
                name: r.name,
                password: passwordHash,
                nip: r.nip,
                day: r.day ?? prev.day,
                points: r.points ?? prev.points,
              },
            });
            updated++;
          } else {
            await prisma.user.create({
              data: {
                id: r.id,
                name: r.name,
                password: passwordHash,
                nip: r.nip,
                day: r.day ?? null,
                points: r.points ?? 0,
              },
            });
            created++;
          }
          touched.push(r.id);
        } catch (e: any) {
          errors.push({ id: r.id, error: String(e?.message || e) });
        }
      })
    );
  }

  console.log("✅ Procesados:", touched.length, "IDs:", touched.slice(0, 10));
  return { created, updated, errors, touched };
}

// === GET ===
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (key !== "superclave2025") {
      return NextResponse.json({ error: "Clave incorrecta" }, { status: 403 });
    }

    console.log("🚀 Descargando CSV desde GitHub...");
    const buf = await fetchCSVFromGitHub();

    const tryParse = (text: string) =>
      parseCSV(text, {
        columns: true,
        bom: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: [",", ";", "\t"],
      }) as RowIn[];

    const parsed = tryParse(buf.toString("utf8"));
    const rows = parsed.map(mapRow);

    const count = rows.length;
    const ids = rows.map((r) => r.id).slice(0, 10);
    console.log("🟢 CSV leído con", count, "filas. Ejemplo de IDs:", ids);

    const { created, updated, errors, touched } = await upsertUsers(rows);

    console.log(`✅ Usuarios procesados: ${rows.length}`);
    return NextResponse.json({
      ok: true,
      message: `Actualización completa (${rows.length} registros)`,
      created,
      updated,
      errorsCount: errors.length,
      sampleIds: ids,
      touched: touched.slice(0, 10),
    });
  } catch (err: any) {
    console.error("❌ Error general en seed:", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
