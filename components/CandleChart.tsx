"use client";
import React, { useState, useRef, useLayoutEffect } from "react";

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
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(0); // -2 a +2
  const [cross, setCross] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [autoScrolled, setAutoScrolled] = useState(false);

  if (!candles || candles.length === 0)
    return <div className="text-xs text-neutral-400">Sin datos…</div>;

  // ==================== MÁRGENES ====================
  const marginLeft = 56;
  const marginRight = 10;
  const marginTop = 8;
  const marginBottom = 22;
  const chartH = height - marginTop - marginBottom;

  // ==================== ZOOM DINÁMICO ====================
  const zoomMap = [4, 8, 16, 32, 64];
  const zoomFactor = zoomMap[zoomLevel + 2];
  const xStep = Math.max(width / zoomFactor, 1);

  // Mostramos TODAS las velas disponibles
  const visibleCandles = candles;

  // ==================== DATOS DE PRECIO ====================
  const lows = visibleCandles.map((c) => c.low);
  const highs = visibleCandles.map((c) => c.high);
  const dataMin = Math.min(...lows);
  const dataMax = Math.max(...highs);
  const denom = dataMax - dataMin || 1;

  // ==================== ESCALAS ====================
  const svgWidth = marginLeft + visibleCandles.length * xStep + marginRight;
  const x = (i: number) => marginLeft + i * xStep;
  const y = (v: number) => marginTop + (dataMax - v) * (chartH / denom);

  // ==================== CUERPOS DE VELA ====================
  const rawBodyW = xStep * bodyWidthRatio;
  const bodyW = Math.max(candleMinWidth, Math.min(rawBodyW, candleMaxWidth, xStep - 2));

  // ==================== CROSSHAIR ====================
  const nearestIndex = cross.visible
    ? Math.max(0, Math.min(visibleCandles.length - 1, Math.round((cross.x - marginLeft) / xStep)))
    : -1;
  const nearestCandle = nearestIndex >= 0 ? visibleCandles[nearestIndex] : null;

  // ==================== EVENTOS DEL RATÓN ====================
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setLastX(e.clientX);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    if (isDragging) {
      const dx = e.clientX - lastX;
      container.scrollLeft -= dx;
      setLastX(e.clientX);
    }

    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const inChart =
      mx >= marginLeft &&
      mx <= svgWidth - marginRight &&
      my >= marginTop &&
      my <= height - marginBottom;

    setCross(inChart ? { x: mx, y: my, visible: true } : { x: 0, y: 0, visible: false });
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => {
    setIsDragging(false);
    setCross((c) => ({ ...c, visible: false }));
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.deltaY > 0) setZoomLevel((prev) => Math.min(2, prev + 1));
    else setZoomLevel((prev) => Math.max(-2, prev - 1));
  };

  // ==================== AUTO-SCROLL AL FINAL (una sola vez) ====================
  useLayoutEffect(() => {
    if (autoScrolled) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollLeft = container.scrollWidth;
    setAutoScrolled(true);
  }, [candles.length]);

  // ==================== RENDER ====================
  return (
    <div
      ref={containerRef}
      className="overflow-x-auto cursor-grab active:cursor-grabbing w-full"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      style={{
        overflowY: "hidden",
        scrollbarColor: "#404040 transparent",
        scrollbarWidth: "thin",
      }}
    >
      <svg
        ref={svgRef}
        width={svgWidth}
        height={height}
        style={{ display: "block" }}
        className="bg-transparent"
      >
        {/* Ejes */}
        <line
          x1={marginLeft}
          x2={marginLeft}
          y1={marginTop}
          y2={marginTop + chartH}
          stroke="#2a2a2a"
        />
        <line
          x1={marginLeft}
          x2={svgWidth - marginRight}
          y1={marginTop + chartH}
          y2={marginTop + chartH}
          stroke="#2a2a2a"
        />

        {/* Líneas horizontales */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = dataMin + (i * (dataMax - dataMin)) / yTicks;
          const yy = y(v);
          return (
            <g key={`yt-${i}`}>
              <line x1={marginLeft} x2={svgWidth - marginRight} y1={yy} y2={yy} stroke="#262626" />
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

        {/* Velas */}
        {visibleCandles.map((c, i) => {
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
          const isLast = i === visibleCandles.length - 1;

          return (
            <g key={c.time} className={isLast ? "animate-candle-blink" : ""}>
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
