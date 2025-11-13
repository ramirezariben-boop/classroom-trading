import { NextResponse } from nextserver;
import { prisma } from @applibprisma;

export const runtime = nodejs;
export const dynamic = force-dynamic;

export async function POST(request Request) {
  try {
    const body = await request.json();

    const { id, points } = body;

    if (typeof id !== number  typeof points !== number) {
      return NextResponse.json({ ok false, error Datos inválidos });
    }

    const user = await prisma.user.update({
      where { id },
      data { points }
    });

    return NextResponse.json({ ok true, user });

  } catch (err) {
    console.error(❌ Error en apiupdate-points, err);
    return NextResponse.json({ ok false, error Error interno });
  }
}
