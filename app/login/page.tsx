"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [nip, setNip] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, nip }),
    });

    if (res.ok) {
      router.push(`/alumno/${id}`);
    } else {
      setError("ID o NIP incorrecto");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg w-80">
        <h1 className="text-xl font-bold mb-4 text-center">Ingreso de alumno</h1>

        <input
          type="text"
          placeholder="ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="w-full border rounded-md p-2 mb-3"
        />
        <input
          type="password"
          placeholder="NIP (4 cifras)"
          value={nip}
          onChange={(e) => setNip(e.target.value)}
          className="w-full border rounded-md p-2 mb-3"
        />

        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
