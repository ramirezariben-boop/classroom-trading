// app/api/transfer/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { readSessionFromHeaders } from '../../../lib/auth'


export async function POST(req: Request) {
  try {
    const { uid } = readSessionFromHeaders()
    const { toUserId, amount } = await req.json()

    const nAmount = Number(amount)
    if (!toUserId || !nAmount || nAmount <= 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    if (toUserId === uid) {
      return NextResponse.json({ error: 'No puedes transferirte a ti mismo' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      const from = await tx.user.findUnique({ where: { id: uid } })
      const to = await tx.user.findUnique({ where: { id: toUserId } })
      if (!from || !to) throw new Error('404')
      if (Number(from.points) < nAmount) throw new Error('saldo')

      await tx.user.update({ where: { id: uid }, data: { points: Number(from.points) - nAmount } })
      await tx.user.update({ where: { id: toUserId }, data: { points: Number(to.points) + nAmount } })

      await tx.transfer.create({ data: { fromId: uid, toId: toUserId, amount: nAmount } })
      await tx.tx.create({ data: { userId: uid, type: 'TRANSFER_OUT', deltaPts: -nAmount } })
      await tx.tx.create({ data: { userId: toUserId, type: 'TRANSFER_IN',  deltaPts:  nAmount } })
    })

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === "unauthorized" ? 401 : 500;
    return new Response(e?.message || "error", { status: code });
  }
}
