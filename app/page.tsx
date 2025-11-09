// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import CandleChart from "../components/CandleChart";
import Link from "next/link";
import Faktoren from "@/components/Faktoren";
import { useToast } from "@/app/hooks/useToast";

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
  userId?: string;
  userName?: string;
  note?: string;
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
];
const DEFAULT_VALUES: Value[] = [
  // Aktien
  { id: "baumxp", categoryId: "aktien", name: "BAUMXP", description: "Bauunternehmen", price: 0, changePct: 0, updatedAt: 0 },
  { id: "dsgmxp", categoryId: "aktien", name: "DSGMXP", description: "Aufgabendesign", price: 0, changePct: 0, updatedAt: 0 },
  { id: "rftmxp", categoryId: "aktien", name: "RFTMXP", description: "Referate", price: 0, changePct: 0, updatedAt: 0 },

  // Materialien
  { id: "krimxp", categoryId: "materialien", name: "KRIMXP", description: "Krimis", price: 0, changePct: 0, updatedAt: 0 },
  { id: "grmmxp", categoryId: "materialien", name: "GRMMXP", description: "Grammatik", price: 0, changePct: 0, updatedAt: 0 },
  { id: "litmxp", categoryId: "materialien", name: "LITMXP", description: "Literatur", price: 0, changePct: 0, updatedAt: 0 },
  { id: "hormxp", categoryId: "materialien", name: "HORMXP", description: "Hörverstehen", price: 0, changePct: 0, updatedAt: 0 },

  // Währungen
  { id: "sonmxp", categoryId: "wahrungen", name: "SONMXP", description: "Valor de los puntos del domingo", price: 0, changePct: 0, updatedAt: 0 },
  { id: "sammxp", categoryId: "wahrungen", name: "SAMMXP", description: "Valor de los puntos del sábado", price: 0, changePct: 0, updatedAt: 0 },

  // Werte
  { id: "wgrmxp", categoryId: "werte", name: "WGRMXP", description: "Valor de los puntos del domingo", price: 0, changePct: 0, updatedAt: 0 },
  { id: "waumxp", categoryId: "werte", name: "WAUMXP", description: "Valor de los puntos del sábado", price: 0, changePct: 0, updatedAt: 0 },
  { id: "wbtmxp", categoryId: "werte", name: "WBTMXP", description: "Valor de los puntos del domingo", price: 0, changePct: 0, updatedAt: 0 },
  { id: "wxhmxp", categoryId: "werte", name: "WXHMXP", description: "Valor de los puntos del sábado", price: 0, changePct: 0, updatedAt: 0 },

  // Zehntel
  { id: "zhnmxp", categoryId: "zehntel", name: "ZHNMXP", description: "Valor de la décima", price: 0, changePct: 0, updatedAt: 0 },
  { id: "anlmxp", categoryId: "zehntel", name: "ANLMXP", description: "Bonos", price: 0, changePct: 0, updatedAt: 0 },

  // Güter
  { id: "gzehntel", categoryId: "guter", name: "Zehntel", description: "Décima", price: 0, changePct: 0, updatedAt: 0 },
  { id: "gkrimi", categoryId: "guter", name: "Krimi", description: "Krimi", price: 0, changePct: 0, updatedAt: 0 },
  { id: "ggramm", categoryId: "guter", name: "Grammatik", description: "Grammatik", price: 0, changePct: 0, updatedAt: 0 },
  { id: "glit", categoryId: "guter", name: "Literatur", description: "Literatur", price: 0, changePct: 0, updatedAt: 0 },
  { id: "ghor", categoryId: "guter", name: "Hörverstehen", description: "Hörverstehen", price: 0, changePct: 0, updatedAt: 0 },
];


// ==== Temporalidades ====
type Timeframe = { id: string; label: string; candleMs: number };
const M = 60_000;
const H = 60 * M;
const D = 24 * H;
const W = 7 * D;

const TIMEFRAMES: Timeframe[] = [
  { id: "5m", label: "5 m", candleMs: 5 * M },
  { id: "15m", label: "15 m", candleMs: 15 * M },
  { id: "1h", label: "1 h", candleMs: 1 * H },
  { id: "4h", label: "4 h", candleMs: 4 * H },
  { id: "1d", label: "1 D", candleMs: 1 * D },
  { id: "1w", label: "1 S", candleMs: 1 * W },
];

