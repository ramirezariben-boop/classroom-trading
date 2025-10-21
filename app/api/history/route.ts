import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const HISTORY_PATH = path.join(DATA_DIR, "history.json");

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "30");

    if (!fs.existsSync(HISTORY_PATH)) {
      return NextResponse.json({ ok: true, history: [] });
    }
    const history: Array<{ date:string; last_close: Record<string, number> }> =
      JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));

    const sliced = history.slice(-limit);
    return NextResponse.json({ ok: true, history: sliced });
  } catch (err:any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err?.message ?? "read error" }, { status: 500 });
  }
}
