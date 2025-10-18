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
  { id: "wahrungen", name: "Währungen", description: "Grupos" },
  { id: "werte", name: "Werte", description: "Puntos" },
  { id: "zehntel", name: "Zehntel", description: "Décimas" },
  { id: "guter", name: "Güter", description: "Mercancías" },
  { id: "vocabulario", name: "Vocabulario", description: "Léxico y contextos" },
];

const DEFAULT_VALUES: Value[] = [
  // Aktien
  { id: "baumxp", categoryId: "aktien", name: "BAUMXP", description: "Bauunternehmen", price: 100, changePct: 0, updatedAt: 0 },
  { id: "dsgmxp", categoryId: "aktien", name: "DSGMXP", description: "Aufgabendesign", price: 100, changePct: 0, updatedAt: 0 },
  { id: "rftmxp", categoryId: "aktien", name: "RFTMXP", description: "Referate", price: 100, changePct: 0, updatedAt: 0 },
  // Materialien
  { id: "krimxp", categoryId: "materialien", name: "KRIMXP", description: "Krimis", price: 40, changePct: 0, updatedAt: 0 },
  { id: "grmmxp", categoryId: "materialien", name: "GRMMXP", description: "Grammatik", price: 40, changePct: 0, updatedAt: 0 },
  { id: "litmxp", categoryId: "materialien", name: "LITMXP", description: "Literatur", price: 50, changePct: 0, updatedAt: 0 },
  { id: "hormxp", categoryId: "materialien", name: "HORMXP", description: "Hörverstehen", price: 55, changePct: 0, updatedAt: 0 },
  // Währungen
  { id: "sonmxp", categoryId: "wahrungen", name: "SONMXP", description: "Valor de los puntos del domingo", price: 1, changePct: 0, updatedAt: 0 },
  { id: "sammxp", categoryId: "wahrungen", name: "SAMMXP", description: "Valor de los puntos del sábado", price: 1, changePct: 0, updatedAt: 0 },
  // Werte
  { id: "wgrmxp", categoryId: "werte", name: "WGRMXP", description: "Valor de los puntos del domingo", price: 1, changePct: 0, updatedAt: 0 },
  { id: "waumxp", categoryId: "werte", name: "WAUMXP", description: "Valor de los puntos del sábado", price: 1, changePct: 0, updatedAt: 0 },
  { id: "wbtmxp", categoryId: "werte", name: "WBTMXP", description: "Valor de los puntos del domingo", price: 1, changePct: 0, updatedAt: 0 },
  { id: "wxhmxp", categoryId: "werte", name: "WXHMXP", description: "Valor de los puntos del sábado", price: 1, changePct: 0, updatedAt: 0 },
  // Zehntel
  { id: "zhnmxp", categoryId: "zehntel", name: "ZHNMXP", description: "Valor de la décima", price: 12, changePct: 0, updatedAt: 0 },
  { id: "anlmxp", categoryId: "zehntel", name: "ANLMXP", description: "Bonos", price: 1, changePct: 0, updatedAt: 0 },
  // Güter
  { id: "gzehntel", categoryId: "guter", name: "Zehntel", description: "Décima", price: 12, changePct: 0, updatedAt: 0 },
  { id: "gkrimi", categoryId: "guter", name: "Krimi", description: "Krimi", price: 40, changePct: 0, updatedAt: 0 },
  { id: "ggramm", categoryId: "guter", name: "Grammatik", description: "Grammatik", price: 40, changePct: 0, updatedAt: 0 },
  { id: "glit", categoryId: "guter", name: "Literatur", description: "Literatur", price: 50, changePct: 0, updatedAt: 0 },
  { id: "ghor", categoryId: "guter", name: "Hörverstehen", description: "Hörverstehen", price: 55, changePct: 0, updatedAt: 0 },
];

// ==== Temporalidades (solo re-muestreo visual; NO altera velocidad de velas) ====
type Timeframe = { id: string; label: string; candleMs: number };

const M = 60_000;
const H = 60 * M;
const D = 24 * H;
const W = 7 * D;

