import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export default async function handler(req, res) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expected =
    process.env.DEBUG_KEY || process.env.ADMIN_KEY || "superclave2025";
  if (key !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = process.env.DATABASE_URL || "";
  const host = db.split("@")[1]?.split("/")[0] || "unknown";
  return new Response(
    JSON.stringify({
      host,
      commit: process.env.VERCEL_GIT_COMMIT_SHA || "local",
      prismaClient: Prisma?.prismaVersion?.client || "unknown",
      nodeEnv: process.env.NODE_ENV,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
