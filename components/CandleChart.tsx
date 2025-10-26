"use client";
import React, { useState, useRef, useEffect } from "react";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

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
  width = 1000,
  height = 360,
  bodyWidthRatio = 0.45,
  candleMinWidth = 2,
  candleMaxWidth = 12,
  yTicks = 4,
  xTicks = 6,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // === Estados de interacción ===
  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);

  // === Crosshair ===
  const [cross, setCross] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // === Validación de datos ===
  if (!candles || candles.length === 0)
    return <div className="text-xs text-neutral-400">Sin datos…</div>;

  // === Layout básico ===
  const marginLeft = 56;
  const marginBottom = 22;
  const marginTop = 8;
  const marginRight = 10;
  const chartW = width - marginLeft - marginRight;
  const chartH = height - marginTop - marginBottom;

  // === Escala automática del rango visible ===
  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const min = Math.min(...lows) * 0.999;
  const max = Math.max(...highs) * 1.001;
  const denom = max - min || 1;

  const xStep = chartW / Math.max(1, candles.length - 1);
  const x = (i: number) => marginLeft + i * xStep;
  const y = (v: number) => marginTop + (max - v) * (chartH / denom);

  const rawBodyW = xStep * bodyWidthRatio;
  const bodyW = Math.max(
    candleMinWidth,
    Math.min(rawBodyW, candleMaxWidth, Math.max(0, xStep - 2))
  );

  // === Crosshair (posiciones de referencia) ===
  const nearestIndex = cross.visible
    ? Math.max(0, Math.min(candles.length - 1, Math.round((cross.x - marginLeft) / xStep)))
    : -1;
  const nearestCandle = nearestIndex >= 0 ? candles[nearestIndex] : null;

  // === Manejo de desplazamiento ===
  function handleMouseDown(e: React.MouseEvent) {
    if (!containerRef.current) return;
    setIsDragging(true);
    setLastX(e.clientX);
    e.preventDefault();
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isDragging && containerRef.current) {
      const dx = e.clientX - lastX;
      containerRef.current.scrollLeft -= dx;
      setLastX(e.clientX);
    }

    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= marginLeft && x <= rect.width - marginRight && y >= marginTop && y <= rect.height - marginBottom) {
      setCross({ x, y, visible: true });
    } else {
      setCross((c) => ({ ...c, visible: false }));
    }
  }

  function handleMouseLeave() {
    setIsDragging(false);
    setCross((c) => ({ ...c, visible: false }));
  }

  // === Auto-scroll al extremo derecho ===
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const atEnd =
      container.scrollLeft + container.clientWidth >= container.scrollWidth - 20;
    // si ya está al final o es la primera carga, desplazamos al extremo derecho
    if (atEnd || container.scrollLeft === 0) {
      container.scrollLeft = container.scrollWidth;
    }
  }, [candles.length]);

  // === Render ===
  return (
    <div
      ref={containerRef}

      className="overflow-x-auto cursor-grab active:cursor-grabbing w-full"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        ref={svgRef}
        width={Math.max(width, candles.length * bodyW * 2)}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        className="bg-transparent"
      >
        {/* Ejes Y */}
        <line
          x1={marginLeft}
          x2={marginLeft}
          y1={marginTop}
          y2={marginTop + chartH}
          stroke="#2a2a2a"
          strokeWidth={1}
        />

        {/* Líneas horizontales y etiquetas Y */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = min + (i * (max - min)) / yTicks;
          const yy = y(v);
          return (
            <g key={`yt-${i}`}>
              <line
                x1={marginLeft}
                x2={width - marginRight}
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
          x2={width - marginRight}
          y1={marginTop + chartH}
          y2={marginTop + chartH}
          stroke="#2a2a2a"
          strokeWidth={1}
        />

        {/* Velas */}
        {candles.map((c, i) => {
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
          const isLast = i === candles.length - 1;
          return (
            <g key={c.time} className={isLast ? "animate-pulse-slow" : ""}>
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

        {/* Crosshair */}
        {cross.visible && nearestCandle && (
          <>
            <line
              x1={x(nearestIndex)}
              x2={x(nearestIndex)}
              y1={marginTop}
              y2={marginTop + chartH}
              stroke="#888"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
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
