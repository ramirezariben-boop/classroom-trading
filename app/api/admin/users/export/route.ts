import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => x.trim().toLowerCase());

function toCsv(rows: Array<Record<string, any>>): string {
  if (!rows.length) return "id,points\r\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    // 👇 Forzar formato numérico sin separadores ni comas
    if (typeof v === "number") return String(Number(v.toFixed(4))).replace(",", ".");
    const s = String(v);
    if (/[\",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))];
  return lines.join("\r\n") + "\r\n";
}

export async function GET() {
  try {
    const cookie = cookies().get("session_token");
    if (!cookie)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as {
      id: number;
      name: string;
      role?: string;
    };

    // 🧩 Confirmar admin
    const isAdmin =
      decoded.role === "ADMIN" ||
      ADMIN_IDS.includes(String(decoded.name).toLowerCase());

    if (!isAdmin)
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

    // 📊 Obtener usuarios
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: { id: true, points: true },
    });

    // 🧾 Generar CSV estable
    const csv = toCsv(users as any[]);
    const now = new Date();
    const fname = `users_points-${now.toISOString().replace(/[:.]/g, "-")}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("❌ Error exportando usuarios:", err);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
