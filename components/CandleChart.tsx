// components/CandleChart.tsx
"use client";
import React from "react";

export type Candle = { time: number; open: number; high: number; low: number; close: number };

type Props = {
  candles: Candle[];
  width?: number;
  height?: number;
  bodyWidthRatio?: number;
  candleMinWidth?: number;
  candleMaxWidth?: number;
  yTicks?: number;
  xTicks?: number;
};

const fmtPrice = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" });

export default function CandleChart({
  candles,
  width = 360,
  height = 250,
  bodyWidthRatio = 0.45,
  candleMinWidth = 1.5,
  candleMaxWidth = 10,
  yTicks = 4,
  xTicks = 5,
}: Props) {
  const data = candles.slice(-60);
  if (data.length === 0) return <div className="text-xs text-neutral-400">Sin datos…</div>;

  const marginLeft = 56;
  const marginBottom = 22;
  const marginTop = 8;
  const marginRight = 10;

  const chartW = width - marginLeft - marginRight;
  const chartH = height - marginTop - marginBottom;

  const min = Math.min(...data.map((c) => c.low));
  const max = Math.max(...data.map((c) => c.high));
  const denom = max - min || 1;

  const xStep = chartW / Math.max(1, data.length - 1);
  const x = (i: number) => marginLeft + i * xStep;
  const y = (v: number) => marginTop + (max - v) * (chartH / denom);

  const rawBodyW = xStep * bodyWidthRatio;
  const bodyW = Math.max(candleMinWidth, Math.min(rawBodyW, candleMaxWidth, Math.max(0, xStep - 2)));

  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => min + (i * (max - min)) / yTicks);
  const xTickIdxs = Array.from({ length: Math.min(xTicks, data.length) }, (_, i) =>
    Math.round((i * (data.length - 1)) / Math.max(1, xTicks - 1))
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      role="img"
      aria-label="Gráfico de velas"
    >
      <rect x={0} y={0} width={width} height={height} fill="transparent" />

      <line x1={marginLeft} x2={marginLeft} y1={marginTop} y2={marginTop + chartH} stroke="#2a2a2a" strokeWidth={1} />
      {yTickVals.map((v, i) => {
        const yy = y(v);
        return (
          <g key={`yt-${i}`}>
            <line x1={marginLeft} x2={marginLeft + chartW} y1={yy} y2={yy} stroke="#262626" strokeWidth={1} />
            <text x={marginLeft - 6} y={yy + 3} fontSize={10} textAnchor="end" fill="#9ca3af">
              {fmtPrice.format(v)}
            </text>
          </g>
        );
      })}

      <line x1={marginLeft} x2={marginLeft + chartW} y1={marginTop + chartH} y2={marginTop + chartH} stroke="#2a2a2a" strokeWidth={1} />
      {xTickIdxs.map((idx, i) => {
        const cx = x(idx);
        const ts = new Date(data[idx].time);
        return (
          <g key={`xt-${i}`}>
            <line x1={cx} x2={cx} y1={marginTop + chartH} y2={marginTop + chartH + 4} stroke="#2a2a" strokeWidth={1} />
            <text x={cx} y={height - 6} fontSize={10} textAnchor="middle" fill="#9ca3af">
              {fmtTime.format(ts)}
            </text>
          </g>
        );
      })}

      {data.map((c, i) => {
        const cx = x(i);
        const o = y(c.open);
        const h = y(c.high);
        const l = y(c.low);
        const cl = y(c.close);
        const up = c.close >= c.open;
        const bodyTop = up ? cl : o;
        const bodyBottom = up ? o : cl;
        const bodyH = Math.max(1, bodyBottom - bodyTop);
        const color = up ? "#16a34a" : "#dc2626";
        return (
          <g key={c.time}>
            <title>{`O:${c.open} H:${c.high} L:${c.low} C:${c.close} • ${fmtTime.format(new Date(c.time))}`}</title>
            <line x1={cx} x2={cx} y1={h} y2={l} stroke={color} strokeWidth={1} />
            <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}