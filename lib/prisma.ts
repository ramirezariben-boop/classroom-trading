// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Usa un singleton para que en dev (y serverless) no se creen múltiples clientes
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
