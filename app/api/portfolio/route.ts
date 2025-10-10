// app/api/portfolio/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { readSessionFromHeaders } from '../../../lib/auth'


export async function GET(req: Request) {
  try {
    const { uid } = readSessionFromHeaders(req.headers)

    const [user, positions, txs] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid } }),
      prisma.position.findMany({ where: { userId: uid } }),
      prisma.tx.findMany({
        where: { userId: uid },
        orderBy: { ts: 'desc' },
        take: 100,
      }),
    ])

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      points: Number(user.points),
      positions: positions.map((p) => ({
        userId: p.userId,
        valueId: p.valueId,
        qty: p.qty,
      })),
      txs: txs.map((t) => ({
        id: t.id,
        ts: t.ts.toISOString(),
        type: t.type,                 // 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT'
        valueId: t.valueId ?? undefined,
        qty: t.qty ?? undefined,
        deltaPts: Number(t.deltaPts),
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
