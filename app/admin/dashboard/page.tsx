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

// 🧩 Componente interno para importar CSV
function ImportCsv() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al importar CSV");
      setResult(`✅ ${json.updated} actualizados · ${json.skipped} omitidos · ${json.notFound} no encontrados`);
    } catch (err: any) {
      setResult(`❌ ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-6 p-4 rounded-xl border border-neutral-800 bg-neutral-900">
      <h2 className="text-lg font-semibold mb-2">📥 Importar puntos desde CSV</h2>
      <form onSubmit={handleImport} className="flex flex-col gap-2">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm text-neutral-400"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {uploading ? "Importando..." : "Subir e importar CSV"}
        </button>
      </form>
      {result && <p className="text-sm mt-2">{result}</p>}
      <p className="text-xs text-neutral-500 mt-1">
        El archivo debe tener formato: <code>id,points</code>.  
        Puedes usar valores como <code>+5</code> o <code>-10</code> para sumar/restar.
      </p>
    </div>
  );
}

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

      {/* 🔽 Importador de CSV */}
      <ImportCsv />
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

// (resto de funciones Health, severity, Badge, etc. sin cambios)
