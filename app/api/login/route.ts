import { NextResponse } from "next/server";
import { signSession } from "../../../lib/auth";
// Si usas Prisma, descomenta y ajusta:
// import { prisma } from "../../../lib/prisma";

const ADMINS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export async function POST(req: Request) {
  try {
    const { userId, code } = await req.json();

    // TODO: valida credenciales reales; por ahora aceptamos cualquier combo no vacío
    if (!userId || !code) {
      return new NextResponse("missing credentials", { status: 400 });
    }

    // Si usas una tabla de usuarios:
    // const user = await prisma.user.findUnique({ where: { id: userId } });
    // if (!user) return new NextResponse("invalid user", { status: 401 });

    const role: "ADMIN" | "USER" = ADMINS.includes(userId) ? "ADMIN" : "USER";
    const user = { id: userId, name: userId }; // placeholder si no lees de BD

    // 1) arma la respuesta JSON
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, role }, // la UI necesita el role
    });

    // 2) firma sesión y agrega cookie a la respuesta
    signSession(res, { uid: user.id, role });

    // 3) devuelve la respuesta (con cookie)
    return res;
  } catch (e) {
    return new NextResponse("error", { status: 500 });
  }
}
