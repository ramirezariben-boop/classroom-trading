// app/api/factors-history/route.ts
import { NextResponse } from "next/server";

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
      ],
      domingo: [
        { fecha: "17 ago", valor: 69.05 },
        { fecha: "26 ago", valor: 89.35 },
        { fecha: "31 ago", valor: 84.3 },
        { fecha: "7 sep", valor: 84.4 },
        { fecha: "14 sep", valor: 81.28 },
        { fecha: "21 sep", valor: 81.29 },
        { fecha: "28 sep", valor: NaN },
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
  };

  return NextResponse.json(data);
}
