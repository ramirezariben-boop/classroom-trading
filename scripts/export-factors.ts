// scripts/export-factors.ts
import fs from "fs";
import path from "path";

// ✅ Importa directamente tu API local
import { GET } from "../app/api/factors-history/route";

// ⚙️ Ejecuta la función y guarda su salida en /public/factors-history.json
async function main() {
  const response = await GET();
  // @ts-ignore: el método .json() viene del NextResponse
  const data = await response.json();

  const outputPath = path.join(process.cwd(), "public", "factors-history.json");
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log("✅ Archivo factors-history.json actualizado en /public");
}

main().catch((err) => {
  console.error("❌ Error exportando factors-history.json:", err);
  process.exit(1);
});
