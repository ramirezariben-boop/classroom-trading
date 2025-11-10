// app/api/factors-history/route.ts
import { NextResponse } from "next/server";
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
        // 🆕 Nueva semana
        { fecha: "8 nov", valor: 85.53 },
      ],
      domingo: [
        { fecha: "17 ago", valor: 69.05 },
        { fecha: "26 ago", valor: 89.35 },
        { fecha: "31 ago", valor: 84.3 },
        { fecha: "7 sep", valor: 84.4 },
        { fecha: "14 sep", valor: 81.28 },
        { fecha: "21 sep", valor: 81.29 },
        { fecha: "28 sep", valor: NaN },
        { fecha: "19 oct", valor: 78.01 },
        { fecha: "26 oct", valor: 82.96 },
        { fecha: "2 nov", valor: 80.25 },
        // 🆕 Nueva semana
        { fecha: "9 nov", valor: 87.08 },
      ],
    },

    calificaciones: {
      sabado: [
        { fecha: "6 sep", valor: 85.78 },
        { fecha: "4 oct", valor: 76.76 },
        { fecha: "18 oct", valor: 85.98 },
        { fecha: "25 oct", valor: 86.49 },
        { fecha: "1 nov", valor: 88.43 },
        // 🆕 Nueva semana (proxy de tareas)
        { fecha: "8 nov", valor: 91.54 },
      ],
      domingo: [
        { fecha: "7 sep", valor: 81.33 },
        { fecha: "5 oct", valor: 85.27 },
        { fecha: "19 oct", valor: 97.2 },
        { fecha: "26 oct", valor: 91.18 },
        { fecha: "2 nov", valor: 95.74 },
        // 🆕 Nueva semana
        { fecha: "9 nov", valor: 89.73 },
      ],
    },

    tareas: {
      sabado: [
        { fecha: "18 oct", valor: 85.98 },
        { fecha: "25 oct", valor: 86.49 },
        { fecha: "1 nov", valor: 88.43 },
        // 🆕 Nueva semana
        { fecha: "8 nov", valor: 91.54 },
      ],
      domingo: [
        { fecha: "19 oct", valor: 97.2 },
        { fecha: "26 oct", valor: 91.18 },
        { fecha: "2 nov", valor: 95.74 },
        // 🆕 Nueva semana
        { fecha: "9 nov", valor: 89.73 },
      ],
    },

    "tareas extra": {
      sabado: [
        { fecha: "25 oct", valor: 0.96 },
        { fecha: "1 nov", valor: 0.96 },
        // 🆕 Nueva semana
        { fecha: "8 nov", valor: 1.35 },
      ],
      domingo: [
        { fecha: "26 oct", valor: 2.89 },
        { fecha: "2 nov", valor: 2.89 },
        // 🆕 Nueva semana
        { fecha: "9 nov", valor: 4.52 },
      ],
    },
  };

  return NextResponse.json(data);
}
