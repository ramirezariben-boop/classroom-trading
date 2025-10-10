// scripts/seed.ts
import { prisma } from '../lib/prisma'
import bcrypt from 'bcrypt'

async function main() {
  const alumnos = [
    { id: 'ana01', name: 'Ana', code: 'GATO-92' },
    { id: 'luis03', name: 'Luis', code: 'SOL-18' },
    // agrega más...
  ]

  for (const a of alumnos) {
    const hash = await bcrypt.hash(a.code, 10)
    await prisma.user.upsert({
      where: { id: a.id },
      update: { name: a.name, codeHash: hash },
      create: { id: a.id, name: a.name, codeHash: hash },
    })
  }
  console.log('Seed ok')
}

main().finally(() => prisma.$disconnect())
