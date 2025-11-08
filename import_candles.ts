// import_candles.ts
import { prisma } from "@/app/lib/prisma";
import fs from "fs";

async function main() {
  const file = "Candle_backup.csv";
  const raw = fs.readFileSync(file, "utf-8");
  const csv = raw.trim().split("\n").filter(line => line.trim() !== "");
  const header = csv.shift(); // elimina encabezado

  console.log(`📥 Importando ${csv.length} velas desde ${file}...\n`);

  let ok = 0;
  let batch: any[] = [];

  for (let i = 0; i < csv.length; i++) {
    const line = csv[i].replace(/\r/g, ""); // elimina retorno de carro
    const [valueId, timeframe, tsRaw, open, high, low, close, timeRaw] = line.split(",");

    if (!valueId || !timeRaw) continue;

    const ts = new Date(tsRaw);
    const time = new Date(timeRaw);

    if (isNaN(ts.getTime()) || isNaN(time.getTime())) continue;

    batch.push({
      valueId,
      timeframe,
      ts,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      time,
    });

    if (batch.length >= 100) {
      await prisma.candle.createMany({ data: batch, skipDuplicates: true });
      ok += batch.length;
      batch = [];
      if (i % 1000 === 0) console.log(`... ${ok} velas insertadas`);
    }
  }

  // Inserta las que quedaron pendientes
  if (batch.length > 0) {
    await prisma.candle.createMany({ data: batch, skipDuplicates: true });
    ok += batch.length;
  }

  console.log(`\n✅ Importación completada. Exitosas: ${ok}`);
}

main()
  .catch((err) => console.error("❌ Error general:", err))
  .finally(async () => {
    await prisma.$disconnect();
  });
