import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const adapter = new PrismaPg({
  connectionString,
  // Every interactive $transaction pins one connection for its whole duration
  // and pg-pool queues the rest behind `connectionTimeoutMillis`, so a tiny
  // pool turns a handful of concurrent writes into "timeout exceeded when
  // trying to connect" errors. Tune per deployment (keep it under the DB /
  // pooler connection limit divided by the number of server instances).
  max: positiveInt(process.env.DB_POOL_MAX, 10),

  // Connection timeout (also bounds the wait for a free pooled connection)
  connectionTimeoutMillis: 5000,

  // How long an unused connection stays open. Opening a new one (TCP + TLS +
  // auth to the pooler) costs far more than a query — 0.5–1 s when the DB is
  // in another region — so with 10 s every action after a short pause paid
  // that again. Default 5 min; tune with DB_IDLE_TIMEOUT_MS.
  idleTimeoutMillis: positiveInt(process.env.DB_IDLE_TIMEOUT_MS, 300_000),
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,

    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
