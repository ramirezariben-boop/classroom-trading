// scripts/renameIndicatorValues.ts
import { prisma } from "../app/lib/prisma";

async function main() {
  const mappings = [
    { oldId: "wgrmxp", newId: "anwmpx" },
    { oldId: "waumxp", newId: "xhamxp" },
    { oldId: "wbtmxp", newId: "aufmxp" },
    { oldId: "wxhmxp", newId: "notmxp" },
  ];

  for (const { oldId, newId } of mappings) {
    const oldValue = await prisma.value.findUnique({ where: { id: oldId } });
    if (!oldValue) {
      console.log(`⚠️ No existe ${oldId}, se omite.`);
      continue;
    }

    // 1️⃣ Cambiar temporalmente el id viejo (evita conflicto de clave)
    await prisma.value.update({
      where: { id: oldId },
      data: { id: `${oldId}_old` },
    });

    // 2️⃣ Actualizar todas las velas que apuntan al id viejo
    const candleCount = await prisma.candle.updateMany({
      where: { valueId: oldId },
      data: { valueId: `${oldId}_old` },
    });

    console.log(`🔄 Reetiquetadas ${candleCount.count} velas temporales de ${oldId}.`);

    // 3️⃣ Si ya existía el nuevo, elimínalo (para no duplicar)
    await prisma.value.deleteMany({ where: { id: newId } });

    // 4️⃣ Renombrar el registro temporal al id nuevo
    await prisma.value.update({
      where: { id: `${oldId}_old` },
      data: {
        id: newId,
        name: newId.toUpperCase(),
        categoryId: "indikatoren",
        description: `Renombrado desde ${oldId.toUpperCase()}`,
      },
    });

    // 5️⃣ Actualizar las velas del id temporal al nuevo
    const candleFinal = await prisma.candle.updateMany({
      where: { valueId: `${oldId}_old` },
      data: { valueId: newId },
    });

    console.log(`✅ ${oldId} → ${newId}: ${candleFinal.count} velas re-asignadas`);
  }

  console.log("🎯 Renombrado completado sin duplicar registros.");
}

main()
  .catch((err) => console.error("❌ Error:", err))
  .finally(() => prisma.$disconnect());
