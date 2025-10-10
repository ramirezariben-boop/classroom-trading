// app/api/trade/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { readSessionFromHeaders } from '../../../lib/auth'

type Mode = 'BUY' | 'SELL'

export async function POST(req: Request) {
  try {
    const { uid } = await readSessionFromHeaders();
    const { mode, valueId, qty, price } = await req.json()

    // Validaciones básicas
    if (!['BUY', 'SELL'].includes(mode)) {
      return NextResponse.json({ error: 'Modo inválido' }, { status: 400 })
    }
    if (!valueId || !qty || qty <= 0 || !price || price <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const nQty = Math.floor(Number(qty))
    const nPrice = Number(price)
    const deltaPts = Number((nPrice * nQty).toFixed(2)) * (mode === 'BUY' ? -1 : 1)

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: uid } })
      if (!user) throw new Error('404')

      const currentPts = Number(user.points)

      if (mode === 'BUY') {
        // Saldo suficiente
        if (currentPts + 1e-9 < -deltaPts) throw new Error('saldo')

        // Debita puntos
        await tx.user.update({
          where: { id: uid },
          data: { points: currentPts + deltaPts },
        })

        // Suma posición
        await tx.position.upsert({
          where: { userId_valueId: { userId: uid, valueId } },
          update: { qty: { increment: nQty } },
          create: { userId: uid, valueId, qty: nQty },
        })
      } else {
        // SELL
        const pos = await tx.position.findUnique({
          where: { userId_valueId: { userId: uid, valueId } },
        })
        if (!pos || pos.qty < nQty) throw new Error('pos')

        // Acredita puntos
        await tx.user.update({
          where: { id: uid },
          data: { points: currentPts + deltaPts },
        })

        // Resta posición (si llega a 0 la eliminamos opcionalmente)
        const newQty = pos.qty - nQty
        if (newQty > 0) {
          await tx.position.update({ where: { id: pos.id }, data: { qty: newQty } })
        } else {
          await tx.position.delete({ where: { id: pos.id } })
        }
      }

      // Registra transacción
      await tx.tx.create({
        data: {
          userId: uid,
          type: mode as Mode,
          valueId,
          qty: nQty,
          deltaPts,
        },
      })
    })

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message === "unauthorized" ? 401 : 500;
    return new Response(e?.message || "error", { status: msg });
  }
}