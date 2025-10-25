// app/api/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookie = cookies().get("session_token");
    if (!cookie) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const decoded = jwt.verify(cookie.value, JWT_SECRET) as {
      id: number;
      name: string;
      role?: string;
    };

    return NextResponse.json({
      user: { id: decoded.id, name: decoded.name, role: decoded.role ?? "USER" },
    });
  } catch (err) {
    console.error("❌ Error en /api/session:", err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
