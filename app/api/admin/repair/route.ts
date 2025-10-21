// app/api/admin/repair/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR     = path.resolve(process.cwd(), "data");
const HISTORY_PATH = path.join(DATA_DIR, "history.json");
const STATE_PATH   = path.join(DATA_DIR, "state_runtime.json");

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

export async function POST(req: Request) {
  try {
    const { target } = await req.json().catch(() => ({} as any));
    if (!target || !["history", "state"].includes(target)) {
      return NextResponse.json({ ok:false, error:"Parámetro inválido: target" }, { status: 400 });
    }

    ensureDataDir();

    if (target === "history") {
      fs.writeFileSync(HISTORY_PATH, JSON.stringify([], null, 2), "utf-8");
      return NextResponse.json({ ok:true, repaired:"history" });
    }

    if (target === "state") {
      fs.writeFileSync(STATE_PATH, JSON.stringify({ last_close: {} }, null, 2), "utf-8");
      return NextResponse.json({ ok:true, repaired:"state" });
    }

    return NextResponse.json({ ok:false, error:"Target desconocido" }, { status: 400 });
  } catch (err:any) {
    console.error("repair error:", err);
    return NextResponse.json({ ok:false, error:String(err?.message||err) }, { status: 500 });
  }
}
