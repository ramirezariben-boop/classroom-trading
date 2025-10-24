// app/api/admin/users/export/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // tu cliente prisma (ya fix)

function toCsv(rows: Array<Record<string, any>>): string {
  if (!rows.length) return "id,name,username,points,day,createdAt,updatedAt\r\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // escapar comillas y envolver si hay coma, comilla o salto de línea
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","), // encabezado
    ...rows.map(r => headers.map(h => esc(r[h])).join(",")),
  ];
  return lines.join("\r\n") + "\r\n";
}

export async function GET() {
  // Nota: No exportamos NIP porque NO lo guardas en texto plano (tienes codeHash)
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      points: true,
      day: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const csv = toCsv(users);
  const now = new Date();
  const fname = `users-${now.toISOString().replace(/[:.]/g, "-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
