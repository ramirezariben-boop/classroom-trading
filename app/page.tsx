// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import CandleChart from "../components/CandleChart";

// ==== Tipos ====
export type Category = { id: string; name: string; description: string };
export type Value = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  changePct: number;
  updatedAt: number;
};
export type Tx = {
  id: string;
  ts: number;
  type: "BUY" | "SELL" | "RESET" | "TRANSFER_IN" | "TRANSFER_OUT";
  valueId?: string;
  qty?: number;
  deltaPoints: number;
  // solo llegan cuando scope = "all"
  userId?: string;
  userName?: string;
};
export type Candle = { time: number; open: number; high: number; low: number; close: number };
export type ApiUser = { id: string; name: string; role: "ADMIN" | "USER" };

// ==== Catálogo inicial ====
const DEFAULT_CATEGORIES: Category[] = [
  { id: "aktien", name: "Aktien", description: "Projekte" },
  { id: "materialien", name: "Materialien", description: "PDFs" },
  { id: "wahrungen", name: "Währungen", description: "Gruppen" },
  { id: "werte", name: "Werte", description: "Puntos" },
  { id: "zehntel", name: "Zehntel", description: "Décimas" },
  { id: "guter", name: "Güter", description: "Mercancías" },
  { id: "vocabulario", name: "Vocabulario", description: "Léxico y contextos" },
];

const DEFAULT_VALUES: Value[] = [
  // Aktien
  { id: "baumxp", categoryId: "aktien", name: "BAUMXP", description: "Bauunternehmen", price: 145, changePct: 0, updatedAt: 0 },
  { id: "dsgmxp", categoryId: "aktien", name: "DSGMXP", description: "Aufgabendesign", price: 100, changePct: 0, updatedAt: 0 },
  { id: "rftmxp", categoryId: "aktien", name: "RFTMXP", description: "Referate", price: 110, changePct: 0, updatedAt: 0 },
  // Materialien
  { id: "krimxp", categoryId: "materialien", name: "KRIMXP", description: "Krimis", price: 50, changePct: 0, updatedAt: 0 },
  { id: "grmmxp", categoryId: "materialien", name: "GRMMXP", description: "Grammatik", price: 40, changePct: 0, updatedAt: 0 },
  { id: "litmxp", categoryId: "materialien", name: "LITMXP", description: "Literatur", price: 70, changePct: 0, updatedAt: 0 },
  { id: "hormxp", categoryId: "materialien", name: "HORMXP", description: "Hörverstehen", price: 85, changePct: 0, updatedAt: 0 },
  // Währungen
  { id: "sonmxp", categoryId: "wahrungen", name: "SONMXP", description: "Valor de los puntos del domingo", price: 1, changePct: 0, updatedAt: 0 },
  { id: "sammxp", categoryId: "wahrungen", name: "SAMMXP", description: "Valor de los puntos del sábado", price: 1, changePct: 0, updatedAt: 0 },
  // Werte
  { id: "wgrmxp", categoryId: "werte", name: "WGRMXP", description: "Valor de los puntos del domingo", price: 1, changePct: 0, updatedAt: 0 },
  { id: "waumxp", categoryId: "werte", name: "WAUMXP", description: "Valor de los puntos del sábado", price: 1, changePct: 0, updatedAt: 0 },
  { id: "wbtmxp", categoryId: "werte", name: "WBTMXP", description: "Valor de los puntos del domingo", price: 1, changePct: 0, updatedAt: 0 },
  { id: "wxhmxp", categoryId: "werte", name: "WXHMXP", description: "Valor de los puntos del sábado", price: 1, changePct: 0, updatedAt: 0 },
  // Zehntel
  { id: "zhnmxp", categoryId: "zehntel", name: "ZHNMXP", description: "Valor de la décima", price: 20, changePct: 0, updatedAt: 0 },
  { id: "anlmxp", categoryId: "zehntel", name: "ANLMXP", description: "Bonos", price: 1, changePct: 0, updatedAt: 0 },
  // Güter
  { id: "gzehntel", categoryId: "guter", name: "Zehntel", description: "Décima", price: 20, changePct: 0, updatedAt: 0 },
  { id: "gkrimi", categoryId: "guter", name: "Krimi", description: "Krimi", price: 50, changePct: 0, updatedAt: 0 },
  { id: "ggramm", categoryId: "guter", name: "Grammatik", description: "Grammatik", price: 40, changePct: 0, updatedAt: 0 },
  { id: "glit", categoryId: "guter", name: "Literatur", description: "Literatur", price: 70, changePct: 0, updatedAt: 0 },
  { id: "ghor", categoryId: "guter", name: "Hörverstehen", description: "Hörverstehen", price: 85, changePct: 0, updatedAt: 0 },
];