// 📊 Componente gráfico
function ZoomableCandleWrapper({
  candles,
  chartFor,
  tf,
}: {
  candles: Candle[];
  chartFor: string;
  tf: { id: string };
}) {
  const [visibleCount, setVisibleCount] = useState(16);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // 🎢 Cálculo de velas visibles
  const visibleCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    return candles.slice(-visibleCount);
  }, [candles, visibleCount]);

  // 📈 Eje Y con margen dinámico (sin tocar el tope)
  const [yMin, yMax] = useMemo(() => {
    if (!visibleCandles.length) return [0, 1];
    const lows = visibleCandles.map((c) => c.low);
    const highs = visibleCandles.map((c) => c.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.15; // margen de 15% arriba y abajo
    return [min - padding, max + padding];
  }, [visibleCandles]);

  // 🖱️ Arrastre horizontal (click y mover)
  const dragging = React.useRef(false);
  const lastX = React.useRef(0);

  function handleMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    lastX.current = e.clientX;
  }

  function handleMouseUp() {
    dragging.current = false;
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging.current || !containerRef.current) return;
    const delta = e.clientX - lastX.current;
    containerRef.current.scrollLeft -= delta;
    lastX.current = e.clientX;
  }

  // 🧩 Zoom con la rueda
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const wheelHandler = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY > 0) {
        setVisibleCount((v) => Math.min(128, v * 1.5)); // zoom out
      } else {
        setVisibleCount((v) => Math.max(4, Math.floor(v / 1.5))); // zoom in
      }
    };
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
  }, []);

  // 🧱 Render
  return (
    <div className="relative" style={{ height: 300, overflow: "hidden" }}>
      {/* Contenedor scrollable */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="select-none cursor-grab active:cursor-grabbing h-full"
        style={{
          overflowX: "scroll",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        <div
          className="transition-all duration-300 h-full"
          style={{
            minWidth: `${Math.max(900, visibleCandles.length * 8)}px`,
            marginLeft: "48px", // espacio para eje Y fijo
          }}
        >
          <div style={{ height: 300 }}>
            <CandleChart
              key={chartFor + tf.id + visibleCount}
              candles={visibleCandles}
              height={300}
              xTicks={6}
              yTicks={4}
              bodyWidthRatio={0.4}
              yMin={yMin}
              yMax={yMax}
              highlightLast={true}
              showYAxis={false}
            />
          </div>
        </div>
      </div>

      {/* 🧮 Eje Y fijo y dinámico */}
      <div
        className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-neutral-400 pr-1 border-r border-neutral-800 bg-neutral-950"
        style={{ width: "48px" }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const y = yMax - ((yMax - yMin) * i) / 4;
          return (
            <div key={i} className="text-right pr-1">
              {y.toFixed(2)}
            </div>
          );
        })}
      </div>
    </div>
  );
}




// ==== Componente principal ====
export default function Page() {
  const { showToast, ToastComponent } = useToast();

  const [portfolioSummary, setPortfolioSummary] = useState<{
    invested: number;
    profit: number;
    total: number;
  } | null>(null);

  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [prevMap, setPrevMap] = useState<Record<string, number>>({});
  const [student, setStudent] = useState<{ name: string; points: number }>({ name: "Alumno Demo", points: 0 });
  const [categories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [values, setValues] = useState<Record<string, Value>>(() =>
    Object.fromEntries(DEFAULT_VALUES.map((v) => [v.id, v]))
  );
  const [txs, setTxs] = useState<Tx[]>([]);
  const [history, setHistory] = useState<Record<string, Candle[]>>({});
  const [candlesBase, setCandlesBase] = useState<Record<string, Candle[]>>(() => {
    const now = Date.now();
    return Object.fromEntries(
      DEFAULT_VALUES.map((v) => [v.id, [{ time: now, open: v.price, high: v.price, low: v.price, close: v.price }]])
    );
  });
  const [trade, setTrade] = useState<{ mode: "BUY" | "SELL"; valueId: string } | null>(null);
  const [qty, setQty] = useState(1);
  const [pendingBook, setPendingBook] = useState<{ valueId: string; title: string } | null>(null);
  const [pendingZehntel, setPendingZehntel] = useState<{ valueId: string; qty: number } | null>(null);
  const [chartFor, setChartFor] = useState<string | null>(null);
  const [tf, setTf] = useState<Timeframe>(TIMEFRAMES[0]);
  const selected = chartFor ? values[chartFor] : null;
  const fmt = useMemo(() => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  const [txScope, setTxScope] = useState<"me" | "all">("me");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [positions, setPositions] = useState<
  Record<string, { qty: number; avgPrice: number; categoryId?: string; description?: string }>
>({});
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferConcept, setTransferConcept] = useState("");
  const [factors, setFactors] = useState<{ views24hPct?: number; coeff?: Record<string, number>; note?: string; updatedAt?: string } | null>(null);

// 🔒 Bloquear scroll del fondo cuando hay modales abiertos
useEffect(() => {
  const html = document.documentElement;
  const body = document.body;
  const hasModal = !!(chartFor || loginOpen);

  if (hasModal) {
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.classList.add("has-modal");
    const preventScroll = (e: WheelEvent | TouchEvent) => e.preventDefault();
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.classList.remove("has-modal");
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    };
  } else {
    body.classList.remove("has-modal");
  }
}, [chartFor, loginOpen]);


  useEffect(() => setMounted(true), []);

// === Cargar precios desde el backend (Render actualiza BD) ===
useEffect(() => {
  if (!mounted) return;

  (async () => {
    try {
      const res = await fetch("/api/price?mode=read", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo obtener precios iniciales");
      const data = await res.json();

      console.log("💰 Precios recibidos:", data);

      setValues((prev) => {
        const next = { ...prev };
        const now = Date.now();

        for (const [id, price] of Object.entries(data.prices || {})) {
          const old = next[id];
          const changePct = old?.price
            ? +(((Number(price) - old.price) / Math.max(1e-9, old.price)) * 100).toFixed(2)
            : 0;

          next[id] = {
            ...(old || {}),
            price: Number(price),
            changePct,
            updatedAt: now,
          };
        }

        return next;
      });
    } catch (err) {
      console.error("❌ Error al cargar precios:", err);
    }
  })();
}, [mounted]);


// === Recupera sesión activa al recargar la página ===
useEffect(() => {
  (async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        // ✅ Ahora también actualiza portafolio automáticamente
        await refreshPortfolio();
      }
    } catch (e) {
      console.warn("No se pudo verificar la sesión al iniciar:", e);
    }
  })();
}, []);


 

  // === Resampling (gráfico) ===
  const derivedCandles = useMemo(() => {
    if (!chartFor) return [];
    const base = history?.[chartFor] ?? [];
    return resample(base, tf.candleMs);
  }, [chartFor, history, tf]);

  // === Polling de factores ===
  useEffect(() => {
    let stop = false;
    async function loadFactors() {
      try {
        let res = await fetch("/api/factors", { cache: "no-store" });
        if (!res.ok) res = await fetch("/factors.txt", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (!stop) setFactors(json);
        }
      } catch {
        // sin log si no existe
      }
      
    }
    loadFactors();
    return () => { stop = true; };
  }, []);

