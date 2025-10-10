// scripts/syncUsers.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const file = path.join(process.cwd(), 'data', 'users.json');
    const raw = fs.readFileSync(file, 'utf8');
    const list = JSON.parse(raw);

    if (!Array.isArray(list)) throw new Error('users.json debe ser un array');

    for (const u of list) {
      if (!u.id || !u.name || !u.code) {
        console.warn('Saltando registro inválido:', u);
        continue;
      }
      const codeHash = await bcrypt.hash(String(u.code), 10);
      const points = Number(u.points ?? 1000);
      await prisma.user.upsert({
        where: { id: String(u.id) },
        update: { name: String(u.name), points, codeHash },
        create: { id: String(u.id), name: String(u.name), points, codeHash },
      });
      console.log(`OK: ${u.id} (${u.name})`);
    }

    console.log('Sincronización terminada.');
  } catch (e) {
    console.error('Error:', e?.message || e);
    process.exit(1);
  } finally {
    // cierra conexión
    // eslint-disable-next-line no-unsafe-finally
    await new PrismaClient().$disconnect();
  }
}

main();
