// app/api/admin/summary/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR     = path.resolve(process.cwd(), "data");
const HISTORY_PATH = path.join(DATA_DIR, "history.json");
const STATE_PATH   = path.join(DATA_DIR, "state_runtime.json");
const CONFIG_PATH  = path.join(DATA_DIR, "config_static.json");
const DAILY_PATH   = path.join(DATA_DIR, "daily_input.json");

type Snapshot = { date: string; last_close: Record<string, number> };

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
    // Archivos a inspeccionar
    const files = [
      { key: "config",  path: CONFIG_PATH },
      { key: "daily",   path: DAILY_PATH },
      { key: "state",   path: STATE_PATH },
      { key: "history", path: HISTORY_PATH },
    ] as const;

    const health = {} as Record<string, {
      exists: boolean;
      size: number;
      mtime: string | null;
      parseOk: boolean;
      error?: string;
    }>;

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

    // Carga datos para el resto del dashboard (tolerante a errores)
    const historySnap = safeReadJSON<Snapshot[]>(HISTORY_PATH);
    const stateSnap   = safeReadJSON<{ last_close: Record<string, number> }>(STATE_PATH);

    const history: Snapshot[] = historySnap.ok ? (historySnap.data as any) : [];
    const state = stateSnap.ok ? (stateSnap.data as any) : { last_close: {} };

    const last = history[history.length - 1] || null;
    const prev = history[history.length - 2] || null;

    const lastDate = last?.date ?? null;
    const lastCount = last ? Object.keys(last.last_close).length : 0;

    // Top movers vs ayer
    let movers: Array<{
      ticker: string;
      price: number;
      prev: number | null;
      d1pct: number | null;
    }> = [];

    if (last) {
      const prevMap = prev?.last_close ?? {};
      for (const [ticker, price] of Object.entries(last.last_close)) {
        const p0 = prevMap[ticker] as number | undefined;
        const d1pct = p0 != null && p0 > 0 ? (Number(price) / p0 - 1) : null;
        movers.push({ ticker, price: Number(price), prev: p0 ?? null, d1pct });
      }
    }

    const havePct = movers.filter(m => m.d1pct != null) as Array<Required<typeof movers[number]>>;
    const topGainers = [...havePct].sort((a,b)=> b.d1pct - a.d1pct).slice(0,5);
    const topLosers  = [...havePct].sort((a,b)=> a.d1pct - b.d1pct).slice(0,5);

    const recent = history.slice(-7).map(h => ({ date: h.date, count: Object.keys(h.last_close).length }));

    return NextResponse.json({
      ok: true,
      lastDate,
      lastCount,
      topGainers: topGainers.map(m => ({ ticker: m.ticker, d1pct: m.d1pct, price: m.price })),
      topLosers:  topLosers.map(m => ({ ticker: m.ticker, d1pct: m.d1pct, price: m.price })),
      recent,
      lastClose: last?.last_close ?? state.last_close ?? {},
      health, // 👈 NUEVO
    });
  } catch (err:any) {
    console.error(err);
    return NextResponse.json({ ok:false, error: err?.message ?? "summary error" }, { status: 500 });
  }
}
