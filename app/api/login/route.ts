// app/api/login/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs"; // opcional si quieres compatibilidad con codeHash

export async function POST(req: Request) {
  const { id, password: code } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: Number(id) },         // ⬅️ YA NO codeHash ni username
    select: { id: true, name: true, password: true /*, codeHash: true (si aún existiera)*/ },
  });

  if (!user) return NextResponse.json({ ok:false, error:"ID o clave incorrecta" }, { status: 401 });

  // Permite dos esquemas: password plano o (si existiera) codeHash
  const ok =
    (user.password && user.password === code) ||
    false; /* si aún tuvieras codeHash y quieres soportarlo:
              (user as any).codeHash && await bcrypt.compare(code, (user as any).codeHash)
            */

  if (!ok) return NextResponse.json({ ok:false, error:"ID o clave incorrecta" }, { status: 401 });

  // ...tu sesión/cookie/respuesta
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name } });
}
