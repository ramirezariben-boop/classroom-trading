// app/api/signals/route.ts
import { NextResponse } from "next/server";

/**
 * Señales de ejemplo. Sustitúyelas luego con
 * tus datos reales (participaciones, tareas, YouTube, canjeos…).
 */
export async function GET() {
  // Ejemplo estable por día: cambia poco en cada petición
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Puedes traer esto de DB; por ahora son parámetros "tuneables"
  const signals = {
    groupAvg: 78, // desempeño grupo (0–100)
    workers: { baumxp: 82, dsgmxp: 74, rftmxp: 88 }, // por valor
    demand: { krimxp: 12, grmmxp: 6, litmxp: 10, hormxp: 4 }, // demanda reciente
    participations: {
      SON: 28,            // # asistentes domingo
      SAM: 31,            // # asistentes sábado
      expected: 35,       // esperado
      eta: 0.05,          // sensibilidad de divisas SON/SAM
    },
    // “modificadores” directos (canjeos, favores, etc.) — agrega lo que gustes:
    redemptionsScore: 0.02,  // +2% en general por canjeos altos (ejemplo)
    youtubeScore: 0.03,      // +3% si tus métricas subieron (ejemplo)
    dayKey: todayKey,
  };

  return NextResponse.json(signals, { status: 200 });
}
