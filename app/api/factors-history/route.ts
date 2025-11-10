// app/api/factors-history/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = {
    asistencia: {
      sabado: [
        { fecha: "16 ago", valor: 67.95 },
        { fecha: "23 ago", valor: 87.95 },
        { fecha: "30 ago", valor: 93.47 },
        { fecha: "6 sep", valor: 89.19 },
        { fecha: "13 sep", valor: 85.67 },
        { fecha: "20 sep", valor: 87.25 },
        { fecha: "27 sep", valor: 89.18 },
        { fecha: "18 oct", valor: 74.54 },
        { fecha: "25 oct", valor: 76.36 },
        { fecha: "1 nov", valor: 67.85 },
        { fecha: "8 nov", valor: 85.53 },
      ],
      domingo: [
        { fecha: "17 ago", valor: 69.05 },
        { fecha: "26 ago", valor: 89.35 },
        { fecha: "31 ago", valor: 84.3 },
        { fecha: "7 sep", valor: 84.4 },
        { fecha: "14 sep", valor: 81.28 },
        { fecha: "21 sep", valor: 81.29 },
        { fecha: "28 sep", valor: null },
        { fecha: "19 oct", valor: 78.01 },
        { fecha: "26 oct", valor: 82.96 },
        { fecha: "2 nov", valor: 80.25 },
        { fecha: "9 nov", valor: 87.08 },
      ],
    },

    calificaciones: {
      sabado: [
        { fecha: "6 sep", valor: 85.78 },
        { fecha: "4 oct", valor: 76.76 },
      ],
      domingo: [
        { fecha: "7 sep", valor: 81.33 },
        { fecha: "5 oct", valor: 85.27 },
      ],
    },

    tareas: {
      sabado: [
        { fecha: "18 oct", valor: 85.98 },
        { fecha: "25 oct", valor: 86.49 },
        { fecha: "1 nov", valor: 88.43 },
        { fecha: "8 nov", valor: 91.54 },
      ],
      domingo: [
        { fecha: "19 oct", valor: 97.2 },
        { fecha: "26 oct", valor: 91.18 },
        { fecha: "2 nov", valor: 95.74 },
        { fecha: "9 nov", valor: 89.73 },
      ],
    },

    // ⚠️ cambia el nombre aquí para que coincida con lo que lee /api/price/
    tareas_extra: {
      sabado: [
        { fecha: "25 oct", valor: 1.93 },
        { fecha: "1 nov", valor: 0.96 },
        { fecha: "8 nov", valor: 1.35 },
      ],
      domingo: [
        { fecha: "26 oct", valor: 3.17 },
        { fecha: "2 nov", valor: 2.89 },
        { fecha: "9 nov", valor: 4.52 },
      ],
    },
  };

  // 🧩 Guardar automáticamente en public/factors-history.json
  const outputPath = path.join(process.cwd(), "public", "factors-history.json");
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2), "utf8");

  console.log("✅ Archivo factors-history.json actualizado en /public");

  return NextResponse.json(data);
}
