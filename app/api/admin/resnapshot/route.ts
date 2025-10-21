// app/api/admin/resnapshot/route.ts
import { NextResponse } from "next/server";
// import { doResnapshot } from "@/lib/whatever"; // si tienes una función real

export async function POST() {
  try {
    // const date = await doResnapshot(); // <-- llama aquí tu lógica real
    const date = new Date().toISOString().slice(0, 10); // placeholder
    return NextResponse.json({ ok: true, date });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

// si accedes a DB/FS, mejor evitar caché de Next en esta ruta
export const dynamic = "force-dynamic";
