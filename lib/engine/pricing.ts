// lib/engine/pricing.ts
import fs from "fs";
import path from "path";

/* =========================
   Rutas de archivos + IO
   ========================= */
const DATA_DIR    = path.resolve(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "config_static.json");
const DAILY_PATH  = path.join(DATA_DIR, "daily_input.json");
const STATE_PATH  = path.join(DATA_DIR, "state_runtime.json");
const HISTORY_PATH= path.join(DATA_DIR, "history.json");

function atomicWrite(filePath: string, data: string) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp`);
  fs.writeFileSync(tmp, data, "utf-8");
  fs.renameSync(tmp, filePath);
}
function readJSON<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJSON<T>(p: string, data: T) {
  atomicWrite(p, JSON.stringify(data, null, 2));
}
function readHistory(): Array<{ date: string; last_close: Record<string, number> }> {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
}
function writeHistory(list: Array<{ date: string; last_close: Record<string, number> }>) {
  atomicWrite(HISTORY_PATH, JSON.stringify(list, null, 2));
}

/* =========================
   Tipos
   ========================= */
type Dict<T = any> = Record<string, T>;

type MacroWeights = Record<
  "pi" | "C" | "V",
  Partial<Record<"P"|"Q"|"E"|"X"|"R"|"VY"|"EX"|"A"|"IS", number>>
>;

type MacroApply = {
  waehrungen?: { pi?: number; C?: number; V?: number };
  aktien_default?: { pi?: number; C?: number; V?: number };
};

type Config = {
  globals: {
    ema_alpha: number;
    daily_clamps: {
      waehrungen: number; zehntel: number; materiales: number; aktien: number; decima_real: number;
    };
    exam: { d0: number; k: number; clamp_days: number };
  };
  medias: {
    sabado:  { P:number; Q:number; E:number; X:number; D_dec:number; D_mat:number; A:number; };
    domingo: { P:number; Q:number; E:number; X:number; D_dec:number; D_mat:number; A:number; };
    media_global: { R:number; VY:number; }
  };
  macro_weights?: MacroWeights;
  macro_apply?: MacroApply;
  waehrungen: Dict<{
    base_price:number; m:number; clamp:number; ema_alpha:number;
    nudges?: { X?:number; IS?:number }
  }>;
  zehntel: Dict<{ base_price:number; weights: { D_dec:number; E:number; EX:number; P_inv:number }; clamp:number }>;
  decima_real: { anchor_base:number; follow_rule:{ multiplier_on_ZHN:number; min_base:number; daily_clamp:number } };
  materiales: {
    educativos: Dict<{ base_price:number; weights: Dict<number>; clamp:number }>;
    lectura:   Dict<{ base_price:number; weights: Dict<number>; clamp:number }>;
    ocio:      Dict<{ base_price:number; weights: Dict<number>; clamp:number }>;
  };
  aktien: {
    defaults: { float:number; base_price:number; F_sensitivity:number; clamp:number; ema_alpha:number;
      intraday:{ slippage_k:number; breaker:number } };
    RFTMXP: { global_weights:{ pi:number; C:number; V:number; EX:number } };
    DSGMXP: { global_weights:{ pi:number; C:number; V:number; EX:number } };
    BAUMXP: { global_weights:{ pi:number; C:number; V:number; EX:number } };
  };
  werte: Dict<any>;
};

type Daily = {
  date: string;
  youtube: { likes:number|null; vistas:number|null };
  empresas: { RFTMXP:{F:number|null}; BAUMXP:{F:number|null}; DSGMXP:{F:number|null} };
  grupos: {
    sabado:  { waehrung_ticker:string; examen:{dias_restantes:number|null};
               participacion:{alumnos_presentes:number|null; puntos_totales:number|null};
               evaluaciones:{promedio_hoy:number|null}; tareas_extra:{total_hoy:number|null}; asistencia:number|null; };
    domingo: { waehrung_ticker:string; examen:{dias_restantes:number|null};
               participacion:{alumnos_presentes:number|null; puntos_totales:number|null};
               evaluaciones:{promedio_hoy:number|null}; tareas_extra:{total_hoy:number|null}; asistencia:number|null; };
  };
  demanda: { decimas:number|null; materiales:number|null; gramm:number|null; literatur:number|null; krimi:number|null; hoer:number|null; komm:number|null; };
  interaccion_social: number;
};

type State = {
  last_close: Dict<number>;
  ema_buffers?: Dict<any>;
};

/* =========================
   Helpers matemáticos
   ========================= */
const clamp = (x:number, lo:number, hi:number) => Math.min(hi, Math.max(lo, x));
const clampPctFromBase = (prev:number, next:number, pct:number) => {
  const hi = prev * (1 + pct);
  const lo = prev * (1 - pct);
  return clamp(next, lo, hi);
};
const ema = (prev:number, target:number, alpha:number) => prev + alpha*(target - prev);

// EX nerviosa (logística)
function EX_from_days(d:number, d0:number, k:number, clampDays:number) {
  if (d >= clampDays) return 0;
  if (d <= 1) return 1;
  return 1 / (1 + Math.exp(k * (d - d0)));
}

/* =========================
   Normalizaciones
   ========================= */
function avgMedia(config: Config, key: keyof Config["medias"]["sabado"]) {
  const a = config.medias.sabado[key] as number;
  const b = config.medias.domingo[key] as number;
  return (a + b) / 2;
}
function normVsMedia(value:number|null|undefined, media:number) {
  if (value == null) return 0.5; // neutral
  return clamp(value / (2*media), 0, 1);
}

/* =========================
   Macro (π, C, V)
   ========================= */
function computeMacro(daily: Daily, cfg: Config) {
  const mSab = cfg.medias.sabado, mDom = cfg.medias.domingo, mG = cfg.medias.media_global;

  const getP = () => {
    const pSab = (daily.grupos.sabado.participacion.puntos_totales ?? 0) / Math.max(1, (daily.grupos.sabado.participacion.alumnos_presentes ?? 1));
    const pDom = (daily.grupos.domingo.participacion.puntos_totales ?? 0) / Math.max(1, (daily.grupos.domingo.participacion.alumnos_presentes ?? 1));
    return (pSab + pDom) / 2;
  };

  const Pn  = normVsMedia(getP(), (mSab.P + mDom.P)/2);
  const Qn  = normVsMedia((mSab.Q + mDom.Q)/2, (mSab.Q + mDom.Q)/2); // neutral si no hay Q diaria
  const En  = normVsMedia(
    (daily.grupos.sabado.evaluaciones.promedio_hoy ?? daily.grupos.domingo.evaluaciones.promedio_hoy) ?? ((mSab.E + mDom.E)/2),
    (mSab.E + mDom.E)/2
  );

  const Xtoday = ((daily.grupos.sabado.tareas_extra.total_hoy ?? 0) + (daily.grupos.domingo.tareas_extra.total_hoy ?? 0)) / 2;
  const Xn  = normVsMedia(Xtoday, (mSab.X + mDom.X)/2);

  const ratio = (daily.youtube.likes && daily.youtube.vistas && daily.youtube.vistas > 0)
    ? daily.youtube.likes / daily.youtube.vistas
    : null;
  const Rn  = normVsMedia(ratio, mG.R);
  const VYn = normVsMedia(daily.youtube.vistas ?? null, mG.VY);

  const EXsab = EX_from_days(daily.grupos.sabado.examen.dias_restantes ?? cfg.globals.exam.clamp_days, cfg.globals.exam.d0, cfg.globals.exam.k, cfg.globals.exam.clamp_days);
  const EXdom = EX_from_days(daily.grupos.domingo.examen.dias_restantes ?? cfg.globals.exam.clamp_days, cfg.globals.exam.d0, cfg.globals.exam.k, cfg.globals.exam.clamp_days);
  const EXn = Math.max(EXsab, EXdom);

  const An  = normVsMedia(((daily.grupos.sabado.asistencia ?? mSab.A) + (daily.grupos.domingo.asistencia ?? mDom.A))/2, (mSab.A + mDom.A)/2);
  const ISn = clamp(daily.interaccion_social ?? 0, 0, 1);

  const z = { P:Pn, Q:Qn, E:En, X:Xn, R:Rn, VY:VYn, EX:EXn, A:An, IS:ISn };

  function sumWeights(kind: "pi"|"C"|"V") {
    const W = (cfg.macro_weights?.[kind]) ?? {};
    let acc = 0;
    for (const k in W) acc += (W as any)[k] * ((z as any)[k] - 0.5);
    return clamp(0.5 + acc, 0, 1);
  }

  const pi = sumWeights("pi");
  const C  = sumWeights("C");
  const V  = sumWeights("V");

  return { pi, C, V, EXsab, EXdom };
}

/* =========================
   Währungen
   ========================= */
function updateWaehrung(
  ticker:string,
  group: Daily["grupos"]["sabado"],
  mediasP:number,
  last:number,
  cfg:Config,
  macro:{pi:number; C:number; V:number}
) {
  const base = cfg.waehrungen[ticker]?.base_price ?? 1.0;
  const clampPct = cfg.waehrungen[ticker]?.clamp ?? cfg.globals.daily_clamps.waehrungen;
  const alpha = cfg.waehrungen[ticker]?.ema_alpha ?? cfg.globals.ema_alpha;

  const prev = (last ?? base);

  const pts = group.participacion.puntos_totales ?? 0;
  const alumnos = group.participacion.alumnos_presentes ?? 1;
  const p_t = pts / Math.max(1, alumnos);
  const mu = mediasP;
  const r = mu > 0 ? (p_t / mu) : 1;

  // Δ = m*(1-r)
  const m = 0.5;
  const delta = m * (1 - r);
  let raw = prev * (1 + delta);

  // Macro suave
  const apply = cfg.macro_apply?.waehrungen ?? { pi:-0.10, C:0.10, V:-0.05 };
  const G = 1 + (apply.pi ?? 0)*(macro.pi-0.5) + (apply.C ?? 0)*(macro.C-0.5) + (apply.V ?? 0)*(macro.V-0.5);
  raw *= G;

  const afterEma = ema(prev, raw, alpha);
  return clampPctFromBase(prev, afterEma, clampPct);
}

/* =========================
   Aktien
   ========================= */
function updateAktie(
  ticker:string,
  F:number|null,
  last:number,
  cfg:Config,
  EX_company:number,
  macro:{pi:number; C:number; V:number}
) {
  const def = cfg.aktien.defaults;
  const prev = last ?? def.base_price;
  const clampPct = def.clamp;
  const alpha = def.ema_alpha;

  const deltaF = ((F ?? 0.5) - 0.5); // ±10% por 0.1
  const gw = (cfg.aktien as any)[ticker]?.global_weights;
  const gEX = gw?.EX ?? 0;

  const applyDefault = cfg.macro_apply?.aktien_default ?? { pi:-0.05, C:0.08, V:-0.05 };
  const Gmacro = 1 + (applyDefault.pi ?? 0)*(macro.pi-0.5) + (applyDefault.C ?? 0)*(macro.C-0.5) + (applyDefault.V ?? 0)*(macro.V-0.5);
  const Gex    = 1 + gEX * (EX_company - 0.5);

  const raw = prev * (1 + deltaF) * Gmacro * Gex;
  const afterEma = ema(prev, raw, alpha);
  return clampPctFromBase(prev, afterEma, clampPct);
}

/* =========================
   Zehntel
   ========================= */
function updateZehntel(ticker:string, last:number, cfg:Config, daily:Daily) {
  const zconf = cfg.zehntel[ticker];
  const prev = last ?? zconf.base_price;
  const clampPct = zconf.clamp;

  const Ddec_media = avgMedia(cfg, "D_dec");
  const Em_media   = avgMedia(cfg, "E");
  const P_media    = avgMedia(cfg, "P");

  const ddec = normVsMedia(daily.demanda.decimas, Ddec_media);
  const e    = normVsMedia(
    (daily.grupos.sabado.evaluaciones.promedio_hoy ?? daily.grupos.domingo.evaluaciones.promedio_hoy),
    Em_media
  );

  const exSab = daily.grupos.sabado.examen.dias_restantes ?? cfg.globals.exam.clamp_days;
  const exDom = daily.grupos.domingo.examen.dias_restantes ?? cfg.globals.exam.clamp_days;
  const EXsab = EX_from_days(exSab, cfg.globals.exam.d0, cfg.globals.exam.k, cfg.globals.exam.clamp_days);
  const EXdom = EX_from_days(exDom, cfg.globals.exam.d0, cfg.globals.exam.k, cfg.globals.exam.clamp_days);
  const EX = Math.max(EXsab, EXdom);

  const pSab = daily.grupos.sabado.participacion;
  const pDom = daily.grupos.domingo.participacion;
  const pSabVal = (pSab.puntos_totales ?? 0) / Math.max(1, (pSab.alumnos_presentes ?? 1));
  const pDomVal = (pDom.puntos_totales ?? 0) / Math.max(1, (pDom.alumnos_presentes ?? 1));
  const Ptoday = (pSabVal + pDomVal) / 2;
  const Pnorm  = normVsMedia(Ptoday, P_media);
  const P_inv  = 1 - Pnorm; // baja participación → sube bono

  const w = zconf.weights;
  const deltaPct =
    (w.D_dec ?? 0)*(ddec - 0.5) +
    (w.E    ?? 0)*(e    - 0.5) +
    (w.EX   ?? 0)*(EX   - 0.5) +
    (w.P_inv?? 0)*(P_inv- 0.5);

  const raw = prev * (1 + deltaPct);
  return clampPctFromBase(prev, raw, clampPct);
}

/* =========================
   Décima real
   ========================= */
function updateDecimaReal(last:number, zhnPrice:number, cfg:Config) {
  const prev = last ?? cfg.decima_real.anchor_base;
  const { multiplier_on_ZHN, min_base, daily_clamp } = cfg.decima_real.follow_rule;
  const target = Math.max(min_base, multiplier_on_ZHN * zhnPrice);
  return clampPctFromBase(prev, target, daily_clamp);
}

/* =========================
   Materiales
   ========================= */
function updateMaterialItem(
  name:string,
  catConf: { base_price:number; weights: Dict<number>; clamp:number },
  last:number|undefined,
  cfg:Config,
  daily:Daily
){
  const prev = last ?? catConf.base_price;
  const clampPct = catConf.clamp;

  const get = (k:string):number => {
    switch (k) {
      case "D_gramm": return normVsMedia(daily.demanda.gramm, avgMedia(cfg,"D_mat"));
      case "D_mat":   return normVsMedia(daily.demanda.materiales, avgMedia(cfg,"D_mat"));
      case "EX": {
        const exSab = daily.grupos.sabado.examen.dias_restantes ?? cfg.globals.exam.clamp_days;
        const exDom = daily.grupos.domingo.examen.dias_restantes ?? cfg.globals.exam.clamp_days;
        const EXsab = EX_from_days(exSab, cfg.globals.exam.d0, cfg.globals.exam.k, cfg.globals.exam.clamp_days);
        const EXdom = EX_from_days(exDom, cfg.globals.exam.d0, cfg.globals.exam.k, cfg.globals.exam.clamp_days);
        return Math.max(EXsab, EXdom);
      }
      case "R": {
        const ratio = (daily.youtube.likes && daily.youtube.vistas && daily.youtube.vistas > 0)
          ? daily.youtube.likes / daily.youtube.vistas
          : null;
        return normVsMedia(ratio, cfg.medias.media_global.R);
      }
      case "VY": return normVsMedia(daily.youtube.vistas ?? null, cfg.medias.media_global.VY);
      case "D_krimi": return normVsMedia(daily.demanda.krimi, avgMedia(cfg,"D_mat"));
      case "D_hoer":  return normVsMedia(daily.demanda.hoer,  avgMedia(cfg,"D_mat"));
      case "D_komm":  return normVsMedia(daily.demanda.komm,  avgMedia(cfg,"D_mat"));
      default: return 0.5;
    }
  };

  let delta = 0;
  for (const [k, w] of Object.entries(catConf.weights)) {
    delta += (w as number) * (get(k) - 0.5);
  }

  const raw = prev * (1 + delta);
  return clampPctFromBase(prev, raw, clampPct);
}

/* =========================
   Main
   ========================= */
export function runDailyUpdate() {
  const cfg   = readJSON<Config>(CONFIG_PATH);
  const daily = readJSON<Daily>(DAILY_PATH);
  const st    = fs.existsSync(STATE_PATH) ? readJSON<State>(STATE_PATH) : { last_close: {} };

  const next: State = { last_close: { ...st.last_close }, ema_buffers: st.ema_buffers ?? {} };

  // π / C / V + EX sab/dom
  const macro = computeMacro(daily, cfg);
  const EXsab = macro.EXsab, EXdom = macro.EXdom;

  // Währungen
  const muSabP = cfg.medias.sabado.P;
  const muDomP = cfg.medias.domingo.P;
  const samTicker = daily.grupos.sabado.waehrung_ticker;
  const sonTicker = daily.grupos.domingo.waehrung_ticker;

  next.last_close[samTicker] = updateWaehrung(samTicker, daily.grupos.sabado,  muSabP, st.last_close[samTicker], cfg, macro);
  next.last_close[sonTicker] = updateWaehrung(sonTicker, daily.grupos.domingo, muDomP, st.last_close[sonTicker], cfg, macro);

  // Aktien (con macro y EX diferenciado por empresa)
  next.last_close["RFTMXP"] = updateAktie("RFTMXP", daily.empresas.RFTMXP.F, st.last_close["RFTMXP"], cfg, EXsab,                     macro);
  next.last_close["DSGMXP"] = updateAktie("DSGMXP", daily.empresas.DSGMXP.F, st.last_close["DSGMXP"], cfg, Math.max(EXsab, EXdom)*0.7, macro);
  next.last_close["BAUMXP"] = updateAktie("BAUMXP", daily.empresas.BAUMXP.F, st.last_close["BAUMXP"], cfg, Math.max(EXsab, EXdom)*0.3, macro);

  // Zehntel
  next.last_close["ZHNMXP1"] = updateZehntel("ZHNMXP1", st.last_close["ZHNMXP1"], cfg, daily);
  next.last_close["ZHNMXP2"] = updateZehntel("ZHNMXP2", st.last_close["ZHNMXP2"], cfg, daily);

  // Décima real (sigue a la mayor ZHN con ancla 15 y banda ±10%)
  const zhnRef = Math.max(next.last_close["ZHNMXP1"] ?? 0, next.last_close["ZHNMXP2"] ?? 0);
  next.last_close["DECIMA_REAL"] = updateDecimaReal(st.last_close["DECIMA_REAL"], zhnRef, cfg);

  // Materiales / Libros
  const mat = cfg.materiales;
  for (const [k, conf] of Object.entries(mat.educativos)) {
    next.last_close[k] = updateMaterialItem(k, conf as any, st.last_close[k], cfg, daily);
  }
  for (const [k, conf] of Object.entries(mat.lectura)) {
    next.last_close[k] = updateMaterialItem(k, conf as any, st.last_close[k], cfg, daily);
  }
  for (const [k, conf] of Object.entries(mat.ocio)) {
    next.last_close[k] = updateMaterialItem(k, conf as any, st.last_close[k], cfg, daily);
  }

  // Persistir estado
  writeJSON<State>(STATE_PATH, next);

  // Historial: upsert por fecha
  const history = readHistory();
  const today = (daily.date ?? new Date().toISOString().slice(0,10));
  const idx = history.findIndex(h => h.date === today);
  const snapshot = { date: today, last_close: next.last_close };
  if (idx >= 0) history[idx] = snapshot; else history.push(snapshot);
  while (history.length > 180) history.shift();
  writeHistory(history);

  return next;
}
