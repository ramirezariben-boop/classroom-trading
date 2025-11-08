// export_candles.ts
import { prisma } from "@/app/lib/prisma";
import fs from "fs";
import path from "path";

// 🛡️ Convierte fechas inválidas o nulas a cadena vacía
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
  console.log("⏳ Exportando velas de la base...");

  // 🕯️ Obtener todas las velas ordenadas por timestamp
  const candles = await prisma.candle.findMany({
    orderBy: { ts: "asc" },
  });

  if (candles.length === 0) {
    console.log("⚠️ No hay velas en la base de datos.");
    return;
  }

  // 📁 Crear carpeta de exportación si no existe
  const outPath = path.join(process.cwd(), "exports");
  if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);

  // 📄 Crear archivo CSV
  const filePath = path.join(outPath, "Candle_backup.csv");
  const header = "valueId,timeframe,ts,open,high,low,close,time\n";
  const lines = candles.map(c => {
    const ts = safeDate(c.ts);
    const time = safeDate(c.time);
    return `${c.valueId},${c.timeframe},${ts},${c.open},${c.high},${c.low},${c.close},${time}`;
  });

  fs.writeFileSync(filePath, header + lines.join("\n"), "utf-8");
  console.log(`✅ Exportadas ${candles.length} velas a ${filePath}`);
}

// 🧩 Ejecutar el script
main()
  .catch(err => {
    console.error("❌ Error durante la exportación:", err);
  })
  .finally(() => process.exit());
