// app/api/admin/users/snapshot/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { put } from "@vercel/blob";

function toCsv(rows: Array<Record<string, any>>): string {
  if (!rows.length) return "id,name,username,points,day,createdAt,updatedAt\r\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => esc(r[h])).join(",")),
  ];
  return lines.join("\r\n") + "\r\n";
}

export async function POST() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, username: true, points: true, day: true, createdAt: true, updatedAt: true },
  });

  const csv = toCsv(users);
  const now = new Date();
  const key = `snapshots/users/${now.toISOString().replace(/[:.]/g, "-")}.csv`;

  const { url } = await put(key, new Blob([csv], { type: "text/csv" }), { access: "public" });
  return NextResponse.json({ ok: true, url });
}
