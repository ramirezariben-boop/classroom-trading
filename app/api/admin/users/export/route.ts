// app/api/admin/users/export/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function toCsv(rows: Array<Record<string, any>>): string {
  if (!rows.length) return "id,name,user,points,day\r\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[\",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))];
  return lines.join("\r\n") + "\r\n";
}

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      user: true,   // ← antes era username
      points: true,
      day: true,
    },
  });

  const csv = toCsv(users as any[]);
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