const [top5, setTop5] = useState<{ id:number; user:string; points:number }[]>([]);

useEffect(() => {
  (async () => {
    const res = await fetch("/api/top");
    const data = await res.json();
    setTop5(data.top5);
  })();
}, []);

// === Cargar velas y refrescarlas automáticamente ===
useEffect(() => {
  const tf = "5m";

  async function loadAllCandles() {
try {
  await Promise.all(
    Object.values(DEFAULT_VALUES).map(async (v) => {
      const id = v.id.toLowerCase();
      const res = await fetch(`/api/candles?id=${id}&tf=${tf}&limit=1500`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!json.candles || json.candles.length === 0) {
  console.warn(`⚠️ Sin velas disponibles para ${id}`);
  return;
}


      setHistory((prev) => {
        const prevArr = prev[id] ?? [];
        const newArr = json.candles
          .map((c: any) => ({
            ...c,
            time:
              typeof c.time === "number" && !Number.isNaN(c.time)
                ? c.time
                : Date.now(),
          }))
          .sort((a: any, b: any) => a.time - b.time);

        const lastTime = prevArr.at(-1)?.time ?? 0;
        const added = newArr.filter(
          (c: any) => typeof c.time === "number" && c.time > lastTime
        );

        if (added.length === 0) return prev;

        console.log(
          `📈 ${id}: ${added.length} vela(s) nueva(s) → última ${new Date(
            added.at(-1).time
          ).toLocaleTimeString()}`
        );

        return {
          ...prev,
          [id]: [...prevArr, ...added].slice(-1500),
        };
      });
    })
  );
} catch (err) {
  console.error("❌ Error al refrescar velas:", err);
}

  }


  // Solo cargamos las velas al inicio, sin intervalo
loadAllCandles();

  
}, []);


  // === Resample helper ===
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
    return Array.from(buckets.values())
  .sort((a, b) => a.time - b.time)
  .filter((c) => !Number.isNaN(c.open) && c.open > 0)
  .slice(-1500);
  }

  // === API helper ===
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

  // === Login ===
  async function handleLogin() {
    const userId = loginId.trim();
    const code = loginCode.trim();
    if (!userId || !code) return alert("Completa ID y Clave");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al iniciar sesión");
      }
      const sessionRes = await fetch("/api/session", { cache: "no-store" });
      const sessionData = await sessionRes.json();
      if (sessionData.user) {
        setUser(sessionData.user);
        setLoginOpen(false);
        setLoginId("");
        setLoginCode("");
        await refreshPortfolio();
      } else {
        throw new Error("No se pudo verificar la sesión");
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
      setTxs([]);
    } catch (e: any) {
      alert(e.message || "No se pudo cerrar sesión");
    }
  }

// === Portafolio ===
async function refreshPortfolio() {
  try {
    setLoadingPortfolio(true); // ⏳ Mostrar estado de carga

    const data = await api<{
      points: number;
      invested: number;
      profit: number;
      total: number;
      positions: {
        valueId: string;
        qty: number;
        avgPrice: number;
        categoryId?: string;
        description?: string;
      }[];
      txs: any[];
    }>("/api/portfolio");

    // 🪙 Actualizar los valores principales
    setPoints(Number(data.points));

    // 🧩 Guardar resumen (para mostrar equity, invertido, etc.)
    setPortfolioSummary({
      invested: data.invested,
      profit: data.profit,
      total: data.total,
    });

    // 🔹 Actualizar posiciones
    const newPositions: Record<
      string,
      { qty: number; avgPrice: number; categoryId?: string; description?: string }
    > = {};

    for (const p of data.positions) {
      newPositions[p.valueId] = {
        qty: p.qty,
        avgPrice: p.avgPrice,
        categoryId: p.categoryId,
        description: p.description,
      };
    }

    setPositions(newPositions);

    // 🔹 Actualizar transacciones recientes
    const mapped = data.txs.map((t) => ({
      id: t.id,
      ts: new Date(t.ts).getTime(),
      type: t.type,
      valueId: t.valueId,
      qty: t.qty,
      deltaPoints: Number(t.deltaPts),
      note: t.note,
    }));

    if (txScope === "me") setTxs(mapped);

    console.log("🧾 Portafolio actualizado:", {
      points: data.points,
      invested: data.invested,
      profit: data.profit,
      total: data.total,
    });
  } catch (e) {
    console.error("Error cargando portafolio", e);
  } finally {
    setLoadingPortfolio(false); // ✅ Ocultar estado de carga siempre, incluso si falla
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
      note: t.note,
      userId: t.userId,
      userName: t.userName,
    }));
  }

