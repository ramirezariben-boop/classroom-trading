// app/api/admin/resnapshot/route.ts
import { NextResponse } from "next/server";
// import { doResnapshot } from "@/lib/tu-logica"; // si ya tienes una función real

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // TODO: aquí va tu lógica real de “resnapshot”.
    // const date = await doResnapshot();
    const date = new Date().toISOString().slice(0, 10); // placeholder
    return NextResponse.json({ ok: true, date });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
