import { prisma } from "@/app/lib/prisma";

async function main() {
  const mappings = [
    { oldId: "wgrmxp", newId: "anwmpx" },
    { oldId: "waumxp", newId: "xhamxp" },
    { oldId: "wbtmxp", newId: "aufmxp" },
    { oldId: "wxhmxp", newId: "notmxp" },
  ];

  for (const { oldId, newId } of mappings) {
    // Asegurar que el nuevo Value exista
    await prisma.value.upsert({
      where: { id: newId },
      update: {},
      create: {
        id: newId,
        name: newId.toUpperCase(),
        categoryId: "indikatoren",
        description: `Migrado desde ${oldId.toUpperCase()}`,
      },
    });

    // Actualizar las velas que usaban el viejo ID
    const count = await prisma.candle.updateMany({
      where: { valueId: oldId },
      data: { valueId: newId },
    });

    console.log(`🔄 Migradas ${count.count} velas de ${oldId} → ${newId}`);
  }

  console.log("✅ Migración completada");
}

main().finally(() => prisma.$disconnect());
