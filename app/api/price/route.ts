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
  baumxp: 126, dsgmxp: 110, rftmxp: 96,
  krimxp: 46, grmmxp: 46, litmxp: 53, hormxp: 57,
  sonmxp: 1.32, sammxp: 1.08,
  anwmpx: 86.03,
  xhamxp: 2.95,
  aufmxp: 90.63,
  notmxp: 81.01,
  zhnmxp: 13.4, anlmxp: 1.05,
  gzehntel: 13.4, gkrimi: 46, ggramm: 46, glit: 53, ghor: 57,
};

// ✅ Actualizar indicadores automáticamente desde factors-history.json
async function updateIndicatorsFromFactors() {
  try {
    const filePath = path.join(process.cwd(), "public", "factors-history.json");
    if (!fs.existsSync(filePath)) {
      console.warn("⚠️ No se encontró factors-history.json");
      return;
    }

    const raw = await fsp.readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    // === 1. Asistencia promedio ===
    const asistenciaSab = data.asistencia?.sabado?.at(-1)?.valor ?? 0;
    const asistenciaDom = data.asistencia?.domingo?.at(-1)?.valor ?? 0;
    const asistenciaProm = (asistenciaSab + asistenciaDom) / 2;

    // === 2. Tareas extra (ratio tareas/alumno) ===
    const tareasSab = data.tareas_extra?.sabado?.at(-1)?.valor ?? 0;
    const tareasDom = data.tareas_extra?.domingo?.at(-1)?.valor ?? 0;
    const tareasProm = (tareasSab + tareasDom) / 2;

    // === 3. Calificaciones tareas ===
    const tareasNotasSab = data.tareas?.sabado?.at(-1)?.valor ?? 0;
    const tareasNotasDom = data.tareas?.domingo?.at(-1)?.valor ?? 0;
    const tareasNotasProm = (tareasNotasSab + tareasNotasDom) / 2;

    // === 4. Calificaciones exámenes ===
    const notasSab = data.calificaciones?.sabado?.at(-1)?.valor ?? 0;
    const notasDom = data.calificaciones?.domingo?.at(-1)?.valor ?? 0;
    const notasProm = (notasSab + notasDom) / 2;

    // 🧮 Actualizar DEFAULTS en memoria
    if (asistenciaProm) DEFAULTS.anwmpx = Number(asistenciaProm.toFixed(2));
    if (tareasProm) DEFAULTS.xhamxp = Number(tareasProm.toFixed(2));
    if (tareasNotasProm) DEFAULTS.aufmxp = Number(tareasNotasProm.toFixed(2));
    if (notasProm) DEFAULTS.notmxp = Number(notasProm.toFixed(2));

    console.log("📊 Indicadores actualizados desde factors-history.json:", {
      anwmpx: DEFAULTS.anwmpx,
      xhamxp: DEFAULTS.xhamxp,
      aufmxp: DEFAULTS.aufmxp,
      notmxp: DEFAULTS.notmxp,
    });
  } catch (err) {
    console.error("❌ Error al actualizar indicadores:", err);
  }
}


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

    // 🔹 1️⃣ Actualiza los indicadores ANWMXP, XHAMXP, AUFMXP, NOTMXP
  await updateIndicatorsFromFactors();

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


  const TICK_MS = (factors.tickSeconds ?? 7) * 1000;

  if (state.lastPrices.size === 0) await initializeLastPrices();

  const steps = Math.max(1, Math.floor((now - state.lastTick) / TICK_MS));

  for (let s = 0; s < steps; s++) {
  const tNow = now - (steps - 1 - s) * TICK_MS;

  for (const [id, base] of Object.entries(DEFAULTS)) {
    const mu = base;
    const prev = state.lastPrices.get(id) ?? mu;

    // 🔹 Volatilidad diferenciada por tipo
    const isIndicator = ["anwmpx", "xhamxp", "aufmxp", "notmxp"].includes(id);
    const VOL = isIndicator ? 0.03 : factors.volatility ?? sig.volatility ?? 0.05;

    // 🔹 Escala de estabilización (evita explosiones en valores < 10)
    const scale = mu < 10 ? 0.002 : 1; // 0.2 % máx. si el valor base es muy bajo

    const variation = randn() * VOL * scale;
    let next = mu * (1 + variation);

    // 🔹 Límites dinámicos
    const maxDev = VOL * scale;
    next = Math.min(mu * (1 + maxDev), Math.max(mu * (1 - maxDev), next));

    // 🔹 Límite especial: sonmxp y sammxp no pueden superar 2.5
    if (["sonmxp", "sammxp"].includes(id) && next > 2.5) {
      next = 2.5;
    }

    // 🔹 Piso mínimo (nunca bajan de 0.5)
if (["sonmxp", "sammxp"].includes(id) && next < 0.5) {
  next = 0.5;
}


    // 🔹 Suavizado para evitar saltos bruscos
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
