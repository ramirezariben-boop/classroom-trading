import { prisma } from "../app/lib/prisma";

// ===== CONFIGURACIÓN =====
const SYMBOLS = [
  "baumxp",
  "dsgmxp",
  "aufmxp",
  "anwmpx",
  "xhamxp",
  "notmxp",
  "krimxp",
  "grmmxp",
  "litmxp",
  "hormxp",
  "sonmxp",
  "sammxp",
];
const TIMEFRAME = "5m";
const START_PRICE: Record<string, number> = {
  baumxp: 126,
  dsgmxp: 110,
  aufmxp: 90,
  anwmpx: 86,
  xhamxp: 3,
  notmxp: 81,
  krimxp: 46,
  grmmxp: 46,
  litmxp: 53,
  hormxp: 57,
  sonmxp: 1.32,
  sammxp: 1.08,
};

// Medio año de 5 min → ~52 000 velas por activo
const FIVE_MIN = 5 * 60 * 1000;
const HALF_YEAR_MS = 182 * 24 * 60 * 60 * 1000;
const NOW = Date.now();
const START = NOW - HALF_YEAR_MS;

// Variabilidad (porcentaje máx de cambio entre velas)
const VOLATILITY = 0.005; // 0.5 %

async function main() {
  console.log("🕒 Generando velas históricas (medio año, 5 m)…");
  for (const id of SYMBOLS) {
    const base = START_PRICE[id] ?? 100;
    let price = base;
    const candles = [];

    for (let t = START; t < NOW; t += FIVE_MIN) {
      const change = 1 + (Math.random() * 2 - 1) * VOLATILITY;
      const open = price;
      const close = open * change;
      const high = Math.max(open, close) * (1 + Math.random() * VOLATILITY * 0.5);
      const low = Math.min(open, close) * (1 - Math.random() * VOLATILITY * 0.5);

      candles.push({
        valueId: id,
        timeframe: TIMEFRAME,
        ts: new Date(t),
        time: new Date(t),
        open,
        high,
        low,
        close,
      });

      price = close;
    }

    // 🔥 Inserta por lotes para no saturar Prisma
    const BATCH = 1000;
    for (let i = 0; i < candles.length; i += BATCH) {
      const batch = candles.slice(i, i + BATCH);
      await prisma.candle.createMany({
        data: batch,
        skipDuplicates: true,
      });
      console.log(`📊 ${id}: ${i + batch.length}/${candles.length}`);
    }
  }

  console.log("✅ Velas generadas correctamente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
