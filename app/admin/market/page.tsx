// app/admin/market/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';

type Config = any;
type State = { last_close: Record<string, number> };

export default function MarketPage() {
  const [data, setData] = useState<{ config: Config; state: State } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'API error');
        setData({ config: json.config, state: json.state });
      } catch (e:any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const { config, state } = data;

    // helpers para buscar base por tipo
    const waehrungenKeys = new Set(Object.keys(config.waehrungen || {}));
    const zehntelKeys    = new Set(Object.keys(config.zehntel || {}));
    const aktienKeys     = new Set(Object.keys(config.aktien || {}).filter(k => k !== 'defaults'));
    const materialesBases: Record<string, number> = {};

    for (const cat of ['educativos', 'lectura', 'ocio']) {
      if (!config.materiales?.[cat]) continue;
      for (const [name, conf] of Object.entries<any>(config.materiales[cat])) {
        materialesBases[name] = conf.base_price;
      }
    }

    const baseAktie = config.aktien?.defaults?.base_price ?? 20;
    const decimaBase = config.decima_real?.anchor_base ?? 15;

    const arr: { ticker: string; price: number; base: number; pct: number }[] = [];

    for (const [ticker, price] of Object.entries<number>(state.last_close || {})) {
      let base = 0;

      if (waehrungenKeys.has(ticker)) {
        base = config.waehrungen[ticker].base_price;
      } else if (zehntelKeys.has(ticker)) {
        base = config.zehntel[ticker].base_price;
      } else if (ticker === 'DECIMA_REAL') {
        base = decimaBase;
      } else if (aktienKeys.has(ticker)) {
        base = baseAktie;
      } else if (ticker in materialesBases) {
        base = materialesBases[ticker];
      } else {
        // fallback por si aparece algo nuevo
        base = price;
      }

      const pct = base > 0 ? (price / base - 1) : 0;
      arr.push({ ticker, price, base, pct });
    }

    // ordenar por categoría visual: monedas, acciones, bonos, decima, materiales
    const orderScore = (t: string) => {
      if (waehrungenKeys.has(t)) return 0;
      if (aktienKeys.has(t)) return 1;
      if (zehntelKeys.has(t)) return 2;
      if (t === 'DECIMA_REAL') return 3;
      return 4;
    };

    return arr.sort((a, b) => {
      const s = orderScore(a.ticker) - orderScore(b.ticker);
      if (s !== 0) return s;
      return a.ticker.localeCompare(b.ticker);
    });
  }, [data]);

  if (loading) return <div className="p-6">Cargando mercado…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!data) return null;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mercado — Cierres actuales</h1>
        <RunDailyButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map(({ ticker, price, base, pct }) => {
          const up = pct >= 0;
          const pctStr = (pct * 100).toFixed(2) + '%';
          return (
            <div key={ticker} className="rounded-2xl border p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{ticker}</span>
                <span className={`text-sm ${up ? 'text-green-600' : 'text-red-600'}`}>
                  {up ? '↑' : '↓'} {pctStr}
                </span>
              </div>
              <div className="mt-2 text-2xl font-semibold">{format(price)}</div>
              <div className="text-xs text-gray-500">Base: {format(base)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function format(n: number) {
  // precios pequeños (monedas) con 3 dec, otros con 2
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (n < 2) opts.maximumFractionDigits = 3;
  return new Intl.NumberFormat('es-MX', opts).format(n);
}

// Botón para ejecutar el cierre desde la UI
function RunDailyButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/run-daily', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error al actualizar');
      setMsg('Cierre ejecutado. Recarga la página para ver los nuevos precios.');
    } catch (e:any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className={`rounded-lg px-4 py-2 text-white ${busy ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {busy ? 'Actualizando…' : 'Ejecutar cierre'}
      </button>
      {msg && <span className="text-sm text-gray-700">{msg}</span>}
    </div>
  );
}
