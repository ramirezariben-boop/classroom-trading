import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const file = path.join(process.cwd(), "data", "users_utf8.csv");

    if (!fs.existsSync(file)) {
      return NextResponse.json({ error: "❌ El archivo no existe en el deployment." }, { status: 404 });
    }

    const content = fs.readFileSync(file, "utf8");
    return NextResponse.json({
      ok: true,
      preview: content.split("\n").slice(0, 10), // muestra primeras 10 líneas
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
