// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma"; // usa tu cliente prisma central

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Deriva rol solo para UI; no se guarda en DB */
function roleOf(id: number): "ADMIN" | "USER" {
  const list = (process.env.ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(String(id)) ? "ADMIN" : "USER";
}

/** GET: listar usuarios (solo admin) */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  const enhanced = users.map((u) => ({
    id: u.id,
    name: u.name,
    user: u.user ?? null,
    day: u.day ?? null,
    points: u.points,
    role: roleOf(u.id),
  }));

  return NextResponse.json({ users: enhanced });
}

/** POST: crear usuario (solo admin) */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const { id, name, password, user, day } = body as {
    id?: number | string;
    name?: string;
    password?: string; // clave de 4 cifras
    user?: string | null;
    day?: string | null;
  };
  const points =
    typeof body.points === "number" && Number.isFinite(body.points) ? body.points : 5;

  if (!id || !name || !password) {
    return NextResponse.json(
      { error: "Campos requeridos: id, name, password" },
      { status: 400 }
    );
  }

  try {
    const u = await prisma.user.create({
      data: {
        id: Number(id),
        name,
        password, // SIN hash (como acordamos)
        user: user ?? null,
        day: day ?? null,
        points,
      },
    });
    return NextResponse.json({
      ok: true,
      user: {
        id: u.id,
        name: u.name,
        user: u.user,
        day: u.day,
        points: u.points,
        role: roleOf(u.id),
      },
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
  const { id, newPassword, newPoints, user, day, name } = body as {
    id?: number | string;
    newPassword?: string;
    newPoints?: number;
    user?: string | null;
    day?: string | null;
    name?: string;
  };
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const data: any = {};
  if (typeof newPoints === "number" && Number.isFinite(newPoints)) data.points = newPoints;
  if (typeof newPassword === "string" && newPassword.length > 0) data.password = newPassword;
  if (typeof user !== "undefined") data.user = user;
  if (typeof day !== "undefined") data.day = day;
  if (typeof name === "string" && name.length > 0) data.name = name;

  try {
    const u = await prisma.user.update({ where: { id: Number(id) }, data });
    return NextResponse.json({
      ok: true,
      user: {
        id: u.id,
        name: u.name,
        user: u.user,
        day: u.day,
        points: u.points,
        role: roleOf(u.id),
      },
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
    await prisma.user.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 400 });
  }
}
