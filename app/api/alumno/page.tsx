"use client";

import { useState } from "react";

export default function AlumnoPage() {
  const [nombre, setNombre] = useState("");
  const [data, setData] = useState<{ name: string; points: number } | null>(null);
  const [error, setError] = useState("");

  async function handleBuscar() {
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/alumno?name=${encodeURIComponent(nombre)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al buscar alumno");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="p-8 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Consulta tus puntos</h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Escribe tu nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border p-2 rounded"
        />
        <button
          onClick={handleBuscar}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Buscar
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {data && (
        <div className="mt-4 border p-4 rounded-lg shadow-md bg-white">
          <p><strong>Alumno:</strong> {data.name}</p>
          <p><strong>Puntos:</strong> {data.points}</p>
        </div>
      )}
    </div>
  );
}
