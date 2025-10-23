export const runtime = "nodejs";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key") ?? req.nextUrl.searchParams.get("key");
  if (key !== process.env.ADMIN_KEY) return new Response("Unauthorized", { status: 401 });

  const [meta] = await prisma.$queryRaw<
    Array<{ current_database: string; current_user: string }>
  >`SELECT current_database(), current_user;`;

  const count = await prisma.user.count();

  return Response.json({
    db: meta?.current_database,
    user: meta?.current_user,
    userCount: count,
  });
}
