// app/guter/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function GuterPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const bienes = [
    {
      categoria: "Krimi",
      descripcion: "Novelas policíacas y de misterio en alemán.",
      imagenes: [
        "/images/krimi1.jpg", "/images/krimi2.jpg", "/images/krimi3.jpg", "/images/krimi4.jpg",
        "/images/krimi5.jpg", "/images/krimi6.jpg", "/images/krimi7.jpg", "/images/krimi8.jpg",
        "/images/krimi9.jpg", "/images/krimi10.jpg",
      ],
    },
    {
      categoria: "Grammatik",
      descripcion: "Libros y materiales de gramática alemana.",
      imagenes: [
        "/images/grammatik1.jpg", "/images/grammatik2.jpg", "/images/grammatik3.jpg",
        "/images/grammatik4.jpg", "/images/grammatik5.jpg", "/images/grammatik6.jpg",
        "/images/grammatik7.jpg",
      ],
    },
    {
      categoria: "Literatur",
      descripcion: "Obras literarias clásicas y contemporáneas.",
      imagenes: [
        "/images/literatur1.jpg", "/images/literatur2.jpg", "/images/literatur3.jpg",
        "/images/literatur4.jpg", "/images/literatur5.jpg", "/images/literatur6.jpg",
        "/images/literatur7.jpg",
      ],
    },
    {
      categoria: "Hörverstehen",
      descripcion: "Materiales de comprensión auditiva (audio y texto).",
      imagenes: ["/images/hoerverstehen1.jpg", "/images/hoerverstehen2.jpg"],
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      {/* Encabezado */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📚 Bienes disponibles para canjear</h1>
        <Link
          href="/"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
        >
          ⬅️ Volver al inicio
        </Link>
      </header>

      <p className="text-neutral-400 mb-8">
        Aquí puedes conocer los materiales, libros y recursos que puedes obtener con tus décimas o puntos.
      </p>

      {/* Galería por categorías */}
      <div className="space-y-10">
        {bienes.map((cat) => (
          <section key={cat.categoria}>
            <h2 className="text-xl font-semibold mb-2">{cat.categoria}</h2>
            <p className="text-neutral-400 mb-4">{cat.descripcion}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {cat.imagenes.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setSelected(img)}
                  className="relative group overflow-hidden rounded-xl border border-neutral-800 hover:border-emerald-600 cursor-pointer transition"
                >
                  <img
                    src={img}
                    alt={`${cat.categoria} ${i + 1}`}
                    className="object-cover w-full h-40 sm:h-48 md:h-52 group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Modal de imagen ampliada */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-3xl w-full">
            <img
              src={selected}
              alt="Vista ampliada"
              className="rounded-2xl w-full max-h-[80vh] object-contain border border-neutral-700"
            />
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Pie */}
      <footer className="mt-12 text-center text-neutral-500 text-sm">
        © {new Date().getFullYear()} Classroom Trading · Galería de bienes
      </footer>
    </div>
  );
}