const TIMEFRAMES: Timeframe[] = [
  { id: "5m",  label: "5 m",  candleMs: 5 * M },
  { id: "15m", label: "15 m", candleMs: 15 * M },
  { id: "1h",  label: "1 h",  candleMs: 1 * H },
  { id: "4h",  label: "4 h",  candleMs: 4 * H },
  { id: "1d",  label: "1 D",  candleMs: 1 * D },
  { id: "1w",  label: "1 S",  candleMs: 1 * W },
];

// ==== Componente principal ====
export default function Page() {
  const [mounted, setMounted] = useState(false);

  // Estado “demo” (seguirá visible si NO hay sesión)
  const [student, setStudent] = useState<{ name: string; points: number }>({ name: "Alumno Demo", points: 1000 });

  const [categories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [values, setValues] = useState<Record<string, Value>>(
    () => Object.fromEntries(DEFAULT_VALUES.map((v) => [v.id, v]))
  );
  const [txs, setTxs] = useState<Tx[]>([]);

  // (no se usa para el chart, lo dejo por si lo ocupas después)
  const [history, setHistory] = useState<Record<string, Candle[]>>({});

  // ✅ Siembra inicial en BASE: una vela por valor (para resampling local del modal)
  const [candlesBase, setCandlesBase] = useState<Record<string, Candle[]>>(() => {
    const now = Date.now();
    return Object.fromEntries(
      DEFAULT_VALUES.map((v) => [
        v.id,
        [{ time: now, open: v.price, high: v.price, low: v.price, close: v.price }],
      ])
    );
  });

  const [trade, setTrade] = useState<{ mode: "BUY" | "SELL"; valueId: string } | null>(null);
  const [qty, setQty] = useState(1);
  const [chartFor, setChartFor] = useState<string | null>(null);
  const [tf, setTf] = useState<Timeframe>(TIMEFRAMES[0]); // por defecto 5m
  const selected = chartFor ? values[chartFor] : null;

  const fmt = useMemo(
    () => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );

  const [txScope, setTxScope] = useState<"me" | "all">("me");

  // ==== Auth (UI) ====
  const [user, setUser] = useState<ApiUser | null>(null);

  // NEW: estado de portafolio real
  const [points, setPoints] = useState<number>(0);
  const [positions, setPositions] = useState<Record<string, number>>({});

  // Login modal
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginCode, setLoginCode] = useState("");

  // NEW: transferencias
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState<number>(0);

  // ==== Factores (leídos de archivo/endpoint) ====
  type Factors = {
    views24hPct?: number;             // ejemplo: 14  -> +14% / 24h
    coeff?: Record<string, number>;   // sensibilidad por categoría
    note?: string;
    updatedAt?: string;
  };
  const [factors, setFactors] = useState<Factors | null>(null);

  useEffect(() => setMounted(true), []);

  // === Resampling para el modal (visual: no cambia el motor de velas)
const derivedCandles = useMemo(() => {
  if (!chartFor) return [];
  const base = history?.[chartFor] ?? [];
  return resample(base, tf.candleMs);
}, [chartFor, history, tf]);

  // === Polling de factores: primero intenta /api/factors; si no existe, cae a /factors.txt (en /public)
  useEffect(() => {
    let stop = false;

    async function loadFactors() {
      try {
        // 1) intenta /api/factors
        let res = await fetch("/api/factors", { cache: "no-store" });
        if (!res.ok) {
          // 2) intenta /factors.txt en /public
          res = await fetch("/factors.txt", { cache: "no-store" });
        }
        if (res.ok) {
          const json = await res.json();
          if (!stop) setFactors(json);
        }
      } catch {
        // ignore si no existe aún
      }
      if (!stop) setTimeout(loadFactors, 10000); // refresca cada 10 s
    }

    loadFactors();
    return () => { stop = true; };
  }, []);

// ⬇️ único efecto de precios
useEffect(() => {
  if (!mounted) return;

  let timer: any;
  const POLL_MS = 7000; // 7 s fijo

  async function tick() {
    try {
      const res = await fetch("/api/price", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json() as {
        prices: Record<string, number>;
        candlesBase?: Record<string, Candle[]>;
        ts: number;
      };
      const now = data.ts || Date.now();

      setValues(prev => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          const old = next[id];
          const p = data.prices[id] ?? old.price;
          const changePct = +(((p - old.price) / Math.max(1e-9, old.price)) * 100).toFixed(2);
          next[id] = { ...old, price: p, changePct, updatedAt: now };
        }
        return next;
      });

      if (data.candlesBase) {
        setHistory(prev => {
          const merged: Record<string, Candle[]> = { ...prev };
          for (const [vid, arr] of Object.entries(data.candlesBase)) {
            merged[vid] = arr.slice(-100);
          }
          return merged;
        });
      }
    } catch (e) {
      // NO logueamos "Failed to fetch" si hay cortes breves
      // console.debug(e);
    }
  }

  tick(); // primer fetch inmediato
  timer = setInterval(tick, POLL_MS);
  return () => clearInterval(timer);
}, [mounted]);



  function resample(candles: Candle[], tfMs: number): Candle[] {
    if (!candles?.length) return [];
    const buckets = new Map<number, Candle>();
    for (const c of candles) {
      const k = Math.floor(c.time / tfMs) * tfMs;
      const b = buckets.get(k);
      if (!b) {
        buckets.set(k, { time: k, open: c.open, high: c.high, low: c.low, close: c.close });
      } else {
        if (c.high > b.high) b.high = c.high;
        if (c.low < b.low) b.low = c.low;
        b.close = c.close;
      }
    }
    return Array.from(buckets.values()).sort((a, b) => a.time - b.time).slice(-300);
  }

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

      const mapped = data.txs.map((t) => ({
        id: t.id,
        ts: new Date(t.ts).getTime(),
        type: (t.type as any) ?? "RESET",
        valueId: t.valueId,
        qty: t.qty,
        deltaPoints: Number(t.deltaPts),
      }));

      if (txScope === "me") setTxs(mapped);
    } catch {}
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

  // ==== Trading usando API (o demo sin sesión) ====
  async function placeOrder(mode: "BUY" | "SELL", valueId: string, qty: number) {
    const price = values[valueId]?.price;
    if (!price || qty <= 0) return;

    if (!user) {
      const cost = +(price * qty).toFixed(2);
      if (mode === "BUY" && student.points >= cost) {
        setStudent((s) => ({ ...s, points: +(s.points - cost).toFixed(2) }));
        setTxs((t) => [...t, { id: Math.random().toString(), ts: Date.now(), type: "BUY", valueId, qty, deltaPoints: -cost }]);
      }
      if (mode === "SELL") {
        const gain = +(price * qty).toFixed(2);
        setStudent((s) => ({ ...s, points: +(s.points + gain).toFixed(2) }));
        setTxs((t) => [...t, { id: Math.random().toString(), ts: Date.now(), type: "SELL", valueId, qty, deltaPoints: gain }]);
      }
      return;
    }

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

  // Helpers visuales para mostrar efecto teórico por categoría (no altera precios)
  function categoryDailyAdjPct(catId: string): number | null {
    if (!factors?.views24hPct || !factors?.coeff) return null;
    const k = factors.coeff[catId];
    if (typeof k !== "number") return null;
    return +(factors.views24hPct * k).toFixed(2); // p.ej., 14% * 0.10 = 1.40%/día
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📈 Classroom Trading</h1>
          <p className="text-neutral-400">
            {user ? (
              <>Bienvenido, <span className="font-semibold">{user.name}</span>. Tienes {fmt.format(points)} pts.</>
            ) : (
              <>Bienvenido, {student.name}. Tienes {fmt.format(student.points)} pts. (Modo demo)</>
            )}
          </p>
          {/* Nota de factores (informativa) */}
          {factors?.note && (
            <div className="text-xs text-neutral-500 mt-1">
              {factors.note} {factors.updatedAt ? <>· <span className="opacity-70">Actualizado: {new Date(factors.updatedAt).toLocaleString()}</span></> : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de temporalidad (reagrupa velas ya existentes; no acelera ticks) */}
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
            {TIMEFRAMES.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTf(opt)}
                className={
                  "px-2.5 py-1 text-sm rounded-lg transition " +
                  (tf.id === opt.id ? "bg-blue-600" : "hover:bg-neutral-800")
                }
                title={`Reagrupar en ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Panel de factores para ADMIN */}
          {user?.role === "ADMIN" && (
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-2">
              <div className="text-xs text-neutral-400">
                Δ vistas 24h:{" "}
                <span className="text-white font-medium">
                  {typeof factors?.views24hPct === "number" ? `${factors.views24hPct}%` : "—"}
                </span>
              </div>
              {/* Links útiles: abre el archivo/endpoint en una pestaña */}
              <a
                href="/api/factors"
                target="_blank"
                className="text-xs bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-1"
                title="Ver /api/factors (si existe)"
              >
                /api/factors
              </a>
              <a
                href="/factors.txt"
                target="_blank"
                className="text-xs bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-1"
                title="Ver /factors.txt en /public (si existe)"
              >
                /factors.txt
              </a>
            </div>
          )}

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
          {categories.map((cat) => {
            const catAdj = categoryDailyAdjPct(cat.id); // ajuste teórico por día para esta categoría
            return (
              <div key={cat.id} className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">{cat.name}</h2>
                  {user?.role === "ADMIN" && catAdj !== null && (
  <div className={"text-xs px-2 py-0.5 rounded-lg " + (catAdj >= 0 ? "bg-emerald-900/30 text-emerald-300" : "bg-red-900/30 text-red-300")}>
    Factor canal (teórico): {catAdj >= 0 ? "+" : ""}{catAdj}% / día
  </div>
)}

                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {Object.values(values)
                    .filter((v) => v.categoryId === cat.id)
                    .map((v) => (
                      <div key={v.id} className="rounded-2xl bg-neutral-950 border border-neutral-800 p-3">
                        <div
                          onClick={() => {
                            setChartFor(v.id);
                            // ✅ si no hay base para este id, siembra una vela con el precio actual
                            setCandlesBase((prev) => {
                              if (prev?.[v.id]?.length) return prev;
                              const p = values[v.id].price;
                              const now = Date.now();
                              return {
                                ...prev,
                                [v.id]: [{ time: now, open: p, high: p, low: p, close: p }],
                              };
                            });
                          }}
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

                        {/* Badge pequeñito por tarjeta (informativo) */}
                       {user?.role === "ADMIN" && catAdj !== null && (
  <div className="mt-2 text-[10px] text-neutral-500">
    Ajuste diario teórico por categoría: {catAdj >= 0 ? "+" : ""}{catAdj}% (según factores)
  </div>
)}

                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setTrade({ mode: "BUY", valueId: v.id })} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-1 rounded-xl">Comprar</button>
                          <button onClick={() => setTrade({ mode: "SELL", valueId: v.id })} className="flex-1 bg-red-600 hover:bg-red-500 py-1 rounded-xl">Vender</button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
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
                  <button onClick={() => placeOrder(trade.mode, trade.valueId, qty)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg">
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

            {user?.role === "ADMIN" && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-neutral-400">Ver:</span>
                <button
                  onClick={async () => {
                    setTxScope("me");
                    await refreshPortfolio();
                  }}
                  className={"px-2 py-1 rounded " + (txScope === "me" ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700")}
                >
                  Mis
                </button>
                <button
                  onClick={async () => {
                    setTxScope("all");
                    const all = await fetchTxs("all");
                    setTxs(all);
                  }}
                  className={"px-2 py-1 rounded " + (txScope === "all" ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700")}
                >
                  Todas
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {txs.length === 0 && <div className="text-sm text-neutral-500">Aún no hay movimientos.</div>}

              {txs
                .slice()
                .reverse()
                .map((t) => (
                  <div key={t.id} className="text-sm flex items-center justify-between border-b border-neutral-800 py-1">
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

                    {txScope === "all" && <span className="text-neutral-400">{t.userName ?? t.userId ?? "—"}</span>}

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
              <button onClick={() => setChartFor(null)} className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700">
                Cerrar
              </button>
            </div>

            {(derivedCandles?.length ?? 0) > 0 ? (
              <CandleChart
                key={chartFor + tf.id}
                candles={derivedCandles}
                height={300}
                xTicks={6}
                yTicks={4}
                bodyWidthRatio={0.4}
              />
            ) : (
              <div className="text-sm text-neutral-400">Aún no hay velas para esta temporalidad. Espera unos segundos…</div>
            )}
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
              <button onClick={() => setLoginOpen(false)} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700">
                Cancelar
              </button>
              <button onClick={handleLogin} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500">
                Entrar
              </button>
            </div>

            <p className="text-xs text-neutral-500 mt-3">
              Necesitas tener listas las rutas: /api/login, /api/logout, /api/portfolio, /api/trade, /api/transfer y /api/txs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
