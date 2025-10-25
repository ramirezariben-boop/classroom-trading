import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
// quita requireAdmin aquí: usaremos una llave temporal por query

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expected =
    process.env.DEBUG_KEY || process.env.ADMIN_KEY || "superclave2025";

  // si no viene la llave correcta, responde unauthorized
  if (key !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = process.env.DATABASE_URL || "";
  const host = db.split("@")[1]?.split("/")[0] || "unknown";

  return NextResponse.json({
    host,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    prismaClient: Prisma?.prismaVersion?.client || "unknown",
    nodeEnv: process.env.NODE_ENV,
  });
}
