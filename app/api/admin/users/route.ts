// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { requireAdmin } from "@/lib/auth";

// ⬇️ Ajusta este import a donde REALMENTE esté tu prisma.
// Si tu archivo está en "app/lib/prisma.ts", usa esta línea:
import { prisma } from "@/app/lib/prisma";
// Si lo tienes en "lib/prisma.ts", cámbialo a: import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Deriva rol solo para UI; no se guarda en DB */
function roleOf(id: string): "ADMIN" | "USER" {
  const list = (process.env.ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(id) ? "ADMIN" : "USER";
}

/** GET: listar usuarios (solo admin) */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  const enhanced = users.map((u) => ({
    id: u.id,
    name: u.name,
    points: Number(u.points), // Decimal -> number
    role: roleOf(u.id),
    createdAt: u.createdAt,
  }));

  return NextResponse.json({ users: enhanced });
}

/** POST: crear usuario (solo admin) */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const { id, name, code } = body as { id?: string; name?: string; code?: string };
  const points = typeof body.points === "number" ? body.points : 5; // default 5

  if (!id || !name || !code) {
    return NextResponse.json({ error: "Campos requeridos: id, name, code" }, { status: 400 });
  }

  try {
    const codeHash = await bcrypt.hash(code, 10);
    const u = await prisma.user.create({
      data: { id, name, codeHash, points },
    });
    return NextResponse.json({
      ok: true,
      user: { id: u.id, name: u.name, points: Number(u.points), role: roleOf(u.id) },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}

/** PUT: editar usuario (solo admin) */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const { id, newCode, newPoints } = body as { id?: string; newCode?: string; newPoints?: number };
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const data: any = {};
  if (typeof newPoints === "number") data.points = newPoints;
  if (typeof newCode === "string" && newCode.length > 0) data.codeHash = await bcrypt.hash(newCode, 10);

  try {
    const u = await prisma.user.update({ where: { id }, data });
    return NextResponse.json({
      ok: true,
      user: { id: u.id, name: u.name, points: Number(u.points), role: roleOf(u.id) },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}

/** DELETE: eliminar usuario (solo admin) */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}
