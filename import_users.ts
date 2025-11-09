// import_users.ts
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

async function main() {
  // 1️⃣ Leer el CSV y quitar encabezado
  const csv = fs.readFileSync("./data/users_utf8.csv", "utf8");
  const lines = csv.trim().split("\n").slice(1); // quita la primera línea (encabezado)

  // 2️⃣ Mapear a objetos
  const data = lines
    .map((line) => {
      const [id, name, day, user, password, points, nip] = line.split(",");
      if (!id || !name || !user) return null;
      return {
        id: Number(id.trim()), // usa tus IDs personalizados
        name: name.trim(),
        day: day?.trim() || null,
        user: user.trim(),
        password: password?.trim() || "",
        points: parseFloat(points) || 0,
        nip: nip?.trim() || null,
      };
    })
    .filter(Boolean);

  // 3️⃣ Insertar usuarios
  const result = await prisma.user.createMany({
    data,
    skipDuplicates: true, // no duplica usuarios
  });

  console.log(`✅ Importación completada. ${result.count} usuarios creados.`);
}

// 4️⃣ Ejecutar
main()
  .catch((err) => console.error("❌ Error en la importación:", err))
  .finally(() => prisma.$disconnect());
