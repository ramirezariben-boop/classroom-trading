import { PrismaClient } from "@prisma/client";

const SOURCE_URL = process.env.SOURCE_URL!;
const TARGET_URL = process.env.TARGET_URL!;

if (!SOURCE_URL || !TARGET_URL) {
  console.error("Faltan SOURCE_URL o TARGET_URL");
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } });
const target = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });

async function main() {
  const users = await source.user.findMany();
  console.log(`Encontrados ${users.length} usuarios en SOURCE`);

  let created = 0, updated = 0;
  for (const u of users) {
    // upsert por name (ajusta si tienes otra clave única)
    const prev = await target.user.findFirst({ where: { name: u.name } });
    if (prev) {
      await target.user.update({
        where: { id: prev.id },
        data: {
          codeHash: u.codeHash,
          day: u.day ?? prev.day,
          points: u.points ?? prev.points,
        },
      });
      updated++;
    } else {
      await target.user.create({
        data: {
          name: u.name,
          codeHash: u.codeHash,
          day: u.day ?? null,
          points: u.points ?? 0,
        },
      });
      created++;
    }
  }

  console.log({ created, updated });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
