// app/api/price/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { prisma } from "@/app/lib/prisma";

// ===== Cola de escritura =====
const writeQueue: (() => Promise<void>)[] = [];
let writing = false;
async function enqueueWrite(fn: () => Promise<void>) {
  writeQueue.push(fn);
  if (!writing) {
    writing = true;
    while (writeQueue.length > 0) {
      const task = writeQueue.shift();
      if (task) {
        try {
          await task();
        } catch (err) {
          console.error("❌ Error en escritura Prisma:", err);
        }
      }
    }
    writing = false;
  }
}

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
  lastDayKey: string;
  lastBaseline: Map<string, number>;
  lastFactorsKey: string;
  lastTick: number;
};

const state: State = {
  lastPrices: new Map(),
  activeCandles: new Map(),
  lastDayKey: "",
  lastBaseline: new Map(),
  lastFactorsKey: "",
  lastTick: 0,
};

// ===== Utils =====
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function isVercelRuntime() {
  return !!process.env.VERCEL || !!process.env.NEXT_RUNTIME;
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
    const filePath = path.join(process.cwd(), "data", "factors.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { date: null, volatility: 0.05, basePrices: {}, tickSeconds: 7, candleSeconds: 300 };
  }
}

// ===== Cargar señales =====
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

// ===== Inicializar últimos precios desde DB =====
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

  // Si faltan, usar DEFAULTS
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

// ===== Gestión de velas activas =====
async function updateActiveCandle(id: string, price: number, now: number) {
  for (const { label, ms } of TIMEFRAMES) {
    const key = `${id}-${label}`;
    const currentBucket = Math.floor(now / ms) * ms;

    // 🔹 Buscar la última vela guardada en DB si no existe en memoria
    let active = state.activeCandles.get(key);
    if (!active) {
      const last = await prisma.candle.findFirst({
        where: { valueId: id, timeframe: label },
        orderBy: { time: "desc" },
      });

      if (last) {
        active = {
          open: last.close,
          high: last.close,
          low: last.close,
          close: last.close,
          startedAt: Number(last.time),
        };
      } else {
        active = {
          open: price,
          high: price,
          low: price,
          close: price,
          startedAt: currentBucket,
        };
      }
      state.activeCandles.set(key, active);
    }

    // 🔸 Si el tiempo actual ya pasó al siguiente bucket, cerrar la vela anterior
    const activeBucket = Math.floor(active.startedAt / ms) * ms;
    if (currentBucket > activeBucket) {
      const candle = { ...active };

      await prisma.candle.upsert({
        where: {
          valueId_timeframe_time: {
            valueId: id,
            timeframe: label,
            time: new Date(candle.startedAt),
          },
        },
        update: {
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          ts: new Date(now),
        },
        create: {
          valueId: id,
          timeframe: label,
          ts: new Date(now),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          time: new Date(candle.startedAt),
        },
      });

      // 🔁 Crear una nueva vela desde el cierre anterior
      active = {
        open: candle.close,
        high: candle.close,
        low: candle.close,
        close: candle.close,
        startedAt: currentBucket,
      };
      state.activeCandles.set(key, active);
    }

    // 🔹 Actualizar precios dentro de la vela actual
    active.close = price;
    if (price > active.high) active.high = price;
    if (price < active.low) active.low = price;
  }
}


// ===== Handler principal =====
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const ua = req.headers.get("user-agent")?.toLowerCase() || "";
  const isCron =
    key === process.env.CRON_SECRET ||
    key === "dev" ||
    ua.includes("cron") ||
    ua.includes("uptime") ||
    ua.includes("monitor");

  const now = Date.now();
  const factors = loadFactors();
  const sig = await loadSignals();
  const VOLATILITY = factors.volatility ?? sig.volatility ?? 0.05;
  const TICK_MS = (factors.tickSeconds ?? 7) * 1000;

  // Inicializar precios solo la primera vez
  if (state.lastPrices.size === 0) await initializeLastPrices();

  const steps = Math.max(1, Math.floor((now - state.lastTick) / TICK_MS));
  const k = 0.25;
  const sigma = VOLATILITY * 0.3;
  const stepCap = 0.02;

  for (let s = 0; s < steps; s++) {
    const tNow = now - (steps - 1 - s) * TICK_MS;

    for (const [id, baseDefault] of Object.entries(DEFAULTS)) {
      const mu = baseDefault;
      const prev = state.lastPrices.get(id) ?? mu;
      const drift = k * (mu - prev);
      const noise = mu * sigma * randn();
      let next = prev + drift + noise;
      const bandLo = prev * (1 - stepCap);
      const bandHi = prev * (1 + stepCap);
      next = Math.min(bandHi, Math.max(bandLo, next));
      next = +(next.toFixed(mu < 2 ? 4 : 2));
      state.lastPrices.set(id, next);
      await updateActiveCandle(id, next, tNow);
    }
  }

  state.lastTick = now;

  const PRICES: Record<string, number> = {};
  for (const [id, p] of state.lastPrices) PRICES[id] = p;

  if (isCron) return NextResponse.json({ ok: true, ts: now });
  return NextResponse.json({ ok: true, prices: PRICES, ts: now }, { headers: { "Cache-Control": "no-store" } });
}
