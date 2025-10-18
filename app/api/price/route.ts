// app/api/price/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STEP_PERIOD_MS_DEFAULT = 5000; // cada 5s reales
const MAX_STEPS_PER_REQUEST = 1;     

// ===== Catálogo base =====
const DEFAULTS: Record<string, number> = {
  baumxp: 100, dsgmxp: 100, rftmxp: 100,
  krimxp: 40,  grmmxp: 40,  litmxp: 50,  hormxp: 55,
  sonmxp: 1,   sammxp: 1,
  wgrmxp: 1,   waumxp: 1,   wbtmxp: 1,   wxhmxp: 1,
  zhnmxp: 12,  anlmxp: 1,
  gzehntel: 12, gkrimi: 40, ggramm: 40, glit: 50, ghor: 55,
};

type Candle = { time: number; open: number; high: number; low: number; close: number };
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

// ===== Estado en memoria (persistente entre requests) =====
const state = {
  lastPrices: new Map<string, number>(),
  candlesBase: new Map<string, Candle[]>(),
  lastDayKey: "",
  lastBaseline: new Map<string, number>(),
  lastFactorsKey: "",
  lastTick: 0,
};

// ===== Utilidades =====
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

// ===== Leer factors.json =====
function loadFactors() {
  try {
    const filePath = path.join(process.cwd(), "data", "factors.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { date: null, volatility: 0.05, basePrices: {}, tickSeconds: 5, candleSeconds: 60 };
  }
}

// ===== Señales: archivo real -> público -> endpoint -> defaults =====
async function loadSignals(): Promise<Signals> {
  // 1) /data/signals.json
  const fromData = await readJsonSafe<Partial<Signals>>("data", "signals.json");
  if (fromData) return withSignalDefaults(fromData);

  // 2) /public/signals.json
  const fromPublic = await readJsonSafe<Partial<Signals>>("public", "signals.json");
  if (fromPublic) return withSignalDefaults(fromPublic);

  // 3) /api/signals (misma app)
  try {
    const res = await fetch("http://localhost:3000/api/signals", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as Partial<Signals>;
      return withSignalDefaults(data);
    }
  } catch {
    // ignorar y caer al default
  }

  // 4) Defaults
  return withSignalDefaults({});
}

function withSignalDefaults(s: Partial<Signals>): Signals {
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

// ===== Baseline diario =====
function computeDailyBaseline(sig: Signals, factors: any) {
  const A = 0.35, B = 0.45, C = 0.06;
  const R = sig.redemptionsScore ?? 0;
  const Y = sig.youtubeScore ?? 0;

  const baseline = new Map<string, number>();
  const mergedBases = { ...DEFAULTS, ...(factors.basePrices || {}) };

  for (const [id, base] of Object.entries(mergedBases)) {
    let mu = base * (1 + R + Y);

    // 🔹 Quitamos la influencia de "workers"
    if (["baumxp", "dsgmxp", "rftmxp"].includes(id)) {
      // Antes: mu *= 1 + B * ((s - 70) / 30);
      // Ahora: nada, se queda como está
    } else if (["krimxp", "grmmxp", "litmxp", "hormxp", "gkrimi", "ggramm", "glit", "ghor"].includes(id)) {
      const d = sig.demand[id] ?? 0;
      mu *= 1 + C * Math.tanh(d / 10);
    } else if (["zhnmxp", "gzehntel"].includes(id)) {
      mu *= 1 + A * ((sig.groupAvg - 75) / 25);
    }

    baseline.set(id, mu);
  }

  return baseline;
}


// ===== Velas =====
function pushBaseCandle(id: string, price: number, now: number, candleMs: number) {
  const arr = state.candlesBase.get(id) ?? [];
  const last = arr[arr.length - 1];

  if (!last || now - last.time >= candleMs) {
    arr.push({ time: now, open: price, high: price, low: price, close: price });
  } else {
    if (price > last.high) last.high = price;
    if (price < last.low)  last.low  = price;
    last.close = price;
  }
  state.candlesBase.set(id, arr.slice(-1000));
}

export async function GET() {
  const now = Date.now();

  const factors = loadFactors();
  const sig = await loadSignals();

  const VOLATILITY = (factors.volatility ?? sig.volatility ?? 0.05);
  const stepPeriodMs = (factors.tickSeconds ? factors.tickSeconds * 1000 : STEP_PERIOD_MS_DEFAULT);
  const candleMs = Math.max(1000, (factors.candleSeconds ? factors.candleSeconds * 1000 : 60_000));
  const dayKey = sig.dayKey ?? new Date().toISOString().slice(0, 10);

  // clave para detectar cambios sin reiniciar
  const fKey = JSON.stringify({
    date: factors.date ?? null,
    vol: VOLATILITY,
    basePrices: factors.basePrices ?? {},
  });

  // 1) Recalcular baseline si cambia día o factors
  if (dayKey !== state.lastDayKey || fKey !== state.lastFactorsKey) {
    state.lastBaseline = computeDailyBaseline(sig, factors);
    state.lastDayKey = dayKey;
    state.lastFactorsKey = fKey;
    state.lastTick = now;

    // primera siembra
    if (state.lastTick === 0) {
      state.lastTick = now;
      for (const [id, mu] of state.lastBaseline.entries()) {
        state.lastPrices.set(id, mu);
        pushBaseCandle(id, mu, now, candleMs);
      }
    }
  }

  // 2) Avanzar ticks SOLO si ya pasó stepPeriodMs
  if (state.lastTick === 0) state.lastTick = now;
  let steps = Math.floor((now - state.lastTick) / stepPeriodMs);
  if (steps > MAX_STEPS_PER_REQUEST) steps = MAX_STEPS_PER_REQUEST;
  if (steps < 0) steps = 0;
  steps = Math.min(1, steps);

  // Dinámica con media-reversión (OU)
  const k = 0.20;                 // fuerza de re-versión por tick (0–1)
  const sigma = VOLATILITY * 0.06;

for (let s = 0; s < steps; s++) {
  const tNow = state.lastTick + (s + 1) * stepPeriodMs;

  for (const [id, baseDefault] of Object.entries(DEFAULTS)) {
    const mu = state.lastBaseline.get(id) ?? baseDefault;

    // 1) prev primero
    const prev = state.lastPrices.get(id) ?? mu;

    // 2) luego la banda cap por paso (ej. 5%)
    const stepCap = 0.05; // prueba 0.02–0.05
    const bandLo = prev * (1 - stepCap);
    const bandHi = prev * (1 + stepCap);

    // 3) OU step
    const drift = k * (mu - prev);
    const noise = mu * sigma * randn();
    let next = prev + drift + noise;

    // 4) clamp
    if (next < bandLo) next = bandLo;
    if (next > bandHi) next = bandHi;

    next = +(next.toFixed(mu < 2 ? 4 : 2));
    state.lastPrices.set(id, next);
    pushBaseCandle(id, next, tNow, candleMs);
  }
}

  // actualiza el reloj SOLO si avanzaste
  if (steps > 0) state.lastTick += steps * stepPeriodMs;

  // 3) Serializa
  const PRICES: Record<string, number> = {};
  for (const [id, baseDefault] of Object.entries(DEFAULTS)) {
    const mu = state.lastBaseline.get(id) ?? baseDefault;
    PRICES[id] = state.lastPrices.get(id) ?? mu;
  }

  const candlesBaseObj: Record<string, Candle[]> = {};
  for (const [id, arr] of state.candlesBase.entries()) candlesBaseObj[id] = arr;

  return NextResponse.json({ prices: PRICES, candlesBase: candlesBaseObj, ts: now }, { status: 200 });
}
