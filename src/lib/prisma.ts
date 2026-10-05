import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type PrismaPgConfig = ConstructorParameters<typeof PrismaPg>[0];

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }

  const max = Number(process.env.DATABASE_POOL_MAX);
  const poolConfig: PrismaPgConfig = {
    connectionString,
    ...(Number.isFinite(max) && max > 0 ? { max } : {}),
  };

  return new PrismaClient({
    adapter: new PrismaPg(poolConfig),
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

// Cache on globalThis in every environment: each bundled copy of this module
// (route handlers, SSR chunks) would otherwise create its own pool. One shared
// client also keeps the connection count at 1, which the dev Postgres allows.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
