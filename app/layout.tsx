// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classroom Trading",
  description: "Sistema de puntos interactivo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* ✅ Permite zoom táctil y mejora el render en móviles */}
        <meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=10.0, user-scalable=yes"
/>

      </head>
      <body className="bg-neutral-950 text-white">{children}</body>
    </html>
  );
}