// === Trading ===
async function placeOrder(mode: "BUY" | "SELL", valueId: string, qty: number) {
  const price = values[valueId]?.price;
  if (!price || qty <= 0) return;

  // 🧪 Si no hay usuario: modo demo
  if (!user) {
    const cost = +(price * qty).toFixed(2);
    if (student.points < cost) {
      showToast("No tienes suficientes puntos para realizar esta operación.", "red");
      return;
    }
    setStudent((s) => ({ ...s, points: +(s.points - cost).toFixed(2) }));
    setTxs((t) => [
      ...t,
      { id: Math.random().toString(), ts: Date.now(), type: mode, valueId, qty, deltaPoints: -cost },
    ]);
    showToast(`Operación demo: ${mode === "BUY" ? "Compra" : "Venta"} realizada`, "blue");
    return;
  }

  // 👇 Usuarios logueados (caso real)
  try {
    const res = await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, valueId, qty, price }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al procesar la operación.");

    await refreshPortfolio();
    const updated = await fetchTxs("me");
    setTxs(updated);
    setTrade(null);

    showToast(
      `${mode === "BUY" ? "Compra" : "Venta"} realizada exitosamente.`,
      mode === "BUY" ? "green" : "red"
    );
  } catch (e: any) {
    showToast(e.message || "Error al procesar la operación", "red");
  }
}

// === Cierre de posición ===
async function handleClosePosition(valueId: string, price: number) {
  if (!confirm(`¿Cerrar tu posición en ${valueId}?`)) return;
  try {
    const res = await fetch("/api/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valueId, price }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al cerrar");

    const profit = json.profit ?? 0;
    const color = profit >= 0 ? "green" : "red";
    showToast(
      `${profit >= 0 ? "Ganancia" : "Pérdida"}: ${
        profit >= 0 ? "+" : ""
      }${profit.toFixed(2)} MXP`,
      color
    );

    await refreshPortfolio();
    setChartFor(null);
  } catch (err: any) {
    showToast("Error: " + err.message, "red");
  }
}

  // === Transferencias ===
  async function doTransfer() {
    if (!user) return setLoginOpen(true);
    const toUserId = transferTo.trim();
    const amount = Number(transferAmount);
    const concept = transferConcept.trim();

    if (!toUserId || amount <= 0 || !concept) {
      alert("Completa todos los campos (ID, monto y concepto).");
      return;
    }

    try {
      await api("/api/transfer", {
        method: "POST",
        body: JSON.stringify({ toUserId, amount, concept }),
      });
      setTransferAmount(0);
      setTransferTo("");
      setTransferConcept("");
      await refreshPortfolio();
    } catch (e: any) {
      alert(e.message || "Error en transferencia");
    }
  }

