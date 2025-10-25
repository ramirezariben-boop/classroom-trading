"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AlumnoPage() {
  const [alumno, setAlumno] = useState<{ name: string; points: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("alumno");
    if (!saved) {
      router.push("/login");
      return;
    }
    setAlumno(JSON.parse(saved));
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("alumno");
    router.push("/login");
  }

  if (!alumno) {
    return (
      <div className="p-6 text-center text-gray-600">
        Cargando información del alumno...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white shadow-md p-6 rounded-lg w-80 text-center">
        <h1 className="text-xl font-bold mb-4">¡Hola, {alumno.name}!</h1>
        <p className="text-lg">Tienes actualmente:</p>
        <p className="text-3xl font-bold text-blue-700 mb-4">{alumno.points} puntos</p>

        <button
          onClick={handleLogout}
          className="bg-red-600 text-white py-2 px-4 rounded w-full hover:bg-red-700"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
