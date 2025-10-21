// app/api/history/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_DIR = path.resolve(process.cwd(), "data");
const TMP_DIR  = path.join("/tmp", "data");

function preferTmp(file: string) {
  const tmp = path.join(TMP_DIR, file);
  try { if (fs.existsSync(tmp)) return tmp; } catch {}
  return path.join(REPO_DIR, file);
}

const HISTORY_PATH = preferTmp("history.json");

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("limit");
    let limit = Number(raw ?? "30");
    if (!Number.isFinite(limit) || limit <= 0) limit = 30;
    if (limit > 365) limit = 365;

    if (!fs.existsSync(HISTORY_PATH)) {
      return NextResponse.json({ ok: true, history: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const history: Array<{ date: string; last_close: Record<string, number> }> =
      JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));

    const sliced = history.slice(-limit);
    return NextResponse.json({ ok: true, history: sliced }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err?.message ?? "read error" }, { status: 500 });
  }
}
