import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const hash = bcrypt.hashSync("BANK-001", 10);
  await prisma.user.upsert({
    where: { id: "Bank" },
    update: {},
    create: {
      id: "Bank",
      name: "Bank",
      codeHash: hash,
      points: 0,
    },
  });
  console.log("✅ Usuario Bank creado correctamente");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