// ==== Temporalidades ====
type Timeframe = { id: string; label: string; candleMs: number; tickMs: number };
const TIMEFRAMES: Timeframe[] = [
  { id: "5s", label: "5 s", candleMs: 5_000, tickMs: 1_000 },
  { id: "10s", label: "10 s", candleMs: 10_000, tickMs: 1_000 },
  { id: "30s", label: "30 s", candleMs: 30_000, tickMs: 1_000 },
  { id: "1m", label: "1 m", candleMs: 60_000, tickMs: 2_000 },
];

// ==== RNG determinista ====
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normal(0,1) aproximado
function gauss(rand: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ==== Metadatos por valor/categoría (bandas móviles) ====
type Kind = "aktie" | "material" | "waehrung" | "zehntel" | "other";

const VALUE_META: Record<
  string,
  {
    kind: Kind;
    base: number;
    // ancho de banda alrededor de μ: usa uno de los dos
    bandAbsWidth?: number;   // eje. ±0.05
    bandPctWidth?: number;   // eje. ±0.05 = ±5%
  }
> = {
  // Materiales (±25% alrededor de μ como ejemplo)
  krimxp: { kind: "material", base: 50, bandPctWidth: 0.25 },
  grmmxp: { kind: "material", base: 40, bandPctWidth: 0.25 },
  litmxp: { kind: "material", base: 70, bandPctWidth: 0.25 },
  hormxp: { kind: "material", base: 85, bandPctWidth: 0.25 },

  // Aktien (±30%)
  baumxp: { kind: "aktie", base: 145, bandPctWidth: 0.30 },
  dsgmxp: { kind: "aktie", base: 100, bandPctWidth: 0.30 },
  rftmxp: { kind: "aktie", base: 110, bandPctWidth: 0.30 },

  // Währungen (tu ejemplo: ±0.05 alrededor de μ)
  sonmxp: { kind: "waehrung", base: 1, bandAbsWidth: 0.05 },
  sammxp: { kind: "waehrung", base: 1, bandAbsWidth: 0.05 },

  // Otros valores (±25%)
  wgrmxp: { kind: "other", base: 1, bandPctWidth: 0.25 },
  waumxp: { kind: "other", base: 1, bandPctWidth: 0.25 },
  wbtmxp: { kind: "other", base: 1, bandPctWidth: 0.25 },
  wxhmxp: { kind: "other", base: 1, bandPctWidth: 0.25 },

  // Zehntel (±20%)
  zhnmxp: { kind: "zehntel", base: 20, bandPctWidth: 0.20 },
  anlmxp: { kind: "other", base: 1, bandPctWidth: 0.20 },

  // Güter
  gzehntel: { kind: "other", base: 20, bandPctWidth: 0.20 },
  gkrimi:   { kind: "material", base: 50, bandPctWidth: 0.25 },
  ggramm:   { kind: "material", base: 40, bandPctWidth: 0.25 },
  glit:     { kind: "material", base: 70, bandPctWidth: 0.25 },
  ghor:     { kind: "material", base: 85, bandPctWidth: 0.25 },
};

function metaFor(id: string) {
  return VALUE_META[id.toLowerCase()] ?? { kind: "other" as Kind, base: 50, bandPctWidth: 0.3 };
}

// ==== Señales externas ====
type Signals = {
  // promedio del grupo (0–100) -> Zehntel
  groupAvg: number;
  // desempeño "trabajadores" (0–100) -> Aktien
  workers: Record<string, number>;
  // demanda reciente (conteo suave por valor) -> Materiales
  demand: Record<string, number>;
  // participaciones por sesión -> Währungen
  participations: { SON: number; SAM: number; expected: number; eta: number };
};

// Calcula la media dinámica μ según reglas de negocio
function dynamicMean(id: string, base: number, price: number, sig: Signals) {
  const kind = metaFor(id).kind;

  // coeficientes (ajusta a gusto)
  const alphaZehntel = 0.35;  // sensibilidad al promedio del grupo
  const betaAktien   = 0.45;  // sensibilidad al desempeño de "trabajadores"
  const gammaMat     = 0.06;  // sensibilidad a demanda (conteo suave)

  let mu = base;

  if (kind === "zehntel") {
    // Promedio 75 = base; >75 sube, <75 baja
    const z = (sig.groupAvg - 75) / 25;
    mu = base * (1 + alphaZehntel * z);
  } else if (kind === "aktie") {
    const s = (sig.workers[id] ?? 70);
    const z = (s - 70) / 30;
    mu = base * (1 + betaAktien * z);
  } else if (kind === "material") {
    const d = sig.demand[id] ?? 0;
    mu = base * (1 + gammaMat * Math.tanh(d / 10));
  } else if (kind === "waehrung") {
    // Valor por participaciones: más que las esperadas -> diluye; menos -> aprecia
    const { SON, SAM, expected, eta } = sig.participations;
    const isSON = id.toLowerCase() === "sonmxp";
    const count = isSON ? SON : SAM;
    const ratio = Math.max(0.2, Math.min(2, expected / Math.max(1, count || 1)));
    mu = base * Math.pow(ratio, eta);
  }

  return mu;
}

function dynamicBandAroundMu(id: string, mu: number) {
  const m = metaFor(id);
  if (m.bandAbsWidth != null) {
    const w = Math.max(0, m.bandAbsWidth);
    return [mu - w, mu + w] as [number, number];
  }
  const p = Math.max(0, m.bandPctWidth ?? 0.2);
  return [mu * (1 - p), mu * (1 + p)] as [number, number];
}

function reflectIntoRange(x: number, min: number, max: number) {
  if (x < min) return min + (min - x); // rebote
  if (x > max) return max - (x - max); // rebote
  return x;
}

// ==== Componente principal ====
export default function Page() {
  const [mounted, setMounted] = useState(false);

  // Estado “demo” (seguirá visible si NO hay sesión)
  const [student, setStudent] = useState<{ name: string; points: number }>({ name: "Alumno Demo", points: 1000 });

  const [categories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [values, setValues] = useState<Record<string, Value>>(() => Object.fromEntries(DEFAULT_VALUES.map((v) => [v.id, v])));
  const [txs, setTxs] = useState<Tx[]>([]);
  const [history, setHistory] = useState<Record<string, Candle[]>>({});
  const [trade, setTrade] = useState<{ mode: "BUY" | "SELL"; valueId: string } | null>(null);
  const [qty, setQty] = useState(1);
  const [chartFor, setChartFor] = useState<string | null>(null);
  const [tf, setTf] = useState<Timeframe>(TIMEFRAMES[3]); // por defecto 1m
  const selected = chartFor ? values[chartFor] : null;

  const fmt = useMemo(() => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);

  const [txScope, setTxScope] = useState<"me" | "all">("me");

  // ==== Auth (UI) ====
  const [user, setUser] = useState<ApiUser | null>(null);

  // NEW: estado de portafolio real
  const [points, setPoints] = useState<number>(0);
  const [positions, setPositions] = useState<Record<string, number>>({});

  // Login modal
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginId, setLoginId] = useState("");     // ID del alumno (ej. ana01)
  const [loginCode, setLoginCode] = useState(""); // Clave/pin (ej. GATO-92)

  // NEW: transferencias
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState<number>(0);

  // ==== Señales (estado) ====
  const [signals, setSignals] = useState<Signals>({
    groupAvg: 75,
    workers: { baumxp: 80, dsgmxp: 70, rftmxp: 85 },
    demand: {},
    participations: { SON: 0, SAM: 0, expected: 35, eta: 0.04 },
  });

  useEffect(() => setMounted(true), []);

  // Sembrar vela inicial

// === Polling de señales desde /api/signals con pausa por visibilidad ===
const SIGNALS_POLL_MS = 4000; // prod: 3000–5000ms; admin: 1000–2000ms

useEffect(() => {
  let timer: any = null;
  let stopped = false;

  async function loadSignals() {
    try {
      const res = await fetch("/api/signals", { cache: "no-store" });
      if (!stopped && res.ok) {
        const json = await res.json();
        setSignals((prev) => ({
          ...prev,
          ...json,
          workers: { ...(prev.workers || {}), ...(json.workers || {}) },
          demand:  { ...(prev.demand  || {}), ...(json.demand  || {})  },
          participations: { ...(prev.participations || {}), ...(json.participations || {}) },
        }));
      }
    } catch { /* ignore */ }
  }

  function schedule() {
    clearInterval(timer);
    if (document.visibilityState === "visible") {
      timer = setInterval(loadSignals, SIGNALS_POLL_MS);
      // arranque rápido
      loadSignals();
    }
  }

  // arranca y maneja visibilidad
  schedule();
  const onVis = () => schedule();
  document.addEventListener("visibilitychange", onVis);

  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  };
}, []);


  useEffect(() => {
    if (!mounted) return;
    const now = Date.now();
    setHistory((prev) => {
      const next = { ...prev } as Record<string, Candle[]>;
      for (const v of Object.values(values)) {
        if (!next[v.id] || next[v.id].length === 0) {
          next[v.id] = [{ time: now, open: v.price, high: v.price, low: v.price, close: v.price }];
        }
      }
      return next;
    });
  }, [mounted, values]);

  // ==== Simulador dependiente de la temporalidad con OU + banda móvil ====
  useEffect(() => {
    if (!mounted) return;
    const rand = mulberry32(42 + tf.candleMs); // semilla depende del TF (opcional)

    const id = setInterval(() => {
      setValues((prev) => {
        const next: Record<string, Value> = { ...prev };
        const now = Date.now();

        setHistory((prevHist) => {
          const newHist: Record<string, Candle[]> = { ...prevHist };


          for (const vid of Object.keys(next)) {
            const v = next[vid];
            const { base } = metaFor(vid);

            // 1) valor real dinámico por señales
            const mu = dynamicMean(vid, base, v.price, signals);

            // 2) banda móvil centrada en μ
            const [lo, hi] = dynamicBandAroundMu(vid, mu);

            // OU discreto: reversión + ruido proporcional
            const dt = tf.tickMs / 60_000; // escala por minuto
            const kappa = 0.45;            // ↑ vuelve más rápido a μ si sube
            const sigma = 0.08;            // volatilidad relativa

            const noise = sigma * v.price * gauss(rand) * Math.sqrt(Math.max(1e-3, dt));
            let newPrice = v.price + kappa * (mu - v.price) * dt + noise;

            // reflexión + clamp en la banda móvil
            newPrice = reflectIntoRange(newPrice, lo, hi);
            newPrice = Math.max(lo, Math.min(hi, newPrice));

            const p2 = +newPrice.toFixed(2);
            next[vid] = {
              ...v,
              price: p2,
              changePct: +(((p2 - v.price) / v.price) * 100).toFixed(2),
              updatedAt: now,
            };

            const candles = newHist[vid] ? [...newHist[vid]] : [];
            const last = candles[candles.length - 1];

            if (!last || now - last.time > tf.candleMs) {
              candles.push({ time: now, open: p2, high: p2, low: p2, close: p2 });
            } else {
              last.close = p2;
              if (p2 > last.high) last.high = p2;
              if (p2 < last.low) last.low = p2;
            }

            newHist[vid] = candles.slice(-100);
          }

          return newHist;
        });

        return next;
      });
    }, tf.tickMs);

    return () => clearInterval(id);
  }, [mounted, tf, signals]);

  // ==== Helpers API (login + portfolio + trade + transfer) ====
  async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Error");
    return json;
  }

  async function handleLogin() {
    const userId = loginId.trim();
    const code = loginCode.trim();
    if (!userId || !code) {
      alert("Completa ID y Clave");
      return;
    }
    try {
      const result = await api<{ ok: boolean; user: ApiUser }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ userId, code }),
      });
      setUser(result.user);
      setLoginOpen(false);
      setLoginId("");
      setLoginCode("");
      await refreshPortfolio();
      // si es ADMIN, cambia a "all" y carga todas
      if (result.user.role === "ADMIN") {
        setTxScope("all");
        const all = await fetchTxs("all");
        setTxs(all);
      }
    } catch (e: any) {
      alert(e.message || "No se pudo iniciar sesión");
    }
  }

  async function handleLogout() {
    try {
      await api("/api/logout", { method: "POST" });
      setUser(null);
      setPoints(0);
      setPositions({});
      setTxs([]);
    } catch (e: any) {
      alert(e.message || "No se pudo cerrar sesión");
    }
  }

  // NEW: leer portafolio del backend
  async function refreshPortfolio() {
    try {
      const data = await api<{
        points: number;
        positions: { userId: string; valueId: string; qty: number }[];
        txs: { id: string; ts: string; type: string; valueId?: string; qty?: number; deltaPts: number }[];
      }>("/api/portfolio");

      setPoints(Number(data.points));
      setPositions(Object.fromEntries(data.positions.map((p) => [p.valueId, p.qty])));

      // Adaptar txs del backend a tu tipo local
      const mapped = data.txs.map((t) => ({
        id: t.id,
        ts: new Date(t.ts).getTime(),
        type: (t.type as any) ?? "RESET",
        valueId: t.valueId,
        qty: t.qty,
        deltaPoints: Number(t.deltaPts),
      }));

      // ✅ no sobreescribir cuando estás viendo "Todas"
      if (txScope === "me") {
        setTxs(mapped);
      }
    } catch {
      // No autenticado o error; no hacer nada
    }
  }

  async function fetchTxs(scope: "me" | "all") {
    const res = await fetch(`/api/txs?scope=${scope}`);
    if (!res.ok) throw new Error("Error al cargar transacciones");
    const data = await res.json();

    return data.txs.map((t: any) => ({
      id: t.id,
      ts: new Date(t.ts).getTime(),
      type: (t.type as any) ?? "RESET",
      valueId: t.valueId,
      qty: t.qty,
      deltaPoints: Number(t.deltaPts),
      userId: t.userId,
      userName: t.userName,
    }));
  }

  // NEW: intenta cargar portafolio al montar (por si ya hay cookie válida)
  useEffect(() => {
    refreshPortfolio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==== Trading usando API ==== (reemplaza lógica local si hay sesión)
  async function placeOrder(mode: "BUY" | "SELL", valueId: string, qty: number) {
    const price = values[valueId]?.price;
    if (!price || qty <= 0) return;

    if (!user) {
      // sin sesión: lógica local (demo)
      const cost = +(price * qty).toFixed(2);
      if (mode === "BUY" && student.points >= cost) {
        setStudent((s) => ({ ...s, points: +(s.points - cost).toFixed(2) }));
        setTxs((t) => [...t, { id: Math.random().toString(), ts: Date.now(), type: "BUY", valueId, qty, deltaPoints: -cost }]);
      }
      if (mode === "SELL") {
        setStudent((s) => ({ ...s, points: +(s.points + cost).toFixed(2) }));
        setTxs((t) => [...t, { id: Math.random().toString(), ts: Date.now(), type: "SELL", valueId, qty, deltaPoints: cost }]);
      }

      return;
    }

    // con sesión: llamar backend
    try {
      await api("/api/trade", {
        method: "POST",
        body: JSON.stringify({ mode, valueId, qty, price }),
      });
      await refreshPortfolio();

    } catch (e: any) {
      alert(e.message || "Error en trade");
    }
  }

  // NEW: transferencias
  async function doTransfer() {
    if (!user) { setLoginOpen(true); return; }
    const toUserId = transferTo.trim();
    const amount = Number(transferAmount);
    if (!toUserId || amount <= 0) return;

    try {
      await api("/api/transfer", {
        method: "POST",
        body: JSON.stringify({ toUserId, amount }),
      });
      setTransferAmount(0);
      setTransferTo("");
      await refreshPortfolio();
    } catch (e: any) {
      alert(e.message || "Error en transferencia");
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📈 Classroom Trading</h1>
          <p className="text-neutral-400">
            {user ? (
              <>
                Bienvenido, <span className="font-semibold">{user.name}</span>. Tienes {fmt.format(points)} pts.
              </>
            ) : (
              <>Bienvenido, {student.name}. Tienes {fmt.format(student.points)} pts. (Modo demo)</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de temporalidad */}
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
            {TIMEFRAMES.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTf(opt)}
                className={
                  "px-2.5 py-1 text-sm rounded-lg transition " +
                  (tf.id === opt.id ? "bg-blue-600" : "hover:bg-neutral-800")
                }
                title={`Nueva vela cada ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Botón de sesión */}
          {user ? (
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700">
              Cerrar sesión
            </button>
          ) : (
            <button onClick={() => setLoginOpen(true)} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500">
              Iniciar sesión
            </button>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <section className="lg:col-span-2 space-y-6">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
              <h2 className="text-lg font-semibold mb-2">{cat.name}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {Object.values(values)
                  .filter((v) => v.categoryId === cat.id)
                  .map((v) => (
                    <div key={v.id} className="rounded-2xl bg-neutral-950 border border-neutral-800 p-3">
                      <div
                        onClick={() => setChartFor(v.id)}
                        className="flex items-center justify-between cursor-pointer hover:bg-neutral-900/50 rounded-xl p-2 transition"
                        title="Ver gráfico"
                      >
                        <div>
                          <div className="font-medium">{v.name}</div>
                          <div className="text-xs text-neutral-400">{v.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{fmt.format(v.price)}</div>
                          <div className={"text-xs " + (v.changePct >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {v.changePct >= 0 ? "+" : ""}
                            {v.changePct}%
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => setTrade({ mode: "BUY", valueId: v.id })} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-1 rounded-xl">Comprar</button>
                        <button onClick={() => setTrade({ mode: "SELL", valueId: v.id })} className="flex-1 bg-red-600 hover:bg-red-500 py-1 rounded-xl">Vender</button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </section>

        <aside className="space-y-4">
          {/* Orden rápida */}
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
            <h3 className="font-semibold mb-2">Orden rápida</h3>
            {trade ? (
              <div className="space-y-3">
                <div className="text-sm text-neutral-400">Modo: {trade.mode}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                    className="w-24 bg-neutral-800 rounded-lg px-2 py-1"
                  />
                  <button
                    onClick={() => placeOrder(trade.mode, trade.valueId, qty)}
                    className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg"
                  >
                    Confirmar
                  </button>
                  <button onClick={() => setTrade(null)} className="bg-neutral-700 hover:bg-neutral-600 px-3 py-1 rounded-lg">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-400">Elige un valor y presiona Comprar/Vender.</div>
            )}
          </div>

          {/* NEW: Transferencias */}
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
            <h3 className="font-semibold mb-2">Transferir MXP</h3>
            <div className="flex flex-col gap-2">
              <input
                placeholder="ID destino (ej. luis03)"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="bg-neutral-800 rounded-lg px-2 py-1"
              />
              <input
                type="number"
                min={1}
                placeholder="Monto"
                value={transferAmount}
                onChange={(e) => setTransferAmount(Number(e.target.value))}
                className="bg-neutral-800 rounded-lg px-2 py-1"
              />
              <button onClick={doTransfer} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-lg">
                Enviar
              </button>
              {!user && <div className="text-xs text-neutral-500">Inicia sesión para transferir.</div>}
            </div>
          </div>

          {/* Transacciones */}
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
            <h3 className="font-semibold mb-2">Transacciones</h3>

            {/* Toggle solo para ADMIN */}
            {user?.role === "ADMIN" && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-neutral-400">Ver:</span>
                <button
                  onClick={async () => {
                    setTxScope("me");
                    await refreshPortfolio(); // recarga solo mis transacciones
                  }}
                  className={"px-2 py-1 rounded " + (txScope === "me" ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700")}
                >
                  Mis
                </button>
                <button
                  onClick={async () => {
                    setTxScope("all");
                    const all = await fetchTxs("all");
                    setTxs(all); // carga todas las transacciones
                  }}
                  className={"px-2 py-1 rounded " + (txScope === "all" ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700")}
                >
                  Todas
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {txs.length === 0 && (
                <div className="text-sm text-neutral-500">Aún no hay movimientos.</div>
              )}

              {txs
                .slice()
                .reverse()
                .map((t) => (
                  <div
                    key={t.id}
                    className="text-sm flex items-center justify-between border-b border-neutral-800 py-1"
                  >
                    <span
                      className={
                        t.type === "BUY"
                          ? "text-emerald-400"
                          : t.type === "SELL"
                          ? "text-red-400"
                          : t.type === "TRANSFER_IN"
                          ? "text-emerald-300"
                          : t.type === "TRANSFER_OUT"
                          ? "text-red-300"
                          : "text-neutral-300"
                      }
                    >
                      {t.type}
                    </span>

                    <span>{t.qty ?? 0}x</span>
                    <span>{t.valueId ?? "-"}</span>

                    {/* Mostrar autor solo en modo Todas */}
                    {txScope === "all" && (
                      <span className="text-neutral-400">
                        {t.userName ?? t.userId ?? "—"}
                      </span>
                    )}

                    <span className={t.deltaPoints >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {t.deltaPoints >= 0 ? "+" : ""}
                      {t.deltaPoints.toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </aside>
      </main>

      {/* ==== Modal de Gráfico ==== */}
      {chartFor && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl rounded-2xl bg-neutral-950 border border-neutral-800 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs text-neutral-400">Gráfico de velas</div>
                <div className="text-lg font-semibold">{selected.name}</div>
                <div className="text-xs text-neutral-500">{selected.description}</div>
              </div>
              <button onClick={() => setChartFor(null)} className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700">Cerrar</button>
            </div>
            <CandleChart key={chartFor} candles={history[chartFor]!} height={300} xTicks={6} yTicks={4} bodyWidthRatio={0.4} />
          </div>
        </div>
      )}

      {/* ==== Modal de Login ==== */}
      {loginOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-950 border border-neutral-800 p-5">
            <h3 className="text-lg font-semibold mb-3">Iniciar sesión</h3>

            <label className="text-sm text-neutral-400">ID de alumno</label>
            <input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="mt-1 w-full bg-neutral-800 rounded-lg px-3 py-2 outline-none"
              placeholder="Ej. ana01"
            />

            <label className="text-sm text-neutral-400 mt-3 block">Clave</label>
            <input
              type="password"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="mt-1 w-full bg-neutral-800 rounded-lg px-3 py-2 outline-none"
              placeholder="Ej. GATO-92"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setLoginOpen(false)} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700">Cancelar</button>
              <button onClick={handleLogin} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500">Entrar</button>
            </div>

            <p className="text-xs text-neutral-500 mt-3">
              Necesitas tener listas las rutas: /api/login, /api/logout, /api/portfolio, /api/trade y /api/transfer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
