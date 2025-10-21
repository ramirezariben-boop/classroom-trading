// app/admin/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';

type HealthMap = Record<string, {
  exists: boolean;
  size: number;
  mtime: string | null;
  parseOk: boolean;
  error?: string;
}>;

type Summary = {
  ok: boolean;
  lastDate: string | null;
  lastCount: number;
  topGainers: { ticker:string; d1pct:number; price:number }[];
  topLosers:  { ticker:string; d1pct:number; price:number }[];
  recent: { date:string; count:number }[];
  lastClose: Record<string, number>;
  health: HealthMap;
};

export default function AdminDashboard() {
  const [sum, setSum] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // cargar summary
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/summary', { cache: 'no-store' });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Error summary');
        setSum(json);
      } catch (e:any) {
        setErr(e.message);
      }
    })();
  }, []);

  // ejecutar cierre
  const runDaily = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/run-daily', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error al ejecutar cierre');
      // refrescamos summary para ver cambios
      const res2 = await fetch('/api/admin/summary', { cache: 'no-store' });
      const j2 = await res2.json();
      if (j2.ok) setSum(j2);
      setMsg('Cierre ejecutado correctamente.');
    } catch (e:any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // re-snapshot sin recálculo
  const resnapshot = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/resnapshot', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'No se pudo resnapshotear');
      const res2 = await fetch('/api/admin/summary', { cache: 'no-store' });
      const j2 = await res2.json();
      if (j2.ok) setSum(j2);
      setMsg(`Guardado en historial: ${json.date}`);
    } catch (e:any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // reparar archivos
  const repair = useCallback(async (target: "history"|"state") => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/repair', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ target })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'No se pudo reparar');
      const res2 = await fetch('/api/admin/summary', { cache: 'no-store' });
      const j2 = await res2.json();
      if (j2.ok) setSum(j2);
      setMsg(`Reparado: ${json.repaired}`);
    } catch (e:any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const lastRows = useMemo(() => {
    if (!sum) return [];
    return Object.entries(sum.lastClose)
      .map(([ticker, price]) => ({ ticker, price }))
      .sort((a,b) => a.ticker.localeCompare(b.ticker));
  }, [sum]);

  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!sum) return <div className="p-6">Cargando dashboard…</div>;

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard — Admin</h1>
          <div className="text-sm text-gray-600">
            Último cierre: <b>{sum.lastDate ?? '—'}</b> · Activos: <b>{sum.lastCount}</b>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runDaily}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-white ${busy ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {busy ? 'Ejecutando…' : 'Ejecutar cierre'}
          </button>

          <button
            onClick={resnapshot}
            disabled={busy}
            title="Forzar guardar state_runtime.json en history.json para la fecha actual (o daily.date) — no recalcula precios"
            className={`rounded-lg px-4 py-2 border ${busy ? 'text-gray-400 border-gray-300' : 'text-gray-700 border-gray-400 hover:bg-gray-50'}`}
          >
            Recalcular cierre de hoy (sin recálculo)
          </button>

          {msg && <span className="text-sm text-gray-700">{msg}</span>}
        </div>
      </header>

      {/* Salud del sistema */}
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

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Últimos 7 cierres">
          <div className="space-y-2">
            {sum.recent.length === 0 && <div className="text-sm text-gray-500">Sin datos todavía.</div>}
            {sum.recent.map(r => (
              <div key={r.date} className="flex items-center justify-between text-sm">
                <span>{r.date}</span>
                <span className="text-gray-600">{r.count} activos</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Último cierre — tabla rápida">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1 pr-2">Ticker</th>
                  <th className="py-1">Precio</th>
                </tr>
              </thead>
              <tbody>
                {lastRows.map(r => (
                  <tr key={r.ticker} className="border-t">
                    <td className="py-1 pr-2">{r.ticker}</td>
                    <td className="py-1">{format(r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="mb-2 text-lg font-semibold">{title}</div>
      {children}
    </div>
  );
}

function MoversList({ items, positive=false }: { items: {ticker:string; d1pct:number; price:number}[], positive?: boolean }) {
  if (!items || items.length === 0) return <div className="text-sm text-gray-500">Sin datos.</div>;
  return (
    <div className="space-y-2">
      {items.map((m) => {
        const up = m.d1pct >= 0;
        return (
          <div key={m.ticker} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-white text-xs ${up ? 'bg-emerald-500' : 'bg-red-500'}`}>
                {up ? '↑' : '↓'}
              </span>
              <span className="font-medium">{m.ticker}</span>
            </div>
            <div className={up ? 'text-emerald-600' : 'text-red-600'}>
              {(m.d1pct * 100).toFixed(2)}% · {format(m.price)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function format(n: number) {
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (n < 2) opts.maximumFractionDigits = 3;
  return new Intl.NumberFormat('es-MX', opts).format(n);
}

/* ====== Salud del sistema ====== */
function Health({ status, onRepair }: { status: HealthMap, onRepair: (t: "history"|"state") => void }) {
  if (!status) return <div className="text-sm text-gray-500">Sin datos.</div>;

  const rows = [
    { key: "config",  label: "config_static.json", repairable: false as const },
    { key: "daily",   label: "daily_input.json",   repairable: false as const },
    { key: "state",   label: "state_runtime.json", repairable: true  as const, repairTarget: "state" as const },
    { key: "history", label: "history.json",       repairable: true  as const, repairTarget: "history" as const },
  ] as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1 pr-2">Archivo</th>
            <th className="py-1 pr-2">Estado</th>
            <th className="py-1 pr-2">Tamaño</th>
            <th className="py-1 pr-2">Última modificación</th>
            <th className="py-1 pr-2">Detalle</th>
            <th className="py-1 pr-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const s = status[r.key];
            const sev = severity(s);
            const canRepair = r.repairable && sev !== "ok";
            return (
              <tr key={r.key} className="border-t">
                <td className="py-1 pr-2">{r.label}</td>
                <td className="py-1 pr-2">
                  <Badge severity={sev}>
                    {sev === "ok" ? "OK" : sev === "warn" ? "Advertencia" : "Error"}
                  </Badge>
                </td>
                <td className="py-1 pr-2">{s?.exists ? bytes(s.size) : "—"}</td>
                <td className="py-1 pr-2">{s?.exists && s?.mtime ? s.mtime.replace("T", " ").slice(0, 19) : "—"}</td>
                <td className="py-1">
                  {(!s?.exists && "No existe") || (!s?.parseOk && (s?.error || "JSON no válido")) || "—"}
                </td>
                <td className="py-1 pr-2">
                  {canRepair ? (
                    <button
                      onClick={() => onRepair(r.repairTarget!)}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      Reparar
                    </button>
                  ) : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function severity(s?: { exists:boolean; parseOk:boolean }) : "ok"|"warn"|"error" {
  if (!s) return "error";
  if (!s.exists) return "error";
  if (!s.parseOk) return "warn";
  return "ok";
}

function Badge({ severity, children }: { severity: "ok"|"warn"|"error"; children: React.ReactNode }) {
  const cls = severity === "ok"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : severity === "warn"
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-red-100 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] font-medium ${cls}`}>
      <Dot severity={severity} />
      {children}
    </span>
  );
}

function Dot({ severity }: { severity: "ok"|"warn"|"error" }) {
  const color = severity === "ok" ? "bg-emerald-500"
              : severity === "warn" ? "bg-amber-500"
              : "bg-red-500";
  return <span className={`mr-1 inline-block h-[8px] w-[8px] rounded-full ${color}`} />;
}

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}
