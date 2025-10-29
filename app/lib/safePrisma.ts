import { prisma } from "./prisma";

/**
 * Ejecuta una operación Prisma con manejo automático de reconexión.
 * Si ocurre un error de conexión (cerrada, perdida o timeout),
 * intenta desconectarse y reconectarse antes de reintentar la operación.
 *
 * Ideal para entornos como Neon, donde las conexiones pueden dormirse.
 */
export async function safePrisma<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const message = err?.message || "";
    const code = err?.code || "";

    const isConnError =
      message.includes("connection") ||
      message.includes("Closed") ||
      message.includes("timeout") ||
      code === "P1001" ||
      code === "P1002";

    if (isConnError) {
      console.warn("🔁 Prisma reconectando tras error de conexión...");
      try {
        await prisma.$disconnect();
        await prisma.$connect();
      } catch (reconnectErr) {
        console.error("⛔ Error durante reconexión Prisma:", reconnectErr);
        throw reconnectErr;
      }

      // 🔄 Reintentar la operación original
      try {
        const retry = await fn();
        console.log("✅ Prisma reconectado correctamente.");
        return retry;
      } catch (retryErr) {
        console.error("⚠️ Error al reintentar operación tras reconexión:", retryErr);
        throw retryErr;
      }
    }

    // Si el error no está relacionado con la conexión, relanzarlo
    throw err;
  }
}
