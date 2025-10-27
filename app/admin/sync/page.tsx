"use client";

import React, { useEffect, useState } from "react";

export default function AdminSyncPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // === 1️⃣ Verificar si el usuario actual es admin ===
  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!res.ok) throw new Error("Error de sesión");
        const data = await res.json();

        // Puedes ajustar esta condición según tu estructura
        if (data?.user?.id === 64 || data?.user?.role === "ADMIN") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    }

    checkAdmin();
  }, []);

  // === 2️⃣ Ejecutar sincronización ===
  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/users/seed?key=superclave2025`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  // === 3️⃣ Mostrar pantalla de carga / restricción ===
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
        Verificando permisos...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-red-400 text-center p-6">
        <h1 className="text-2xl font-bold mb-2">⛔ Acceso denegado</h1>
        <p className="text-neutral-400 text-sm max-w-sm">
          Esta página es solo para administradores. Si crees que es un error,
          contacta con el profesor Ben.
        </p>
      </div>
    );
  }

  // === 4️⃣ Interfaz principal de admin ===
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-xl mx-auto bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">🧩 Sincronizar usuarios desde CSV</h1>

        <p className="text-sm text-neutral-400 mb-4">
          Al presionar el botón, el sistema descargará el archivo más reciente
          <code className="bg-neutral-800 px-2 py-0.5 rounded mx-1 text-[13px]">
            users_utf8.csv
          </code>
          desde GitHub y actualizará la base de datos en Prisma.
        </p>

        <button
          onClick={handleSync}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium ${
            loading
              ? "bg-neutral-700 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {loading ? "Sincronizando..." : "🔄 Ejecutar sincronización"}
        </button>

        {error && (
          <div className="mt-4 text-red-400 text-sm">⚠️ Error: {error}</div>
        )}

        {result && (
          <div className="mt-6 bg-neutral-950 border border-neutral-800 rounded-lg p-4 text-sm">
            <h2 className="text-lg font-semibold mb-2 text-emerald-400">
              Resultado
            </h2>
            <pre className="text-neutral-300 text-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
