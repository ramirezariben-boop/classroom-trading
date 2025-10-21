// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Solo protege rutas /api/admin/**
  if (!pathname.startsWith("/api/admin/")) return NextResponse.next();

  // 1) Permitir Cron de Vercel (no puede enviar headers personalizados)
  //    Vercel envía esta cabecera automáticamente.
  if (req.headers.get("x-vercel-cron") === "1") return NextResponse.next();

  // 2) Checar SECRET por header o query (por comodidad)
  const provided =
    req.headers.get("x-admin-key") || searchParams.get("key") || "";
  const expected = process.env.ADMIN_KEY;

  if (!expected) {
    return new NextResponse("Server misconfigured: ADMIN_KEY is missing", {
      status: 500,
    });
  }

  // 3) En desarrollo, si no pones ADMIN_KEY, deja pasar (opcional)
  if (process.env.NODE_ENV !== "production" && !provided) {
    return NextResponse.next();
  }

  if (provided === expected) return NextResponse.next();

  return new NextResponse("Unauthorized", { status: 401 });
}

// Aplica SOLO a /api/admin/**
export const config = {
  matcher: ["/api/admin/:path*"],
};
