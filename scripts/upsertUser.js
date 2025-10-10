// scripts/upsertUser.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const [id, name, pointsStr, plainCode] = process.argv.slice(2);
  if (!id || !name || !pointsStr || !plainCode) {
    console.error('Uso: node scripts/upsertUser.js <id> <name> <points> <clave>');
    process.exit(1);
  }
  const points = Number(pointsStr);
  if (Number.isNaN(points)) {
    console.error('points debe ser un número');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const codeHash = await bcrypt.hash(plainCode, 10);
    const user = await prisma.user.upsert({
      where: { id },
      update: { name, points, codeHash },
      create: { id, name, points, codeHash },
    });
    console.log('OK:', { id: user.id, name: user.name, points: String(user.points) });
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

