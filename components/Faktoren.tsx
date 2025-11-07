// components/Faktoren.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

type Metric = { name: string; saturday: number; sunday: number };

type WeeklyEntry = { fecha: string; valor: number };
type WeeklyData = {
  asistencia: { sabado: WeeklyEntry[]; domingo: WeeklyEntry[] };
  calificaciones: { sabado: WeeklyEntry[]; domingo: WeeklyEntry[] };
};

const Faktoren = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);

  // === Cargar datos desde la API ===
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/factors-history", { cache: "no-store" });
        if (!res.ok) throw new Error("Error cargando datos históricos");
        const json = await res.json();
        setWeeklyData(json);
      } catch (err) {
        console.error("❌ Error al cargar /api/factors-history:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // === Datos actuales (última semana) ===
const metrics: Metric[] = [
  { name: "Participaciones", saturday: 1.24, sunday: 3.02 },
  { name: "Tareas", saturday: 88.43, sunday: 95.74 },
  { name: "Calificaciones", saturday: 89, sunday: 90 },
  { name: "Tareas extra", saturday: 0.96, sunday: 2.89 },
  { name: "Asistencia", saturday: 67.85, sunday: 80.25 },
];


  const ratioCanal = 3.0;

  const openChart = (metric: string) => setSelected(metric);
  const closeChart = () => setSelected(null);

  const lower = selected?.toLowerCase() || "";
  const isHistorical =
    lower === "asistencia" || lower === "calificaciones";

  // === Datos para barras (actual) ===
  const metric = metrics.find((m) => m.name === selected);
  const barData =
    metric &&
    ({
      labels: ["Sábado", "Domingo"],
      datasets: [
        {
          label: metric.name,
          data: [metric.saturday, metric.sunday],
          backgroundColor: ["#3B82F6", "#F59E0B"],
          borderRadius: 6,
        },
      ],
    } as const);

  // === Datos para líneas (histórico) ===
  const lineData =
    isHistorical && weeklyData
      ? {
          labels:
            weeklyData[lower as keyof WeeklyData]?.sabado.map((d) => d.fecha) ||
            [],
          datasets: [
            {
              label: "Sábado",
              data:
                weeklyData[lower as keyof WeeklyData]?.sabado.map((d) =>
                  isNaN(d.valor) ? null : d.valor
                ) || [],
              borderColor: "#3B82F6",
              backgroundColor: "#3B82F6",
              fill: false,
              tension: 0.3,
            },
            {
              label: "Domingo",
              data:
                weeklyData[lower as keyof WeeklyData]?.domingo.map((d) =>
                  isNaN(d.valor) ? null : d.valor
                ) || [],
              borderColor: "#F59E0B",
              backgroundColor: "#F59E0B",
              fill: false,
              tension: 0.3,
            },
          ],
        }
      : null;

  const lastDate =
    isHistorical && weeklyData
      ? weeklyData[lower as keyof WeeklyData]?.sabado.slice(-1)[0]?.fecha ||
        "—"
      : null;

  if (loading) {
    return (
      <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 text-neutral-400 text-sm">
        Cargando métricas…
      </div>
    );
  }

  return (
    <div className="relative bg-neutral-900 rounded-2xl p-4 border border-neutral-800 text-neutral-100">
      <h2 className="text-lg font-semibold mb-3">📊 Faktoren</h2>

      {/* Lista textual */}
      <div className="space-y-2 text-sm">
        {metrics.map((m) => (
          <div
            key={m.name}
            onClick={() => openChart(m.name)}
            className="flex justify-between p-2 rounded-lg cursor-pointer hover:bg-neutral-800/70 transition-colors"
          >
            <span>{m.name}</span>
            <span>
              Sáb: {m.saturday} | Dom: {m.sunday}
            </span>
          </div>
        ))}

        <div className="flex justify-between p-2 border-t border-neutral-800 mt-2">
          <span>Ratio canal</span>
          <span>{ratioCanal.toFixed(1)}%</span>
        </div>
      </div>

      {/* Modal flotante */}
      {selected && (
        <div
          onClick={closeChart}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 p-6 rounded-2xl border border-neutral-700 w-[90%] max-w-md relative shadow-xl"
          >
            <button
              onClick={closeChart}
              className="absolute top-2 right-3 text-neutral-400 hover:text-neutral-200 text-lg"
            >
              ✕
            </button>

            <h3 className="text-center text-lg font-semibold mb-4">{selected}</h3>

            {isHistorical && lineData ? (
              <>
                <Line
                  data={lineData}
                  options={{
                    plugins: {
                      legend: { position: "bottom", labels: { color: "#ddd" } },
                    },
                    scales: {
                      x: { ticks: { color: "#aaa" } },
                      y: {
                        ticks: { color: "#aaa" },
                        beginAtZero: true,
                      },
                    },
                  }}
                />
                {lastDate && (
                  <p className="text-xs text-neutral-500 mt-3 text-right">
                    Último dato: {lastDate}
                  </p>
                )}
              </>
            ) : (
              barData && (
                <Bar
                  data={barData}
                  options={{
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Faktoren;
