import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Falta el nombre del alumno" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive", // no distingue mayúsculas/minúsculas
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    name: user.name,
    points: user.points,
  });
}
