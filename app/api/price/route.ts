// app/api/price/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
// ⬇️ AJUSTA ESTA RUTA a donde esté tu prisma:
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STEP_PERIOD_MS_DEFAULT = 5000; // cada 5s reales
const MAX_STEPS_PER_REQUEST = 1;     // evita encadenar pasos en una sola request

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

// ===== Estado en memoria (persiste entre requests/reloads) =====
type State = {
  lastPrices: Map<string, number>;
  candlesBase: Map<string, Candle[]>;
  lastDayKey: string;
  lastBaseline: Map<string, number>;
  lastFactorsKey: string;
  lastTick: number;
};

const state: State = (globalThis as any).__PRICE_STATE__ ?? ((globalThis as any).__PRICE_STATE__ = {
  lastPrices: new Map<string, number>(),
  candlesBase: new Map<string, Candle[]>(),
  lastDayKey: "",
  lastBaseline: new Map<string, number>(),
  lastFactorsKey: "",
  lastTick: 0,
});

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

// ===== Factors =====
function loadFactors() {
  try {
    const filePath = path.join(process.cwd(), "data", "factors.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { date: null, volatility: 0.05, basePrices: {}, tickSeconds: 5, candleSeconds: 60 };
  }
}

// ===== Signals: data -> public -> endpoint -> defaults =====
async function loadSignals(): Promise<Signals> {
  const fromData = await readJsonSafe<Partial<Signals>>("data", "signals.json");
  if (fromData) return withSignalDefaults(fromData);

  const fromPublic = await readJsonSafe<Partial<Signals>>("public", "signals.json");
  if (fromPublic) return withSignalDefaults(fromPublic);

  try {
    const res = await fetch("http://localhost:3000/api/signals", { cache: "no-store" });
    if (res.ok) return withSignalDefaults(await res.json());
  } catch {}

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
  const A = 0.35, /*B = 0.45,*/ C = 0.06; // B eliminado (sin efecto workers)
  const R = sig.redemptionsScore ?? 0;
  const Y = sig.youtubeScore ?? 0;

  const baseline = new Map<string, number>();
  const mergedBases = { ...DEFAULTS, ...(factors.basePrices || {}) };

  for (const [id, base] of Object.entries(mergedBases)) {
    let mu = base * (1 + R + Y);

    // Acciones: SIN influencia de "workers"
    if (["baumxp", "dsgmxp", "rftmxp"].includes(id)) {
      // mu = mu;
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

// ===== Velas (persistencia con Prisma) =====
function pushBaseCandle(id: string, price: number, now: number, candleMs: number) {
  const arr = state.candlesBase.get(id) ?? [];
  const last = arr[arr.length - 1];

  const openNew = !last || now - last.time >= candleMs;

 if (openNew) {
  const candle = { time: now, open: price, high: price, low: price, close: price };
  arr.push(candle);
  state.candlesBase.set(id, arr.slice(-1000));

  // Guarda SOLO cuando abre una vela nueva
  void prisma.candle.create({
    data: {
      valueId: id,
      time: BigInt(candle.time),   // ✅ agregado
      timeframe: "1m",
      ts: new Date(candle.time),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    },
  }).catch(() => {});

  return;
}


  // Actualiza vela abierta en memoria
  if (price > last.high) last.high = price;
  if (price < last.low)  last.low  = price;
  last.close = price;
  state.candlesBase.set(id, arr.slice(-1000));

  // ⬇️ CAMBIO CLAVE: update → upsert (si no existe, la crea)
// CUANDO ACTUALIZAS LA VELA ABIERTA
void prisma.candle.upsert({
  where: { valueId_time: { valueId: id, time: BigInt(last.time) } },
  update: { high: last.high, low: last.low, close: last.close },
  create: {
    valueId: id,
    time: BigInt(last.time),
    open: last.open,
    high: last.high,
    low: last.low,
    close: last.close,
  },
}).catch(() => {});

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

  // Precarga últimas N velas desde DB si el cache está vacío
  const PRELOAD = 144; // ~24h si candle≈10 min
  if (state.candlesBase.size === 0) {
    for (const id of Object.keys(DEFAULTS)) {
      try {
        // ⬇️ TRAE DESC y luego invierte para ascendente
       const rows = await prisma.candle.findMany({
  where: { valueId: id },
  orderBy: { time: "desc" },
  take: PRELOAD,
});
        if (rows.length) {
          const asc = rows.slice().reverse();
          state.candlesBase.set(
            id,
            asc.map(r => ({
  time: new Date(r.ts).getTime(),
  open: r.open, high: r.high, low: r.low, close: r.close,
}))

          );
          const last = asc[asc.length - 1];
          state.lastPrices.set(id, last.close);
        }
      } catch {}
    }
  }

  // Recalcular baseline si cambia día o factors (y resetear reloj)
  if (dayKey !== state.lastDayKey || fKey !== state.lastFactorsKey) {
    state.lastBaseline = computeDailyBaseline(sig, factors);
    state.lastDayKey = dayKey;
    state.lastFactorsKey = fKey;
    state.lastTick = now;

    // Si no hay precios cargados (ni DB ni memoria), sembrar con baseline + guardar una vela
    if (state.lastPrices.size === 0) {
      for (const [id, mu] of state.lastBaseline.entries()) {
        state.lastPrices.set(id, mu);
        pushBaseCandle(id, mu, now, candleMs);
      }
    }
  }

  // Avanzar ticks SOLO si ya pasó stepPeriodMs
  if (state.lastTick === 0) state.lastTick = now;
  let steps = Math.floor((now - state.lastTick) / stepPeriodMs);
  if (steps > MAX_STEPS_PER_REQUEST) steps = MAX_STEPS_PER_REQUEST;
  if (steps < 0) steps = 0;

  // OU params
  const k = 0.20;                 // fuerza de reversión por tick (0–1)
  const sigma = VOLATILITY * 0.06;
  const stepCap = 0.02;           // Máx ±2% por tick

  for (let s = 0; s < steps; s++) {
    const tNow = state.lastTick + (s + 1) * stepPeriodMs;

    for (const [id, baseDefault] of Object.entries(DEFAULTS)) {
      const mu = state.lastBaseline.get(id) ?? baseDefault;
      const prev = state.lastPrices.get(id) ?? mu;

      const bandLo = prev * (1 - stepCap);
      const bandHi = prev * (1 + stepCap);

      const drift = k * (mu - prev);
      const noise = mu * sigma * randn();
      let next = prev + drift + noise;

      if (next < bandLo) next = bandLo;
      if (next > bandHi) next = bandHi;

      next = +(next.toFixed(mu < 2 ? 4 : 2));
      state.lastPrices.set(id, next);
      pushBaseCandle(id, next, tNow, candleMs);
    }
  }

  if (steps > 0) state.lastTick += steps * stepPeriodMs;

  // Serializa
  const PRICES: Record<string, number> = {};
  for (const [id, baseDefault] of Object.entries(DEFAULTS)) {
    const mu = state.lastBaseline.get(id) ?? baseDefault;
    PRICES[id] = state.lastPrices.get(id) ?? mu;
  }

  const candlesBaseObj: Record<string, Candle[]> = {};
  for (const [id, arr] of state.candlesBase.entries()) candlesBaseObj[id] = arr;

  return NextResponse.json(
    { prices: PRICES, candlesBase: candlesBaseObj, ts: now },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
