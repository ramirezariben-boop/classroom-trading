// app/api/price/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { prisma } from "@/app/lib/prisma"; // ✅ corregido: solo prisma

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== Catálogo base =====
const DEFAULTS: Record<string, number> = {
  baumxp: 110, dsgmxp: 95, rftmxp: 90,
  krimxp: 42, grmmxp: 41, litmxp: 50, hormxp: 56,
  sonmxp: 1.2, sammxp: 0.99,
  wgrmxp: 1, waumxp: 1, wbtmxp: 1, wxhmxp: 1,
  zhnmxp: 12.8, anlmxp: 1,
  gzehntel: 12.8, gkrimi: 42, ggramm: 41, glit: 50, ghor: 55,
};

// ===== Tipos =====
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

// ===== Estado global =====
type ActiveCandle = { open: number; high: number; low: number; close: number; startedAt: number };
type State = {
  lastPrices: Map<string, number>;
  activeCandles: Map<string, ActiveCandle>;
  lastDayKey: string;
  lastBaseline: Map<string, number>;
  lastFactorsKey: string;
  lastTick: number;
};

const state: State =
  (globalThis as any).__PRICE_STATE__ ??
  ((globalThis as any).__PRICE_STATE__ = {
    lastPrices: new Map(),
    activeCandles: new Map(),
    lastDayKey: "",
    lastBaseline: new Map(),
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

function loadFactors() {
  try {
    const filePath = path.join(process.cwd(), "data", "factors.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { date: null, volatility: 0.05, basePrices: {}, tickSeconds: 7, candleSeconds: 300 };
  }
}

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

function computeDailyBaseline(sig: Signals, factors: any) {
  const A = 0.35, C = 0.06;
  const R = sig.redemptionsScore ?? 0;
  const Y = sig.youtubeScore ?? 0;
  const baseline = new Map<string, number>();
  const mergedBases = { ...DEFAULTS, ...(factors.basePrices || {}) };

  for (const [id, base] of Object.entries(mergedBases)) {
    let mu = base * (1 + R + Y);
    if (
      ["krimxp", "grmmxp", "litmxp", "hormxp", "gkrimi", "ggramm", "glit", "ghor"].includes(id)
    ) {
      const d = sig.demand[id] ?? 0;
      mu *= 1 + C * Math.tanh(d / 10);
    } else if (["zhnmxp", "gzehntel"].includes(id)) {
      mu *= 1 + A * ((sig.groupAvg - 75) / 25);
    }
    baseline.set(id, mu);
  }
  return baseline;
}

// ===== Temporalidades =====
const TIMEFRAMES = [
  { label: "5m", ms: 10_000 },
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
    let active = state.activeCandles.get(key);

    // Crear vela inicial si no existe
    if (!active) {
      active = { open: price, high: price, low: price, close: price, startedAt: now };
      state.activeCandles.set(key, active);
      continue;
    }

    // Actualizar valores high/low/close
    active.close = price;
    if (price > active.high) active.high = price;
    if (price < active.low) active.low = price;

    // Cuando se cumple la duración del timeframe (ej. 5m)
    if (now - active.startedAt >= ms) {
      const candle = { ...active };

      try {
        // ==== Control de límite (1500 velas por timeframe) ====
        const count = await prisma.candle.count({ where: { valueId: id, timeframe: label } });
        if (count >= 1500) {
          const oldest = await prisma.candle.findFirst({
            where: { valueId: id, timeframe: label },
            orderBy: { ts: "asc" },
            select: { time: true },
          });
          if (oldest) {
            await prisma.candle.deleteMany({
              where: { valueId: id, timeframe: label, time: oldest.time },
            });
          }
        }

        // ==== Crear la nueva vela ====
        await prisma.candle.create({
          data: {
            valueId: id,
            timeframe: label,
            ts: new Date(candle.startedAt),
            time: BigInt(candle.startedAt),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          },
        });

        console.log(`💾 Vela cerrada ${id} (${label}) ${new Date(candle.startedAt).toLocaleString()}`);
      } catch (err) {
        console.error(`⚠️ Error guardando vela ${id} (${label}):`, err);
      }

      // Reiniciar la vela activa
      state.activeCandles.set(key, {
        open: price,
        high: price,
        low: price,
        close: price,
        startedAt: now,
      });
    }
  }
}

// ===== Loop automático =====
if (!(globalThis as any).__PRICE_LOOP__) {
  (globalThis as any).__PRICE_LOOP__ = true;
  const TICK_INTERVAL = 7000;
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  (async function loop() {
    while (true) {
      try {
        await fetch(`${BASE_URL}/api/price?key=${process.env.CRON_SECRET || "dev"}`).catch(() => {});
      } catch (err) {
        console.error("⛔ Loop interno de price falló:", err);
      }
      await new Promise((r) => setTimeout(r, TICK_INTERVAL));
    }
  })();
}

// ===== Handler principal =====
export async function GET(req: Request) {
  const ua = req.headers.get("user-agent")?.toLowerCase() || "";
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const isCron =
    key === process.env.CRON_SECRET ||
    ua.includes("cron") ||
    ua.includes("uptime") ||
    ua.includes("monitor");

  if (isCron) console.log("⏰ CronJob ejecutó actualización silenciosa", new Date().toISOString());

  const now = Date.now();
  const factors = loadFactors();
  const sig = await loadSignals();
  const VOLATILITY = factors.volatility ?? sig.volatility ?? 0.05;
  const TICK_MS = (factors.tickSeconds ?? 7) * 1000;

  const dayKey = sig.dayKey ?? new Date().toISOString().slice(0, 10);
  const fKey = JSON.stringify({ date: factors.date ?? null, vol: VOLATILITY });
  if (dayKey !== state.lastDayKey || fKey !== state.lastFactorsKey) {
    state.lastBaseline = computeDailyBaseline(sig, factors);
    state.lastDayKey = dayKey;
    state.lastFactorsKey = fKey;
  }

  if (state.lastTick === 0) state.lastTick = now;

  const steps = Math.max(1, Math.floor((now - state.lastTick) / TICK_MS));
  const k = 0.25;
  const sigma = VOLATILITY * 0.3;
  const stepCap = 0.02;

  for (let s = 0; s < steps; s++) {
    const tNow = state.lastTick + (s + 1) * TICK_MS;
    for (const [id, baseDefault] of Object.entries(DEFAULTS)) {
      const mu = state.lastBaseline.get(id) ?? baseDefault;
      const prev = state.lastPrices.get(id) ?? mu;
      const bandLo = prev * (1 - stepCap);
      const bandHi = prev * (1 + stepCap);
      const drift = k * (mu - prev);
      const noise = mu * sigma * randn();
      let next = prev + drift + noise;
      next = Math.min(bandHi, Math.max(bandLo, next));
      next = +(next.toFixed(mu < 2 ? 4 : 2));
      state.lastPrices.set(id, next);

      void updateActiveCandle(id, next, tNow);
    }
  }

  state.lastTick = now;

  const PRICES: Record<string, number> = {};
  for (const [id, mu] of Object.entries(DEFAULTS))
    PRICES[id] = state.lastPrices.get(id) ?? mu;

  if (isCron) return NextResponse.json({ ok: true, ts: now });

  return NextResponse.json(
    { ok: true, prices: PRICES, ts: now },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
