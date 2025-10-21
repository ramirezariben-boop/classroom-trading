// app/api/state/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "config_static.json");
const STATE_PATH  = path.join(DATA_DIR, "state_runtime.json");

export async function GET() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const state  = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
    return NextResponse.json({ ok: true, config, state });
  } catch (err:any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err?.message ?? "read error" }, { status: 500 });
  }
}
