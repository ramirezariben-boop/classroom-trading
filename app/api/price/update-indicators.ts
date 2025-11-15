// app/api/price/update-indicators.ts
import fs from "fs/promises";
import path from "path";

export async function updateIndicators(defaults: Record<string, number>) {
  try {
    const filePath = path.join(process.cwd(), "public", "factors-history.json");
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    function lastValid(arr: any[]) {
      if (!Array.isArray(arr)) return null;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (typeof arr[i]?.valor === "number") return arr[i].valor;
      }
      return null;
    }

    // ------- 1. Asistencia → ANWMPX -------
    const asistSab = lastValid(data.asistencia?.sabado ?? []);
    const asistDom = lastValid(data.asistencia?.domingo ?? []);

    if (asistSab ?? asistDom) {
      const asistenciaProm =
        ( (asistSab ?? 0) + (asistDom ?? 0) ) /
        ( (asistSab ? 1 : 0) + (asistDom ? 1 : 0) );

      defaults.anwmpx = +asistenciaProm.toFixed(2);
    }

    // ------- 2. Tareas EXTRA → XHAMXP -------
    const txSab = lastValid(data["tareas extra"]?.sabado ?? []);
    const txDom = lastValid(data["tareas extra"]?.domingo ?? []);

    if (txSab ?? txDom) {
      const tareasExtraProm =
        ( (txSab ?? 0) + (txDom ?? 0) ) /
        ( (txSab ? 1 : 0) + (txDom ? 1 : 0) );

      defaults.xhamxp = +tareasExtraProm.toFixed(2);
    }

    // ------- 3. Tareas normales → AUFMXP -------
    const tnSab = lastValid(data.tareas?.sabado ?? []);
    const tnDom = lastValid(data.tareas?.domingo ?? []);

    if (tnSab ?? tnDom) {
      const tareasNormProm =
        ( (tnSab ?? 0) + (tnDom ?? 0) ) /
        ( (tnSab ? 1 : 0) + (tnDom ? 1 : 0) );

      defaults.aufmxp = +tareasNormProm.toFixed(2);
    }

    // ------- 4. Calificaciones → NOTMXP -------
    const calSab = lastValid(data.calificaciones?.sabado ?? []);
    const calDom = lastValid(data.calificaciones?.domingo ?? []);

    if (calSab ?? calDom) {
      const califProm =
        ( (calSab ?? 0) + (calDom ?? 0) ) /
        ( (calSab ? 1 : 0) + (calDom ? 1 : 0) );

      defaults.notmxp = +califProm.toFixed(2);
    }

    return defaults;

  } catch (err) {
    console.error("❌ Error procesando factors-history.json:", err);
    return defaults; // fallback seguro
  }
}
