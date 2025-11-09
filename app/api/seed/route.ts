import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const DEFAULT_VALUES = [
    { id: "baumxp", name: "BAUMXP", categoryId: "aktien" },
    { id: "dsgmxp", name: "DSGMXP", categoryId: "aktien" },
    { id: "rftmxp", name: "RFTMXP", categoryId: "aktien" },
    { id: "krimxp", name: "KRIMXP", categoryId: "materialien" },
    { id: "grmmxp", name: "GRMMXP", categoryId: "materialien" },
    { id: "litmxp", name: "LITMXP", categoryId: "materialien" },
    { id: "hormxp", name: "HORMXP", categoryId: "materialien" },
    { id: "sonmxp", name: "SONMXP", categoryId: "wahrungen" },
    { id: "sammxp", name: "SAMMXP", categoryId: "wahrungen" },
    { id: "wgrmxp", name: "WGRMXP", categoryId: "werte" },
    { id: "waumxp", name: "WAUMXP", categoryId: "werte" },
    { id: "wbtmxp", name: "WBTMXP", categoryId: "werte" },
    { id: "wxhmxp", name: "WXHMXP", categoryId: "werte" },
    { id: "zhnmxp", name: "ZHNMXP", categoryId: "zehntel" },
    { id: "anlmxp", name: "ANLMXP", categoryId: "zehntel" },
    { id: "gzehntel", name: "Zehntel", categoryId: "guter" },
    { id: "gkrimi", name: "Krimi", categoryId: "guter" },
    { id: "ggramm", name: "Grammatik", categoryId: "guter" },
    { id: "glit", name: "Literatur", categoryId: "guter" },
    { id: "ghor", name: "Hörverstehen", categoryId: "guter" },
  ];

  for (const v of DEFAULT_VALUES) {
    await prisma.value.upsert({
      where: { id: v.id },
      update: {},
      create: v,
    });
  }

  return NextResponse.json({ ok: true, inserted: DEFAULT_VALUES.length });
}