// 🔹 Actualiza el resumen global del portafolio completo (sin contar Güter)
useEffect(() => {
  if (!positions || Object.keys(positions).length === 0) return;

  let investedTotal = 0;
  let currentTotal = 0;

  // Recorre todas las posiciones abiertas
  for (const [id, pos] of Object.entries(positions)) {
    if (!pos || pos.qty <= 0) continue;

    const cat = pos.categoryId || values[id]?.categoryId;

    // 🚫 Excluir todos los Güter (aunque no tengan categoryId explícito)
    const isGuter =
      (cat && cat.toLowerCase() === "guter") ||
      id.startsWith("g") ||
      ["gzehntel", "gkrimi", "ggramm", "glit", "ghor"].includes(id);

    if (isGuter) continue;

    const current = values[id]?.price ?? 0;
    const invested = pos.avgPrice * pos.qty;
    const currentValue = current * pos.qty;

    investedTotal += invested;
    currentTotal += currentValue;
  }

  // Solo cuenta ganancias/pérdidas de inversiones reales
  const profitTotal = currentTotal - investedTotal;

  // 💰 Total = puntos disponibles + valor actual de inversiones (sin Güter)
  const total = points + currentTotal;

  setPortfolioSummary((prev) => {
    if (
      prev &&
      prev.invested === investedTotal &&
      prev.profit === profitTotal &&
      prev.total === total
    ) {
      return prev;
    }
    return {
      invested: investedTotal,
      profit: profitTotal,
      total: total,
    };
  });
}, [positions, values, points]);





  if (!mounted) return null;

  function categoryDailyAdjPct(catId: string): number | null {
    if (!factors?.views24hPct || !factors?.coeff) return null;
    const k = factors.coeff[catId];
    if (typeof k !== "number") return null;
    return +(factors.views24hPct * k).toFixed(2);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      {/* ==== Header ==== */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📈 Classroom Trading</h1>
          <p className="text-neutral-400">
            {user ? (
              <>Willkommen, <span className="font-semibold">{user.name}</span>. Du hast {fmt.format(points)} MXP </>
            ) : (
              <>Willkommen, {student.name}. Du hast {fmt.format(student.points)} MXP (Modo demo)</>
            )}
          </p>

          {factors?.note && (
            <div className="text-xs text-neutral-500 mt-1">
              {factors.note}{" "}
              {factors.updatedAt && (
                <>
                  · <span className="opacity-70">Actualizado: {new Date(factors.updatedAt).toLocaleString()}</span>
                </>
              )}
            </div>
          )}
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
                title={`Reagrupar en ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Panel de factores */}
          {user?.role === "ADMIN" && (
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-2">
              <div className="text-xs text-neutral-400">
                Δ vistas 24h:{" "}
                <span className="text-white font-medium">
                  {typeof factors?.views24hPct === "number" ? `${factors.views24hPct}%` : "—"}
                </span>
              </div>
              <a
                href="/api/factors"
                target="_blank"
                className="text-xs bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-1"
              >
                /api/factors
              </a>
              <a
                href="/factors.txt"
                target="_blank"
                className="text-xs bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-1"
              >
                /factors.txt
              </a>
            </div>
          )}

          {/* Sesión */}
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

{/* ==== Resumen global del portafolio ==== */}
{user && (
  loadingPortfolio ? (
    <div className="mb-6 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
      {/* Placeholder con shimmer */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex flex-col items-center justify-center space-y-2"
        >
          <div className="h-4 w-24 shimmer"></div>
          <div className="h-6 w-28 shimmer"></div>
          <div className="h-3 w-20 shimmer"></div>
        </div>
      ))}
    </div>
  ) : (
    <div className="mb-6 bg-neutral-900 border border-neutral-800 rounded-2xl p-5 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">

      {/* 💰 Puntos disponibles */}
      <div className="flex flex-col items-center justify-center">
        <div className="text-sm text-neutral-400">💰 Puntos disponibles</div>
        <div className="text-xl font-semibold text-white">
          {points !== undefined ? fmt.format(points) : "—"} MXP
        </div>
        <div className="text-xs text-neutral-500 mt-1">(sin invertir)</div>
      </div>

      {/* 📊 Capital invertido */}
      <div className="flex flex-col items-center justify-center">
        <div className="text-sm text-neutral-400">📊 Capital invertido</div>
        <div className="text-xl font-semibold text-amber-300">
          {portfolioSummary ? fmt.format(portfolioSummary.invested) : "—"} MXP
        </div>
        <div className="text-xs text-neutral-500 mt-1">(actualmente en juego)</div>
      </div>

      {/* 📈 Ganancia/pérdida */}
      <div className="flex flex-col items-center justify-center">
        <div className="text-sm text-neutral-400">📈 Ganancia / pérdida</div>
        <div
          className={
            "text-xl font-semibold " +
            ((portfolioSummary?.profit ?? 0) > 0
              ? "text-emerald-400"
              : (portfolioSummary?.profit ?? 0) < 0
              ? "text-red-400"
              : "text-blue-400")
          }
        >
          {portfolioSummary
            ? `${portfolioSummary.profit >= 0 ? "+" : ""}${fmt.format(portfolioSummary.profit)} MXP`
            : "—"}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          {portfolioSummary
            ? portfolioSummary.profit > 0
              ? "Ganando actualmente"
              : portfolioSummary.profit < 0
              ? "Perdiendo actualmente"
              : "Sin variaciones"
            : "—"}
        </div>
      </div>

      {/* 🧾 Puntos totales */}
      <div className="flex flex-col items-center justify-center">
        <div className="text-sm text-neutral-400">🧾 Puntos totales</div>
        <div
          className={
            "text-xl font-semibold transition-colors duration-500 " +
            ((portfolioSummary?.profit ?? 0) > 0
              ? "text-emerald-400"
              : (portfolioSummary?.profit ?? 0) < 0
              ? "text-red-400"
              : "text-blue-400")
          }
        >
          {portfolioSummary
            ? `${fmt.format(portfolioSummary.total)} MXP`
            : "—"}
        </div>
        <div className="text-xs mt-1 text-neutral-500">
          {portfolioSummary
            ? portfolioSummary.profit > 0
              ? "Portafolio en ganancia"
              : portfolioSummary.profit < 0
              ? "Portafolio en pérdida"
              : "Sin variaciones"
            : "—"}
        </div>
      </div>
    </div>
  )
)}


      {/* ==== Contenido principal ==== */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {/* ==== Panel izquierdo ==== */}
        <section className="lg:col-span-2 space-y-6">
          {categories
  .filter((c) => c.id !== "guter")
  .map((cat) => {

    const catAdj = categoryDailyAdjPct(cat.id);
            return (
              <div key={cat.id} className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">{cat.name}</h2>
                  {user?.role === "ADMIN" && catAdj !== null && (
                    <div
                      className={
                        "text-xs px-2 py-0.5 rounded-lg " +
                        (catAdj >= 0 ? "bg-emerald-900/30 text-emerald-300" : "bg-red-900/30 text-red-300")
                      }
                    >
                      Factor canal (teórico): {catAdj >= 0 ? "+" : ""}
                      {catAdj}% / día
                    </div>
                  )}
                </div>


                <div className="grid sm:grid-cols-2 gap-3">
                  {Object.values(values)
                    .filter((v) => v.categoryId === cat.id)
                    .map((v) => (
                      <div key={v.id} className="rounded-2xl bg-neutral-950 border border-neutral-800 p-3">
                        {/* Tarjeta de valor */}
                        <div
                          onClick={() => {
                            setChartFor(v.id);
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
  <div className="text-lg font-bold">
    {v.price > 0 ? fmt.format(v.price) : "—"}
  </div>
  {v.price > 0 && (
    <div className={"text-xs " + (v.changePct >= 0 ? "text-emerald-400" : "text-red-400")}>
      {v.changePct >= 0 ? "+" : ""}
      {v.changePct}%
    </div>
  )}
</div>

                        </div>

                        {/* Info de posesión */}
                        {positions[v.id] && (
                          <div className="mt-2 text-sm">
                            <div className="text-neutral-400">
                              Posees {positions[v.id].qty} unidades a {fmt.format(positions[v.id].avgPrice)} MXP c/u
                            </div>
                            <div
                              className={
                                v.price >= positions[v.id].avgPrice
                                  ? "text-emerald-400 text-xs"
                                  : "text-red-400 text-xs"
                              }
                            >
                              {v.price >= positions[v.id].avgPrice ? "▲" : "▼"}{" "}
                              {(((v.price / positions[v.id].avgPrice) - 1) * 100).toFixed(2)}%
                            </div>
                          </div>
                        )}

                        {/* Cambio diario */}
                        {prevMap[v.name] && (
                          <div
                            className={
                              "text-[11px] " +
                              (v.price >= prevMap[v.name] ? "text-emerald-400" : "text-red-400")
                            }
                          >
                            {v.price >= prevMap[v.name] ? "↑" : "↓"}{" "}
                            {(((v.price / prevMap[v.name]) - 1) * 100).toFixed(2)}% vs ayer
                          </div>
                          
                        )}

                       {/* Botones de acción */}
<div className="flex gap-2 mt-3">
  {v.categoryId === "guter" ? (
    <button
      onClick={() => {
        const price = v.price || 1;
        placeOrder("BUY", v.id, 1); // 🔹 compra 1 unidad fija
      }}
      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-1 rounded-xl"
    >
      Adquirir
    </button>
  ) : (
    <>
      <button
        onClick={() => setTrade({ mode: "BUY", valueId: v.id })}
        className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-1 rounded-xl"
      >
        Comprar
      </button>
      <button
        onClick={() => setTrade({ mode: "SELL", valueId: v.id })}
        className="flex-1 bg-red-600 hover:bg-red-500 py-1 rounded-xl"
      >
        Vender
      </button>
    </>
  )}
</div>

                      </div>
                    ))}
                </div>
              </div>
            );
          })}

{/* ==== Bienes disponibles (Güter) ==== */}
<div className="bg-neutral-900 rounded-2xl p-5 border border-neutral-800 mt-10">
  <h2 className="text-lg font-semibold mb-3">🎁 Bienes disponibles (Güter)</h2>

  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
    {Object.values(values)
      .filter((v) => v.categoryId === "guter")
      .map((v) => (
        <div
          key={v.id}
          className="rounded-2xl bg-neutral-950 border border-neutral-800 p-3"
        >
          <div className="font-medium">{v.name}</div>
          <div className="text-xs text-neutral-400 mb-2">{v.description}</div>
          <div className="text-lg font-semibold mb-2">
            {fmt.format(v.price)} MXP
          </div>

{v.name.toLowerCase() === "zehntel" ? (
  <button
    onClick={() => setPendingZehntel({ valueId: v.id, qty: 1 })}
    className="w-full bg-emerald-600 hover:bg-emerald-500 py-1 rounded-xl mt-2"
  >
    Adquirir
  </button>
) : (
  <button
    onClick={() => setPendingBook({ valueId: v.id, title: "" })}
    className="w-full bg-emerald-600 hover:bg-emerald-500 py-1 rounded-xl mt-2"
  >
    Adquirir
  </button>
)}



        </div>
      ))}
  </div>
</div>



{/* ==== Mis bienes ==== */}
{user && (
  <>
    {/* 📦 Mis bienes adquiridos */}
<div className="bg-neutral-900 rounded-2xl p-5 border border-neutral-800 mt-8">
  <h2 className="text-lg font-semibold mb-3">📦 Mis bienes adquiridos</h2>

  {(() => {
    const bienes = Object.entries(positions).filter(([id, pos]) => {
      const val = values[id] || {};
      return (
        pos.qty > 0 &&
        (val.categoryId?.toLowerCase?.() === "guter" ||
          pos.categoryId?.toLowerCase?.() === "guter")
      );
    });

    if (bienes.length === 0) {
      return (
        <p className="text-sm text-neutral-400">
          Aún no has comprado bienes.
        </p>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-700 text-neutral-400">
              <th className="text-left py-2">Bien</th>
              <th className="text-left py-2">Descripción</th>
              <th className="text-right py-2">Cantidad</th>
              <th className="text-right py-2">Precio promedio</th>
              <th className="text-right py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {bienes.map(([id, pos]) => {
              const v = values[id] || {};

              return (
                <tr
                  key={id}
                  className="border-b border-neutral-800 hover:bg-neutral-800/50"
                >
                  <td className="py-2 cursor-default text-blue-300 font-medium">
                    {v.name ?? id}
                  </td>
                  <td className="py-2 text-neutral-400">
                    {pos.description ?? v.description ?? "—"}
                  </td>
                  <td className="py-2 text-right">{Math.round(pos.qty)}</td>
                  <td className="py-2 text-right">
                    {pos.avgPrice > 0 ? fmt.format(pos.avgPrice) : "—"} MXP
                  </td>
                  <td className="py-2 text-right text-emerald-400 text-xs font-medium">
                    Adquirido
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  })()}
</div>


    {/* 📜 Mis transacciones recientes */}
<div className="bg-neutral-900 rounded-2xl p-5 border border-neutral-800 mt-10 shadow-lg shadow-blue-900/10">
  <h2 className="text-lg font-semibold mb-3 text-blue-300 flex items-center gap-2">
    📜 Mis transacciones recientes
  </h2>

  {txs.length === 0 ? (
    <p className="text-sm text-neutral-400">
      Aún no has realizado operaciones.
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-neutral-700 text-neutral-400">
            <th className="text-left py-2">Tipo</th>
            <th className="text-left py-2">Valor</th>
            <th className="text-right py-2">Cantidad</th>
            <th className="text-right py-2">Δ Puntos</th>
            <th className="text-right py-2">Fecha</th>
            <th className="text-right py-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {txs
            .slice(-10)
            .reverse()
            .map((t) => {
              const v = values[t.valueId];
              const pos = positions[t.valueId];
              const puedeCerrar =
                pos?.qty > 0 &&
                v?.categoryId?.toLowerCase() !== "guter" &&
                t.type === "BUY";

              return (
                <tr
                  key={t.id}
                  className="border-b border-neutral-800 hover:bg-neutral-800/50"
                >
                  <td
                    className={
                      "py-2 font-medium " +
                      (t.type === "BUY"
                        ? "text-emerald-400"
                        : t.type === "SELL"
                        ? "text-red-400"
                        : "text-neutral-300")
                    }
                  >
                    {t.type}
                  </td>
                  <td className="py-2 text-neutral-300">{t.valueId}</td>
                  <td className="py-2 text-right">
                    {t.qty ? t.qty.toFixed(3) : "—"}
                  </td>
                  <td
                    className={
                      "py-2 text-right " +
                      (t.deltaPoints >= 0
                        ? "text-emerald-400"
                        : "text-red-400")
                    }
                  >
                    {t.deltaPoints >= 0 ? "+" : ""}
                    {fmt.format(t.deltaPoints)}
                  </td>
                  <td className="py-2 text-right text-neutral-500 text-xs">
                    {new Date(t.ts).toLocaleString("es-MX")}
                  </td>
                  <td className="py-2 text-right">
                    {puedeCerrar && (
                      <button
                        onClick={() =>
                          handleClosePosition(t.valueId, v?.price ?? 0)
                        }
                        className="bg-blue-600 hover:bg-blue-500 px-3 py-0.5 rounded-lg text-xs font-medium transition"
                      >
                        Cerrar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  )}
</div>

    {/* 📚 Link a bienes */}
    <Link
      href="/guter"
      className="inline-block mt-6 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
    >
      📚 Sieh die verfügbaren Güter
    </Link>
  </>
)}

</section>


        {/* ==== Sidebar derecho ==== */}
        <aside className="space-y-4">
          {/* ==== Orden rápida ==== */}
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
            <h3 className="font-semibold mb-2">Orden rápida</h3>
            {trade ? (
              <div className="space-y-3">
                <div className="text-sm text-neutral-400">
  Modo: {trade.mode} · Ingresa el monto en MXP a invertir
</div>

                <div className="flex items-center gap-2">
                 <input
  type="number"
  min={1}
  value={qty}
  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
  className="w-28 bg-neutral-800 rounded-lg px-2 py-1"
  placeholder="Monto MXP"
/>
<button
  onClick={() => {
    const price = values[trade.valueId]?.price || 1;
    const units = qty / price;
    placeOrder(trade.mode, trade.valueId, units);
  }}
  className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg"
>
  Confirmar
</button>

                  <button
                    onClick={() => setTrade(null)}
                    className="bg-neutral-700 hover:bg-neutral-600 px-3 py-1 rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-400">
                Elige un valor y presiona Comprar/Vender.
              </div>
            )}
          </div>

          {/* ==== Transferencias ==== */}
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
            <h3 className="font-semibold mb-2">Transferir MXP</h3>

            <div className="flex flex-col gap-2">
              <input
                placeholder="ID destino (ej.: 64)"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="bg-neutral-800 rounded-lg px-2 py-1"
              />
             <input
  type="text"
  inputMode="decimal"
  pattern="^[0-9]+([.,][0-9]{0,2})?$"
  placeholder="Monto"
  value={transferAmount}
  onChange={(e) => {
    let value = e.target.value;

    // ✅ Permite vacío, enteros o decimales con punto o coma
    if (value === "" || /^[0-9]+([.,][0-9]{0,2})?$/.test(value)) {
      // Normaliza internamente a punto (.) para el estado
      value = value.replace(",", ".");
      setTransferAmount(value);
    }
  }}
  onBlur={() => {
    // 🔢 Redondea a 2 decimales al salir del campo
    const num = parseFloat(String(transferAmount).replace(",", "."));
    if (!isNaN(num)) setTransferAmount(num.toFixed(2));
  }}
  className="bg-neutral-800 rounded-lg px-2 py-1"
  inputMode="decimal"
/>



              <input
                placeholder="Concepto (obligatorio)"
                value={transferConcept}
                onChange={(e) => setTransferConcept(e.target.value)}
                className="bg-neutral-800 rounded-lg px-2 py-1"
              />
              <button
                onClick={doTransfer}
                className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-lg"
              >
                Enviar
              </button>
              {!user && (
                <div className="text-xs text-neutral-500">Inicia sesión para transferir.</div>
              )}
            </div>
          </div>

          {/* ==== Transacciones ==== */}
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
                  className={
                    "px-2 py-1 rounded " +
                    (txScope === "me" ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700")
                  }
                >
                  Mis
                </button>
                <button
                  onClick={async () => {
                    setTxScope("all");
                    const all = await fetchTxs("all");
                    setTxs(all);
                  }}
                  className={
                    "px-2 py-1 rounded " +
                    (txScope === "all" ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700")
                  }
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

                    {txScope === "all" && (
                      <span className="text-neutral-400">
                        {t.userName ?? t.userId ?? "—"}
                      </span>
                    )}

                    <div className="text-right">
                      <span
                        className={
                          t.deltaPoints >= 0 ? "text-emerald-400" : "text-red-400"
                        }
                      >
                        {t.deltaPoints >= 0 ? "+" : ""}
                        {t.deltaPoints.toFixed(2)}
                      </span>
                      {t.note && (
                        <div className="text-xs text-neutral-500 italic mt-0.5">
                          {t.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

{/* ==== Top 5 Usuarios ==== */}
<div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
  <h3 className="font-semibold mb-2">🏆 Top 5 Studenten</h3>
  <div className="space-y-1">
    {top5.map((u, i) => (
      <div key={u.id} className="flex justify-between text-sm border-b border-neutral-800 py-1">
        <span>{i + 1}. {u.user}</span>
        <span className="text-neutral-400">{u.points.toFixed(2)} MXP</span>
      </div>
    ))}
  </div>
</div>


{/* ==== Métricas semanales ==== */}
<Faktoren />


</aside>
</main>



{/* ==== Modal de Gráfico (con zoom, arrastre y parpadeo) ==== */}
{chartFor && selected && (
  <div
    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    onWheel={(e) => e.stopPropagation()}
  >
    <div
  className="w-full max-w-2xl rounded-2xl bg-neutral-950 border border-neutral-800 p-5"
  style={{ overflow: "hidden" }} // ✅ fuerza ocultar scrolls verticales
>

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs text-neutral-400">Gráfico de velas</div>
          <div className="text-lg font-semibold">{selected.name}</div>
          <div className="text-xs text-neutral-500">{selected.description}</div>
        </div>
        <button
          onClick={() => setChartFor(null)}
          className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700"
        >
          Cerrar
        </button>
      </div>

{(derivedCandles?.length ?? 0) > 0 ? (
  <>
    {/* 🔹 Info y botón de cierre (solo si hay posición abierta) */}
    {positions[chartFor]?.qty > 0 && (
  <div className="mb-4 text-right">
    {(() => {
      const pos = positions[chartFor];
      const current = selected.price ?? 0;
      const invested = pos.avgPrice * pos.qty;
      const currentValue = current * pos.qty;
      const profit = currentValue - invested;
      const profitPct = invested > 0 ? (profit / invested) * 100 : 0;

      

      return (
        <div
          className={
            "text-sm mb-2 " +
            (profit >= 0 ? "text-emerald-400" : "text-red-400")
          }
        >
          Ganancia/pérdida actual:{" "}
          {profit >= 0 ? "+" : ""}
          {fmt.format(profit)} MXP ({profitPct.toFixed(2)}%)
        </div>
      );
    })()}

    <button
      onClick={() => handleClosePosition(chartFor, selected.price ?? 0)}
      className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-sm font-medium transition"
    >
      Cerrar inversión
    </button>
  </div>
)}


<ZoomableCandleWrapper
  candles={derivedCandles}
  chartFor={chartFor}
  tf={tf}
/>

  </>
) : (
  <div className="text-sm text-neutral-400">
    Aún no hay velas para esta temporalidad. Espera unos segundos…
  </div>
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
              placeholder="Ej. 65"
            />

            <label className="text-sm text-neutral-400 mt-3 block">Clave</label>
            <input
              type="password"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="mt-1 w-full bg-neutral-800 rounded-lg px-3 py-2 outline-none"
              placeholder="Ej. 1234"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setLoginOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogin}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
            )}

{/* ==== Modal: Solicitar título del libro adquirido ==== */}
{pendingBook && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
    <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl p-5">
      <h3 className="text-lg font-semibold mb-2 text-white">
        📚 Escribe el título del libro
      </h3>
      <p className="text-sm text-neutral-400 mb-3">
        Indica el nombre del libro que deseas recibir.
      </p>

      <input
        type="text"
        value={pendingBook.title}
        onChange={(e) =>
          setPendingBook({ ...pendingBook, title: e.target.value })
        }
        className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-white outline-none"
        placeholder="Ej. 'Aprende un idioma en 7 días', etc."
      />

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={() => setPendingBook(null)}
          className="bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={async () => {
            if (!pendingBook.title.trim()) {
              showToast("Por favor escribe un título.", "red");
              return;
            }
            await placeOrder("BUY", pendingBook.valueId, 1);
            await fetch("/api/txs/note", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                valueId: pendingBook.valueId,
                note: pendingBook.title.trim(),
              }),
            });
            setPendingBook(null);
            showToast("Solicitud enviada correctamente.", "green");
          }}
          className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-white"
        >
          Confirmar compra
        </button>
      </div>
    </div>
  </div>
)}

{/* ==== Modal: Seleccionar cantidad de décimas ==== */}
{pendingZehntel && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
    <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl p-5">
      <h3 className="text-lg font-semibold mb-2 text-white">
        🔢 ¿Cuántas décimas deseas adquirir?
      </h3>
      <p className="text-sm text-neutral-400 mb-4">
        Indica la cantidad de décimas que deseas comprar.
      </p>

      {/* Deslizador */}
      <input
        type="range"
        min={1}
        max={20}
        value={pendingZehntel.qty}
        onChange={(e) =>
          setPendingZehntel({ ...pendingZehntel, qty: Number(e.target.value) })
        }
        className="w-full accent-emerald-500"
      />
      <div className="text-center text-sm text-neutral-400 mt-1">
        {pendingZehntel.qty} décima(s)
      </div>

      {/* 🧮 Resumen dinámico del costo */}
      <div className="mt-4 text-center border-t border-neutral-800 pt-3 text-sm">
        {(() => {
          const v = values[pendingZehntel.valueId];
          const precioUnit = v?.price ?? 0;
          const total = (precioUnit * pendingZehntel.qty).toFixed(2);
          return (
            <div className="text-neutral-300">
              💰 Precio unitario:{" "}
              <span className="text-white font-medium">
                {fmt.format(precioUnit)} MXP
              </span>
              <br />
              🔸 Total:{" "}
              <span className="text-emerald-400 font-semibold">
                {fmt.format(Number(total))} MXP
              </span>
            </div>
          );
        })()}
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={() => setPendingZehntel(null)}
          className="bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={async () => {
            if (!pendingZehntel.qty || pendingZehntel.qty <= 0) {
              showToast("Por favor indica una cantidad válida.", "red");
              return;
            }
            await placeOrder("BUY", pendingZehntel.valueId, pendingZehntel.qty);
            setPendingZehntel(null);
            showToast("Décimas adquiridas correctamente.", "green");
          }}
          className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-white"
        >
          Confirmar compra
        </button>
      </div>
    </div>
  </div>
)}



<ToastComponent />


    </div>
  );
}
