import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { parse } from "csv-parse/sync";

const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => x.trim().toLowerCase());

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const cookie = cookies().get("session_token");
    if (!cookie)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as { id: number; name: string; role?: string };
    const isAdmin =
      decoded.role === "ADMIN" ||
      ADMIN_IDS.includes(decoded.name.toLowerCase());

    if (!isAdmin)
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file)
      return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });

    const text = await file.text();
    const records = parse(text, { columns: true, skip_empty_lines: true });

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const r of records) {
      const id = Number(r.id);
      let deltaStr = String(r.points ?? "").trim();

      if (!id || deltaStr === "") {
        skipped++;
        continue;
      }

      // Detectar si es incremento o valor absoluto
      const isRelative = /^[+\-]/.test(deltaStr);
      const delta = Number(deltaStr);

      if (isNaN(delta)) {
        skipped++;
        continue;
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        notFound++;
        continue;
      }

      if (isRelative) {
        // ➕ Sumar/restar puntos
        await prisma.user.update({
          where: { id },
          data: { points: { increment: delta } },
        });
      } else {
        // 🔁 Valor absoluto (reemplazo)
        await prisma.user.update({
          where: { id },
          data: { points: delta },
        });
      }

      updated++;
    }

    return NextResponse.json({ ok: true, updated, skipped, notFound });
  } catch (err) {
    console.error("❌ Error en import:", err);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
