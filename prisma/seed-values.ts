import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const values = [
  // Aktien
  { id: "BAUMXP", name: "BAUMXP", categoryId: "aktien", description: "Bauunternehmen" },
  { id: "DSGMXP", name: "DSGMXP", categoryId: "aktien", description: "Aufgabendesign" },
  { id: "RFTMXP", name: "RFTMXP", categoryId: "aktien", description: "Referate" },

  // Materialien
  { id: "KRIMXP", name: "KRIMXP", categoryId: "materialien", description: "Krimis" },
  { id: "GRMMXP", name: "GRMMXP", categoryId: "materialien", description: "Grammatik" },
  { id: "LITMXP", name: "LITMXP", categoryId: "materialien", description: "Literatur" },
  { id: "HORMXP", name: "HORMXP", categoryId: "materialien", description: "Hörverstehen" },

  // Währungen
  { id: "SONMXP", name: "SONMXP", categoryId: "wahrungen", description: "Puntos del domingo" },
  { id: "SAMMXP", name: "SAMMXP", categoryId: "wahrungen", description: "Puntos del sábado" },

  // Werte
  { id: "WGRMXP", name: "WGRMXP", categoryId: "werte", description: "Valor domingo" },
  { id: "WAUMXP", name: "WAUMXP", categoryId: "werte", description: "Valor sábado" },
  { id: "WBTMXP", name: "WBTMXP", categoryId: "werte", description: "Valor domingo" },
  { id: "WXHMXP", name: "WXHMXP", categoryId: "werte", description: "Valor sábado" },

  // Zehntel
  { id: "ZHNMXP", name: "ZHNMXP", categoryId: "zehntel", description: "Décima" },
  { id: "ANLMXP", name: "ANLMXP", categoryId: "zehntel", description: "Bonos" },

  // Güter
  { id: "GZEHNTEL", name: "Zehntel", categoryId: "guter", description: "Décima" },
  { id: "GKRIMI", name: "Krimi", categoryId: "guter", description: "Krimi" },
  { id: "GGRAMM", name: "Grammatik", categoryId: "guter", description: "Grammatik" },
  { id: "GLIT", name: "Literatur", categoryId: "guter", description: "Literatur" },
  { id: "GHOR", name: "Hörverstehen", categoryId: "guter", description: "Hörverstehen" },
];

async function main() {
  for (const v of values) {
    await prisma.value.upsert({
      where: { id: v.id },
      update: v,
      create: v,
    });
  }
  console.log("✅ Valores iniciales insertados correctamente");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
