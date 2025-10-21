// app/api/admin/summary/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Snapshot = { date: string; last_close: Record<string, number> };

// Directorios: en prod leemos/escribimos en /tmp, en local usamos ./data
const REPO_DIR = path.resolve(process.cwd(), "data");
const TMP_DIR  = path.join("/tmp", "data");

// Escoge un archivo dando preferencia a /tmp si existe, si no cae al repo
function preferTmp(file: string) {
  const pTmp  = path.join(TMP_DIR, file);
  try { if (fs.existsSync(pTmp)) return pTmp; } catch {}
  return path.join(REPO_DIR, file);
}

const HISTORY_PATH = preferTmp("history.json");
const STATE_PATH   = preferTmp("state_runtime.json");
const CONFIG_PATH  = preferTmp("config_static.json");
const DAILY_PATH   = preferTmp("daily_input.json");

function safeReadJSON<T>(p: string): { ok: boolean; data?: T; error?: string } {
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw) as T;
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function statInfo(p: string) {
  try {
    const st = fs.statSync(p);
    return {
      exists: true,
      size: st.size,
      mtime: st.mtime.toISOString(),
    };
  } catch {
    return { exists: false, size: 0, mtime: null as any };
  }
}

export async function GET() {
  try {
    // Salud de archivos (preferencia /tmp)
    const files = [
      { key: "config",  path: CONFIG_PATH },
      { key: "daily",   path: DAILY_PATH },
      { key: "state",   path: STATE_PATH },
      { key: "history", path: HISTORY_PATH },
    ] as const;

    const health: Record<string, {
      exists: boolean;
      size: number;
      mtime: string | null;
      parseOk: boolean;
      error?: string;
    }> = {};

    for (const f of files) {
      const st = statInfo(f.path);
      let parseOk = false, error: string | undefined = undefined;
      if (st.exists) {
        const r = safeReadJSON<any>(f.path);
        parseOk = r.ok;
        if (!r.ok) error = r.error;
      }
      health[f.key] = { ...st, parseOk, error };
    }

    // Datos de dashboard (tolerante a errores)
    const historySnap = safeReadJSON<Snapshot[]>(HISTORY_PATH);
    const stateSnap   = safeReadJSON<{ last_close: Record<string, number> }>(STATE_PATH);

    const history: Snapshot[] = historySnap.ok ? (historySnap.data as any) : [];
    const state = stateSnap.ok ? (stateSnap.data as any) : { last_close: {} };

    const last = history[history.length - 1] || null;
    const prev = history[history.length - 2] || null;

    const lastDate  = last?.date ?? null;
    const lastCount = last ? Object.keys(last.last_close).length : 0;

    // Top movers vs ayer
    const movers: Array<{ ticker: string; price: number; prev: number | null; d1pct: number | null; }> = [];
    if (last) {
      const prevMap = prev?.last_close ?? {};
      for (const [ticker, price] of Object.entries(last.last_close)) {
        const p0 = prevMap[ticker] as number | undefined;
        const d1pct = p0 != null && p0 > 0 ? (Number(price) / p0 - 1) : null;
        movers.push({ ticker, price: Number(price), prev: p0 ?? null, d1pct });
      }
    }

    const havePct = movers.filter(m => m.d1pct != null) as Array<Required<typeof movers[number]>>;
    const topGainers = [...havePct].sort((a,b)=> b.d1pct - a.d1pct).slice(0,5)
      .map(m => ({ ticker: m.ticker, d1pct: m.d1pct, price: m.price }));
    const topLosers  = [...havePct].sort((a,b)=> a.d1pct - b.d1pct).slice(0,5)
      .map(m => ({ ticker: m.ticker, d1pct: m.d1pct, price: m.price }));

    const recent = history.slice(-7).map(h => ({ date: h.date, count: Object.keys(h.last_close).length }));

    return NextResponse.json({
      ok: true,
      lastDate,
      lastCount,
      topGainers,
      topLosers,
      recent,
      lastClose: last?.last_close ?? state.last_close ?? {},
      health,
    });
  } catch (err:any) {
    console.error(err);
    return NextResponse.json({ ok:false, error: err?.message ?? "summary error" }, { status: 500 });
  }
}
