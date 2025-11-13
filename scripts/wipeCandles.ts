import { prisma } from "../app/lib/prisma";
async function main() {
  const res = await prisma.candle.deleteMany({});
  console.log("Candles eliminadas:", res.count);
}
main().finally(() => prisma.$disconnect());
