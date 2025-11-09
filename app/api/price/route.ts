// app/api/price/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== Catálogo base =====
const DEFAULTS: Record<string, number> = {
  baumxp: 110, dsgmxp: 95, rftmxp: 90,
  krimxp: 44, grmmxp: 43, litmxp: 55, hormxp: 54,
  sonmxp: 1.28, sammxp: 0.94,
  wgrmxp: 1.03, waumxp: 1, wbtmxp: 0.98, wxhmxp: 1.05,
  zhnmxp: 13.02, anlmxp: 1.02,
  gzehntel: 13.0, gkrimi: 44, ggramm: 43, glit: 55, ghor: 54,
};

// ===== Tipos =====
type Signals = {
  groupAvg: number;
  workers: Record<string, number>;
  demand: Record<string, number>;
  participations: { SON: number; SAM: number; expected: number; eta: number };
  redemptionsScore?: number;
  youtubeScore?: number;
  dayKey?: string;
  volatility?: number;
};

type ActiveCandle = { open: number; high: number; low: number; close: number; startedAt: number };
type State = {
  lastPrices: Map<string, number>;
  activeCandles: Map<string, ActiveCandle>;
  lastTick: number;
};

const state: State = {
  lastPrices: new Map(),
  activeCandles: new Map(),
  lastTick: 0,
};

// ===== Utils =====
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
async function readJsonSafe<T = any>(...parts: string[]): Promise<T | null> {
  try {
    const filePath = path.join(process.cwd(), ...parts);
    const txt = await fsp.readFile(filePath, "utf8");
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}
function loadFactors() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "factors.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return { date: null, volatility: 0.05, tickSeconds: 7 };
  }
}

// ===== Señales externas =====
async function loadSignals(): Promise<Signals> {
  const fromData = await readJsonSafe<Partial<Signals>>("data", "signals.json");
  if (fromData) return withDefaults(fromData);
  const fromPublic = await readJsonSafe<Partial<Signals>>("public", "signals.json");
  if (fromPublic) return withDefaults(fromPublic);
  return withDefaults({});
}
function withDefaults(s: Partial<Signals>): Signals {
  return {
    groupAvg: s.groupAvg ?? 75,
    workers: s.workers ?? { baumxp: 80, dsgmxp: 70, rftmxp: 85 },
    demand: s.demand ?? {},
    participations: s.participations ?? { SON: 30, SAM: 30, expected: 35, eta: 0.04 },
    redemptionsScore: s.redemptionsScore ?? 0,
    youtubeScore: s.youtubeScore ?? 0,
    dayKey: s.dayKey ?? new Date().toISOString().slice(0, 10),
    volatility: s.volatility ?? 0.05,
  };
}

// ===== Cargar precios iniciales =====
async function initializeLastPrices() {
  const lastCandles = await prisma.candle.groupBy({
    by: ["valueId"],
    _max: { time: true },
  });

  for (const row of lastCandles) {
    if (!row._max.time) continue;
    const last = await prisma.candle.findFirst({
      where: { valueId: row.valueId, time: row._max.time },
      orderBy: { time: "desc" },
    });
    if (last) state.lastPrices.set(row.valueId, last.close);
  }

  for (const [id, val] of Object.entries(DEFAULTS))
    if (!state.lastPrices.has(id)) state.lastPrices.set(id, val);

  console.log(`✅ Últimos precios cargados: ${state.lastPrices.size}`);
}

// ===== Temporalidades =====
const TIMEFRAMES = [
  { label: "5m", ms: 5 * 60_000 },
  { label: "15m", ms: 15 * 60_000 },
  { label: "1h", ms: 60 * 60_000 },
  { label: "4h", ms: 4 * 60 * 60_000 },
  { label: "1d", ms: 24 * 60 * 60_000 },
  { label: "1w", ms: 7 * 24 * 60 * 60_000 },
];

// ===== Actualización agrupada de velas =====
async function updateActiveCandle(id: string, price: number, now: number) {
  const ops = [];
  for (const { label, ms } of TIMEFRAMES) {
    const key = `${id}-${label}`;
    const currentBucket = Math.floor(now / ms) * ms;
    let active = state.activeCandles.get(key);
    if (!active) {
      active = { open: price, high: price, low: price, close: price, startedAt: currentBucket };
      state.activeCandles.set(key, active);
    }
    const activeBucket = Math.floor(active.startedAt / ms) * ms;
    if (currentBucket > activeBucket) {
      ops.push({
        valueId: id,
        timeframe: label,
        time: new Date(active.startedAt),
        ts: new Date(now),
        open: active.open,
        high: active.high,
        low: active.low,
        close: active.close,
      });
      active = { open: price, high: price, low: price, close: price, startedAt: currentBucket };
      state.activeCandles.set(key, active);
    }
    active.close = price;
    if (price > active.high) active.high = price;
    if (price < active.low) active.low = price;
  }
  if (ops.length) await prisma.candle.createMany({ data: ops, skipDuplicates: true });
}

// ===== Handler principal =====
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const key = url.searchParams.get("key");
  const ua = req.headers.get("user-agent")?.toLowerCase() || "";
  const isCron =
    key === process.env.CRON_SECRET ||
    key === "dev" ||
    ua.includes("cron") ||
    ua.includes("uptime");

  // === Lectura simple (frontend) ===
  if (mode === "read") {
    if (state.lastPrices.size === 0) await initializeLastPrices();
    const out: Record<string, number> = {};
    for (const [id, p] of state.lastPrices) out[id] = p;
    return NextResponse.json({ ok: true, prices: out });
  }

  const now = Date.now();
  const factors = loadFactors();
  const sig = await loadSignals();
  const VOL = factors.volatility ?? sig.volatility ?? 0.05;
  const TICK_MS = (factors.tickSeconds ?? 7) * 1000;

  if (state.lastPrices.size === 0) await initializeLastPrices();

  const steps = Math.max(1, Math.floor((now - state.lastTick) / TICK_MS));

  for (let s = 0; s < steps; s++) {
    const tNow = now - (steps - 1 - s) * TICK_MS;
    for (const [id, base] of Object.entries(DEFAULTS)) {
      const mu = base;
      const prev = state.lastPrices.get(id) ?? mu;
      const variation = randn() * VOL;
      let next = mu * (1 + variation);
      const maxDev = VOL;
      next = Math.min(mu * (1 + maxDev), Math.max(mu * (1 - maxDev), next));
      const alpha = 0.3;
      next = prev + alpha * (next - prev);
      next = +(next.toFixed(mu < 2 ? 4 : 2));
      state.lastPrices.set(id, next);
      await updateActiveCandle(id, next, tNow);
    }
  }

  state.lastTick = now;
  const out: Record<string, number> = {};
  for (const [id, p] of state.lastPrices) out[id] = p;

  return NextResponse.json({ ok: true, prices: out, ts: now }, { headers: { "Cache-Control": "no-store" } });
}
