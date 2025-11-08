// export_candles_split.ts
import { prisma } from "@/app/lib/prisma";
import fs from "fs";
import path from "path";

// 🔒 convierte fechas inválidas a cadena vacía
function safeDate(d: any): string {
  if (!d) return "";
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? "" : date.toISOString();
  } catch {
    return "";
  }
}

async function main() {
  console.log("⏳ Exportando velas por activo y timeframe...");

  // 📁 Crear carpeta de exportación
  const outDir = path.join(process.cwd(), "exports_split");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  // 🕯️ Obtener lista de combinaciones únicas
  const combos = await prisma.candle.groupBy({
    by: ["valueId", "timeframe"],
  });

  console.log(`Encontradas ${combos.length} combinaciones únicas.`);

  for (const combo of combos) {
    const { valueId, timeframe } = combo;
    const candles = await prisma.candle.findMany({
      where: { valueId, timeframe },
      orderBy: { ts: "asc" },
    });

    if (candles.length === 0) continue;

    const filePath = path.join(outDir, `${valueId}_${timeframe}.csv`);
    const header = "valueId,timeframe,ts,open,high,low,close,time\n";
    const lines = candles.map(c => {
      const ts = safeDate(c.ts);
      const time = safeDate(c.time);
      return `${c.valueId},${c.timeframe},${ts},${c.open},${c.high},${c.low},${c.close},${time}`;
    });

    fs.writeFileSync(filePath, header + lines.join("\n"), "utf-8");
    console.log(`✅ ${valueId}_${timeframe}.csv → ${candles.length} velas`);
  }

  console.log("🎯 Exportación completa. Revisa la carpeta /exports_split");
}

main()
  .catch(err => {
    console.error("❌ Error durante la exportación:", err);
  })
  .finally(() => process.exit());
