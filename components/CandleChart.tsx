// components/CandleChart.tsx
"use client";
import React, { useState, useRef, useEffect } from "react";

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

const fmtPrice = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtTime = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
});

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
  const svgRef = useRef<SVGSVGElement>(null);

  // === Estados principales ===
  const [targetZoom, setTargetZoom] = useState(1);
  const [targetPan, setTargetPan] = useState(0);
  const [zoom, setZoom] = useState(2);
  const [pan, setPan] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);

  // === Crosshair ===
  const [cross, setCross] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // === Interpolación suave ===
  useEffect(() => {
    let anim: number;
    const smooth = () => {
      setZoom((z) => z + (targetZoom - z) * 0.15);
      setPan((p) => p + (targetPan - p) * 0.15);
      anim = requestAnimationFrame(smooth);
    };
    anim = requestAnimationFrame(smooth);
    return () => cancelAnimationFrame(anim);
  }, [targetZoom, targetPan]);

  // === Zoom con la rueda ===
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left - 56;
    const chartW = rect.width - 56 - 10;
    const cursorRatio = Math.max(0, Math.min(1, cursorX / chartW));

    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    setTargetZoom((z) => {
      const newZoom = Math.min(5, Math.max(0.5, z * delta));
      const zoomDiff = newZoom / z;
      setTargetPan((p) => p + (cursorRatio - 0.5) * chartW * (1 - 1 / zoomDiff));
      return newZoom;
    });
  }

  // === Pan con arrastre ===
  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
    setLastX(e.clientX);
  }
  function handleMouseUp() {
    setIsDragging(false);
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (isDragging) {
      const dx = e.clientX - lastX;
      setTargetPan((p) => p - dx);
      setLastX(e.clientX);
    }

    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 56 && x <= width - 10 && y >= 8 && y <= height - 22) {
      setCross({ x, y, visible: true });
    } else {
      setCross((c) => ({ ...c, visible: false }));
    }
  }

  function handleMouseLeave() {
    setIsDragging(false);
    setCross((c) => ({ ...c, visible: false }));
  }

  // === Determinar velas visibles ===
  const visibleCount = Math.max(80, Math.max(4, Math.floor(40 / zoom)));
  const total = candles.length;
  const startIdx = Math.max(0, total - visibleCount - Math.floor(pan / 10));
  const endIdx = Math.min(total, startIdx + visibleCount);
  const data = candles.slice(startIdx, endIdx);

  if (data.length === 0)
    return <div className="text-xs text-neutral-400">Sin datos…</div>;

  // === Layout ===
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
  const bodyW = Math.max(
    candleMinWidth,
    Math.min(rawBodyW, candleMaxWidth, Math.max(0, xStep - 2))
  );

  const yTickVals = Array.from(
    { length: yTicks + 1 },
    (_, i) => min + (i * (max - min)) / yTicks
  );
  const xTickIdxs = Array.from(
    { length: Math.min(xTicks, data.length) },
    (_, i) => Math.round((i * (data.length - 1)) / Math.max(1, xTicks - 1))
  );

  // === Determinar índice más cercano para crosshair ===
  const nearestIndex = cross.visible
    ? Math.max(0, Math.min(data.length - 1, Math.round((cross.x - marginLeft) / xStep)))
    : -1;
  const nearestCandle = nearestIndex >= 0 ? data[nearestIndex] : null;

  // === Render ===
  return (
    <div
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      className="select-none cursor-grab active:cursor-grabbing relative"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label="Gráfico de velas"
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" />

        {/* Ejes y ticks Y */}
        <line
          x1={marginLeft}
          x2={marginLeft}
          y1={marginTop}
          y2={marginTop + chartH}
          stroke="#2a2a2a"
          strokeWidth={1}
        />
        {yTickVals.map((v, i) => {
          const yy = y(v);
          return (
            <g key={`yt-${i}`}>
              <line
                x1={marginLeft}
                x2={marginLeft + chartW}
                y1={yy}
                y2={yy}
                stroke="#262626"
                strokeWidth={1}
              />
              <text
                x={marginLeft - 6}
                y={yy + 3}
                fontSize={10}
                textAnchor="end"
                fill="#9ca3af"
              >
                {fmtPrice.format(v)}
              </text>
            </g>
          );
        })}

        {/* Eje X */}
        <line
          x1={marginLeft}
          x2={marginLeft + chartW}
          y1={marginTop + chartH}
          y2={marginTop + chartH}
          stroke="#2a2a2a"
          strokeWidth={1}
        />

        {/* Ticks X */}
        {xTickIdxs.map((idx, i) => {
          const cx = x(idx);
          const ts = new Date(data[idx].time);
          return (
            <g key={`xt-${i}`}>
              <line
                x1={cx}
                x2={cx}
                y1={marginTop + chartH}
                y2={marginTop + chartH + 4}
                stroke="#2a2a"
                strokeWidth={1}
              />
              <text
                x={cx}
                y={height - 6}
                fontSize={10}
                textAnchor="middle"
                fill="#9ca3af"
              >
                {fmtTime.format(ts)}
              </text>
            </g>
          );
        })}

        {/* Velas */}
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
	  const isLast = i === data.length - 1;
          return (
            <g key={c.time} className={isLast ? "animate-pulse-slow" : ""}>
              <title>{`O:${c.open} H:${c.high} L:${c.low} C:${c.close} • ${fmtTime.format(
                new Date(c.time)
              )}`}</title>
              <line x1={cx} x2={cx} y1={h} y2={l} stroke={color} strokeWidth={1} />
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={color}
                opacity={isLast ? 0.85 : 1}
              />
            </g>
          );
        })}

        {/* === Crosshair === */}
        {cross.visible && nearestCandle && (
          <>
            {/* Línea vertical */}
            <line
              x1={x(nearestIndex)}
              x2={x(nearestIndex)}
              y1={marginTop}
              y2={marginTop + chartH}
              stroke="#888"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            {/* Etiqueta de precio (izquierda) */}
            <rect
              x={0}
              y={y(nearestCandle.close) - 8}
              width={marginLeft - 4}
              height={16}
              fill="#1a1a1a"
            />
            <text
              x={marginLeft - 8}
              y={y(nearestCandle.close) + 4}
              fontSize={10}
              textAnchor="end"
              fill="#fff"
            >
              {fmtPrice.format(nearestCandle.close)}
            </text>
            {/* Etiqueta de hora (abajo) */}
            <rect
              x={x(nearestIndex) - 24}
              y={height - marginBottom + 4}
              width={48}
              height={14}
              fill="#1a1a1a"
              rx={3}
            />
            <text
              x={x(nearestIndex)}
              y={height - marginBottom + 15}
              fontSize={10}
              textAnchor="middle"
              fill="#fff"
            >
              {fmtTime.format(new Date(nearestCandle.time))}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
