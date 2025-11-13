// app/api/price/reset/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUIET_MODE = true;

// === CATALOGO BASE ===
const DEFAULTS: Record<string, number> = {
  baumxp: 126, dsgmxp: 110, rftmxp: 96,
  krimxp: 46, grmmxp: 46, litmxp: 53, hormxp: 57,
  sonmxp: 1.32, sammxp: 1.08,
  anwmpx: 86.03,
  xhamxp: 2.95,
  aufmxp: 90.63,
  notmxp: 81.01,
  zhnmxp: 13.4, anlmxp: 1.05,
  gzehntel: 13.4, gkrimi: 46, ggramm: 46, glit: 53, ghor: 57,
};

// === OPCIONAL: actualizar indicadores desde factors-history.json ===
async function updateIndicatorsFromFactors() {
  try {
    const filePath = path.join(process.cwd(), "public", "factors-history.json");
    if (!fs.existsSync(filePath)) return;

    const raw = await fsp.readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    const asistenciaSab = data.asistencia?.sabado?.at(-1)?.valor ?? 0;
    const asistenciaDom = data.asistencia?.domingo?.at(-1)?.valor ?? 0;
    const tareasSab = data.tareas_extra?.sabado?.at(-1)?.valor ?? 0;
    const tareasDom = data.tareas_extra?.domingo?.at(-1)?.valor ?? 0;
    const tareasNotasSab = data.tareas?.sabado?.at(-1)?.valor ?? 0;
    const tareasNotasDom = data.tareas?.domingo?.at(-1)?.valor ?? 0;
    const notasSab = data.calificaciones?.sabado?.at(-1)?.valor ?? 0;
    const notasDom = data.calificaciones?.domingo?.at(-1)?.valor ?? 0;

    const asistenciaProm = (asistenciaSab + asistenciaDom) / 2;
    const tareasProm = (tareasSab + tareasDom) / 2;
    const tareasNotasProm = (tareasNotasSab + tareasNotasDom) / 2;
    const notasProm = (notasSab + notasDom) / 2;

    if (asistenciaProm) DEFAULTS.anwmpx = +asistenciaProm.toFixed(2);
    if (tareasProm) DEFAULTS.xhamxp = +tareasProm.toFixed(2);
    if (tareasNotasProm) DEFAULTS.aufmxp = +tareasNotasProm.toFixed(2);
    if (notasProm) DEFAULTS.notmxp = +notasProm.toFixed(2);

    if (!QUIET_MODE) console.log("📊 Indicadores actualizados en DEFAULTS.");
  } catch (err) {
    console.error("❌ Error al actualizar indicadores:", err);
  }
}

// === HANDLER PRINCIPAL ===
export async function GET() {
  console.time("⏱ Reset Price API");

  await updateIndicatorsFromFactors();

  // Actualiza todos los valores en la BD
  for (const [id, base] of Object.entries(DEFAULTS)) {
    await prisma.value.updateMany({
      where: { id },
      data: { price: base },
    });
  }

  console.timeEnd("⏱ Reset Price API");
  if (!QUIET_MODE) console.log("🔁 Todos los activos regresaron a su base y se guardaron en BD.");

  return NextResponse.json({
    ok: true,
    reset: true,
    message: "Todos los activos fueron restablecidos a su valor base (DEFAULTS) y guardados en la base de datos.",
    prices: DEFAULTS,
  });
}
