// app/api/state/route.ts
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

const CONFIG_PATH = preferTmp("config_static.json");
const STATE_PATH  = preferTmp("state_runtime.json");

export async function GET() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const state  = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
    return NextResponse.json({ ok: true, config, state }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err?.message ?? "read error" }, { status: 500 });
  }
}
