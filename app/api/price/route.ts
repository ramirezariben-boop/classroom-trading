import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== CONFIGURACIÓN =====
const QUIET_MODE = true; // 💤 Silencia logs extensos
const DEFAULT_LIMIT = 300; // Máximo de velas por activo y temporalidad

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
    if (!fs.existsSync(filePath)) return;

    const raw = await fsp.readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    const asistenciaSab = data.asistencia?.sabado?.at(-1)?.valor ?? 0;
    const asistenciaDom = data.asistencia?.domingo?.at(-1)?.valor ?? 0;
    const tareasSab = data.tareas_extra?.sabado?.at(-1)?.valor ?? 0;
    const tareasDom = data.tareas_extra?.domingo?.at(-1)?.valor ?? 0;
    const tareasNotasSab = data.tareas?.sabado?.at(-1)?.valor ?? 0;
    const tareasNotasDom = data.tareas?.domingo?.at(-1)?.valor ?? 0;
    const notasSab = data.calificaciones?.sabado?.at(-1)?.valor ?? 0;
    const notasDom = data.calificaciones?.domingo?.at(-1)?.valor ?? 0;

    const asistenciaProm = (asistenciaSab + asistenciaDom) / 2;
    const tareasProm = (tareasSab + tareasDom) / 2;
    const tareasNotasProm = (tareasNotasSab + tareasNotasDom) / 2;
    const notasProm = (notasSab + notasDom) / 2;

    if (asistenciaProm) DEFAULTS.anwmpx = +asistenciaProm.toFixed(2);
    if (tareasProm) DEFAULTS.xhamxp = +tareasProm.toFixed(2);
    if (tareasNotasProm) DEFAULTS.aufmxp = +tareasNotasProm.toFixed(2);
    if (notasProm) DEFAULTS.notmxp = +notasProm.toFixed(2);

    if (!QUIET_MODE) {
      console.log("📊 Indicadores actualizados:", {
        anwmpx: DEFAULTS.anwmpx,
        xhamxp: DEFAULTS.xhamxp,
        aufmxp: DEFAULTS.aufmxp,
        notmxp: DEFAULTS.notmxp,
      });
    }
  } catch (err) {
    console.error("❌ Error al actualizar indicadores:", err);
  }
}

// ===== Tipos =====
type ActiveCandle = { open: number; high: number; low: number; close: number; startedAt: number };
type State = { lastPrices: Map<string, number>; activeCandles: Map<string, ActiveCandle>; lastTick: number };

const state: State = { lastPrices: new Map(), activeCandles: new Map(), lastTick: 0 };

// ===== Utilidades =====
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function loadFactors() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "factors.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return { volatility: 0.05, tickSeconds: 7 };
  }
}

async function initializeLastPrices() {
  const lastCandles = await prisma.candle.groupBy({ by: ["valueId"], _max: { time: true } });
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

  if (!QUIET_MODE) console.log(`✅ Últimos precios cargados: ${state.lastPrices.size}`);
}

// ===== Handler principal =====
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  console.time("⏱ Price API");

  // ⚡ Si el servidor recién inició, evita ticks atrasados
  if (state.lastTick === 0) {
    state.lastTick = Date.now();
  }

  // 🟢 Solo lectura — no genera velas ni modifica precios
  if (mode === "read" || mode === "readonly") {
    if (state.lastPrices.size === 0) await initializeLastPrices();
    await updateIndicatorsFromFactors();
    const out = Object.fromEntries(state.lastPrices);
    console.timeEnd("⏱ Price API");
    return NextResponse.json({ ok: true, mode: "readonly", prices: out });
  }

  // 🌿 Normalización (ajuste suave)
  if (mode === "normalize") {
    if (state.lastPrices.size === 0) await initializeLastPrices();
    const factor = 0.3;
    for (const [id, base] of Object.entries(DEFAULTS)) {
      const prev = state.lastPrices.get(id) ?? base;
      const corrected = prev + factor * (base - prev);
      state.lastPrices.set(id, +(corrected.toFixed(base < 2 ? 4 : 2)));
    }
    console.timeEnd("⏱ Price API");
    if (!QUIET_MODE) console.log(`🌿 Precios normalizados (${factor * 100}% de corrección)`);
    return NextResponse.json({
      ok: true, normalize: true, correction: factor,
      prices: Object.fromEntries(state.lastPrices),
    });
  }

  // 🧱 Restablecer todos los activos a su precio base (DEFAULTS)
  if (mode === "base" || mode === "reset") {
    if (state.lastPrices.size === 0) await initializeLastPrices();

    for (const [id, base] of Object.entries(DEFAULTS)) {
      state.lastPrices.set(id, base);
    }

    state.lastTick = Date.now(); // sincroniza el tick
    console.timeEnd("⏱ Price API");
    if (!QUIET_MODE) console.log("🔁 Todos los activos regresaron a su precio base.");

    return NextResponse.json({
      ok: true,
      reset: true,
      message: "Todos los activos regresaron a su valor base (DEFAULTS).",
      prices: Object.fromEntries(state.lastPrices),
    });
  }


  // 🚫 Desactiva la creación automática de velas
  // (Solo se actualizan los precios en memoria)
  await updateIndicatorsFromFactors();
  if (state.lastPrices.size === 0) await initializeLastPrices();

  const factors = loadFactors();
  const now = Date.now();
  const TICK_MS = (factors.tickSeconds ?? 7) * 1000;
  const steps = 1; // ⚠️ siempre 1 → no intenta "ponerse al día"

  for (let s = 0; s < steps; s++) {
    for (const [id, base] of Object.entries(DEFAULTS)) {
      const mu = base;
      const prev = state.lastPrices.get(id) ?? mu;
      const isIndicator = ["anwmpx", "xhamxp", "aufmxp", "notmxp"].includes(id);
      const VOL = isIndicator ? 0.03 : factors.volatility ?? 0.05;
      const scale = mu < 10 ? 0.002 : 1;

      let next = prev * (1 + randn() * VOL * scale);
      next += 0.1 * (mu - next);
      const maxDev = VOL * scale;
      next = Math.min(mu * (1 + maxDev * 4), Math.max(mu * (1 - maxDev * 4), next));

      if (["sonmxp", "sammxp"].includes(id)) next = Math.min(2.5, Math.max(0.5, next));

      const alpha = 0.3;
      next = prev + alpha * (next - prev);
      next = +(next.toFixed(mu < 2 ? 4 : 2));
      if (Math.abs(next - prev) < 0.0001) next = prev + (Math.random() - 0.5) * 0.0002;

      state.lastPrices.set(id, next);
    }
  }

  state.lastTick = now;
  const out = Object.fromEntries(state.lastPrices);

  console.timeEnd("⏱ Price API");
  if (!QUIET_MODE) console.log(`✅ ${Object.keys(out).length} precios actualizados (sin nuevas velas).`);

  return NextResponse.json(
    { ok: true, prices: out, ts: now },
    { headers: { "Cache-Control": "no-store" } }
  );
}
