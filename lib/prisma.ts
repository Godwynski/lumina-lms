import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton — safe for Next.js hot-reload in development.
 *
 * DATABASE_URL  → Supavisor connection pooler (port 6543, ?pgbouncer=true)
 *                  Used at runtime in serverless/edge environments.
 * DIRECT_URL    → Direct Postgres connection (port 5432)
 *                  Used by `prisma migrate` / `prisma db push` only.
 *
 * In development, we reuse a global instance across HMR cycles to avoid
 * exhausting the connection pool. In production a new instance is created once.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
