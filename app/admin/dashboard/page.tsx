"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";

// 🧩 Tipos para el dashboard
type HealthMap = Record<
  string,
  {
    exists: boolean;
    size: number;
    mtime: string | null;
    parseOk: boolean;
    error?: string;
  }
>;

type Summary = {
  ok: boolean;
  lastDate: string | null;
  lastCount: number;
  topGainers: { ticker: string; d1pct: number; price: number }[];
  topLosers: { ticker: string; d1pct: number; price: number }[];
  recent: { date: string; count: number }[];
  lastClose: Record<string, number>;
  health: HealthMap;
};

// 🧩 Componente principal
export default function AdminDashboard() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [sum, setSum] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // === Verificar sesión y permisos ===
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!res.ok) throw new Error("No session");
        const data = await res.json();

        if (data?.user?.id === 64 || data?.user?.role === "ADMIN") {
          setIsAdmin(true);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    }
    checkSession();
  }, []);

  // === Cargar summary una vez ===
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/admin/summary", { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Error summary");
        setSum(json);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [isAdmin]);

  // === Mantener precios y velas actualizados (tick cada 10s) ===
  useEffect(() => {
    if (!isAdmin) return; // solo el admin dispara la simulación global

    const tick = setInterval(async () => {
      try {
        const res = await fetch("/api/price", { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo actualizar precios");
      } catch (e) {
        console.error("Error actualizando precios:", e);
      }
    }, 10000); // 10s = mismo valor que tickSeconds

    return () => clearInterval(tick);
  }, [isAdmin]);



  // === Funciones del dashboard ===
  const runDaily = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/run-daily", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error al ejecutar cierre");
      const res2 = await fetch("/api/admin/summary", { cache: "no-store" });
      const j2 = await res2.json();
      if (j2.ok) setSum(j2);
      setMsg("Cierre ejecutado correctamente.");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const resnapshot = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/resnapshot", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo resnapshotear");
      const res2 = await fetch("/api/admin/summary", { cache: "no-store" });
      const j2 = await res2.json();
      if (j2.ok) setSum(j2);
      setMsg(`Guardado en historial: ${json.date}`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const repair = useCallback(async (target: "history" | "state") => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo reparar");
      const res2 = await fetch("/api/admin/summary", { cache: "no-store" });
      const j2 = await res2.json();
      if (j2.ok) setSum(j2);
      setMsg(`Reparado: ${json.repaired}`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const lastRows = useMemo(() => {
    if (!sum) return [];
    return Object.entries(sum.lastClose)
      .map(([ticker, price]) => ({ ticker, price }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [sum]);

  // === Estados de carga / sin permisos ===
  if (checking)
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
        Verificando sesión...
      </div>
    );

  if (!isAdmin)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-red-400 text-center p-6">
        <h1 className="text-2xl font-bold mb-2">⛔ Acceso denegado</h1>
        <p className="text-neutral-400 text-sm max-w-sm">
          Esta página es solo para administradores. Si crees que es un error,
          contacta con el profesor Ben.
        </p>
      </div>
    );

  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!sum) return <div className="p-6">Cargando dashboard…</div>;

  // === Render principal ===
  return (
    <div className="p-6 space-y-6 text-white bg-neutral-950 min-h-screen">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🏦 Panel de Administración</h1>
          <div className="text-sm text-gray-400">
            Último cierre: <b>{sum.lastDate ?? "—"}</b> · Activos:{" "}
            <b>{sum.lastCount}</b>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sync"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
          >
            🔄 Sincronizar usuarios
          </Link>
          <button
            onClick={runDaily}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-white ${
              busy ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {busy ? "Ejecutando…" : "Ejecutar cierre"}
          </button>
          <button
            onClick={resnapshot}
            disabled={busy}
            className={`rounded-lg px-4 py-2 border ${
              busy
                ? "text-gray-400 border-gray-600"
                : "text-gray-200 border-gray-400 hover:bg-gray-800"
            }`}
          >
            Guardar snapshot actual
          </button>
          {msg && <span className="text-sm text-gray-300">{msg}</span>}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3">
        <Card title="Salud del sistema">
          <Health status={sum.health} onRepair={repair} />
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top 5 — Ganadores (vs ayer)">
          <MoversList items={sum.topGainers} positive />
        </Card>
        <Card title="Top 5 — Perdedores (vs ayer)">
          <MoversList items={sum.topLosers} />
        </Card>
      </section>
    </div>
  );
}

// === Componentes auxiliares ===
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
      <div className="mb-2 text-lg font-semibold text-white">{title}</div>
      {children}
    </div>
  );
}

function Health({ status, onRepair }: { status: any; onRepair: (target: "history" | "state") => void }) {
  if (!status) return <p className="text-sm text-neutral-400">Sin datos de estado.</p>;
  return (
    <div className="text-sm space-y-2">
      {Object.entries(status).map(([key, s]) => (
        <div key={key} className="flex items-center justify-between border-b border-neutral-800 py-1">
          <span>{key}</span>
          <span className={s.parseOk ? "text-emerald-400" : "text-red-400"}>
            {s.parseOk ? "OK" : "Error"}
          </span>
          {!s.parseOk && (
            <button
              onClick={() => onRepair(key.includes("history") ? "history" : "state")}
              className="text-xs bg-neutral-700 hover:bg-neutral-600 rounded px-2 py-0.5"
            >
              Reparar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MoversList({
  items,
  positive,
}: {
  items: { ticker: string; d1pct: number; price: number }[];
  positive?: boolean;
}) {
  if (!items?.length) return <p className="text-sm text-neutral-500">Sin datos.</p>;
  return (
    <ul className="text-sm space-y-1">
      {items.map((m, i) => (
        <li key={i} className="flex justify-between">
          <span>{m.ticker}</span>
          <span className={positive ? "text-emerald-400" : "text-red-400"}>
            {m.d1pct > 0 ? "+" : ""}
            {m.d1pct.toFixed(2)}% ({m.price.toFixed(2)})
          </span>
        </li>
      ))}
    </ul>
  );
}

