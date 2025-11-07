"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

interface Props {
  candles: Candle[];
  height?: number;
  xTicks?: number;
  yTicks?: number;
  bodyWidthRatio?: number;
  yMin?: number;
  yMax?: number;
  highlightLast?: boolean;
}

export default function CandleChart({
  candles,
  height = 300,
  xTicks = 6,
  yTicks = 4,
  bodyWidthRatio = 0.6,
  yMin,
  yMax,
  highlightLast = false,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const phase = useRef(0);
  const [offset, setOffset] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);

  // === Rango Y dinámico ===
  const { min, max } = useMemo(() => {
    if (!candles.length) return { min: 0, max: 1 };
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const lo = yMin ?? Math.min(...lows);
    const hi = yMax ?? Math.max(...highs);
    return { min: lo, max: hi };
  }, [candles, yMin, yMax]);

  const range = max - min || 1;

  // === Dibujo ===
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (!candles.length) return;

      const barWidth = W / candles.length;
      const bodyWidth = barWidth * bodyWidthRatio;
      const toY = (price: number) => H - ((price - min) / range) * H;

      const visibleCount = Math.min(candles.length, Math.ceil(W / barWidth));
      const start = Math.max(0, Math.floor(offset / barWidth));
      const end = Math.min(candles.length, start + visibleCount + 1);
      const view = candles.slice(start, end);

      // === Dibujar velas visibles ===
      view.forEach((c, i) => {
        const x = (i - (offset / barWidth - start)) * barWidth + barWidth / 2;
        const color = c.close >= c.open ? "#22c55e" : "#ef4444";
        const isLast = c === candles[candles.length - 1];

        let alpha = 1.0;
        if (isLast && highlightLast) {
          phase.current += 0.05;
          alpha = 0.5 + Math.sin(phase.current) * 0.25;
        }

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;

        // Mecha
        ctx.beginPath();
        ctx.moveTo(x, toY(c.high));
        ctx.lineTo(x, toY(c.low));
        ctx.stroke();

        // Cuerpo
        const yOpen = toY(c.open);
        const yClose = toY(c.close);
        const yTop = Math.min(yOpen, yClose);
        const yBottom = Math.max(yOpen, yClose);
        const bodyHeight = Math.max(1, yBottom - yTop);
        ctx.fillRect(x - bodyWidth / 2, yTop, bodyWidth, bodyHeight);
      });

      ctx.globalAlpha = 1.0;

      // === Ejes ===
      ctx.strokeStyle = "#404040";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, H);
      ctx.lineTo(W, H);
      ctx.stroke();

      // === Etiquetas Y ===
      ctx.fillStyle = "#aaa";
      ctx.font = "10px Verdana";
      for (let i = 0; i <= yTicks; i++) {
        const yVal = min + (i / yTicks) * range;
        const y = toY(yVal);
        ctx.fillText(yVal.toFixed(2), 2, y - 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.stroke();
      }

      // === Etiquetas X ===
      const step = Math.max(1, Math.floor(view.length / xTicks));
      for (let i = 0; i < view.length; i += step) {
        const c = view[i];
        const date = new Date(c.time);
        const label = date.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const x = (i - (offset / barWidth - start)) * barWidth + 4;
        ctx.fillText(label, x, H - 2);
      }

      animationFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrame);
  }, [candles, min, max, range, bodyWidthRatio, xTicks, yTicks, highlightLast, offset]);

  // === Mostrar hora bajo el mouse ===
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left + offset;
      const idx = Math.floor((x / rect.width) * candles.length);
      const c = candles[idx];
      const label = document.getElementById("time-label");
      if (!c || !label) return;
      const hora = new Date(c.time).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      });
      label.textContent = hora;
    };

    const clearLabel = () => {
      const label = document.getElementById("time-label");
      if (label) label.textContent = "";
    };

    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseleave", clearLabel);
    return () => {
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseleave", clearLabel);
    };
  }, [candles, offset]);

  // === Arrastre dentro del canvas ===
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const handleDown = (e: MouseEvent) => {
      dragging.current = true;
      startX.current = e.clientX;
      startOffset.current = offset;
      canvas.style.cursor = "grabbing";
    };

    const handleUp = () => {
      dragging.current = false;
      canvas.style.cursor = "grab";
    };

    const handleMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      setOffset((prev) => Math.max(0, startOffset.current - dx));
    };

    canvas.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mousemove", handleMove);

    return () => {
      canvas.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mousemove", handleMove);
    };
  }, [offset]);

  // === Render ===
  return (
    <div style={{ textAlign: "center", overflow: "hidden" }}>
      <canvas
        ref={ref}
        width={900}
        height={height}
        style={{
          width: "100%",
          height,
          display: "block",
          cursor: "grab", // 🖐️ mano abierta
        }}
      />
      <div
        id="time-label"
        style={{
          color: "#aaa",
          fontSize: "12px",
          marginTop: "6px",
          height: "16px",
          textAlign: "center",
          transition: "opacity 0.3s",
        }}
      />
    </div>
  );
}
