import { prisma } from "@/app/lib/prisma";

async function main() {
  console.log("🧹 Eliminando TODAS las velas...");
  const result = await prisma.candle.deleteMany({});
  console.log(`✅ ${result.count} velas eliminadas.`);
}

main()
  .catch((e) => {
    console.error("❌ Error al eliminar velas:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
