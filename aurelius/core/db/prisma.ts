// core/db/prisma.ts
// Aurelius OS v3.4 — Prisma Client (Neon)

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __AURELIUS_PRISMA__: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__AURELIUS_PRISMA__) {
    global.__AURELIUS_PRISMA__ = new PrismaClient();
  }
  prisma = global.__AURELIUS_PRISMA__;
}

export const db = prisma;
export { prisma };

// ─────────────────────────────────────────────────────────────────────────
// NEON COLD START — the documented prod DB (Neon) sleeps after inactivity. The
// first query after idle throws P1001 ("can't reach database server") before
// the connection wakes. The always-on spine (06:00 RSS, every-15-min calendar,
// every-10-min paperless) and the first app open of the day would hard-fail on
// that single cold hit. Two guards:
//   • warmupDb()  — fire a cheap SELECT with retries on boot so the pool is warm.
//   • withDb(fn)  — retry a query a few times on connection-class errors, so a
//                   cold hit self-heals within the same request instead of 500ing.
// Both are no-ops against a healthy DB (local sandbox, warm Neon).

const CONNECTION_ERROR = /P1001|P1002|P1008|P1017|can't reach database|connection.*(closed|refused|reset|timeout)|ECONNREFUSED|ETIMEDOUT/i;

function isConnectionError(err: any): boolean {
  const code = err?.code ?? "";
  const msg = err?.message ?? String(err);
  return CONNECTION_ERROR.test(code) || CONNECTION_ERROR.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run a DB op, retrying only connection-class failures (cold Neon), not logic errors. */
export async function withDb<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isConnectionError(err) || i === attempts - 1) throw err;
      const wait = 400 * (i + 1);
      console.warn(`[db] connection error (waking, retry ${i + 1}/${attempts - 1} in ${wait}ms): ${(err as any)?.message ?? err}`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/** Wake the DB on boot so the first real query doesn't eat the cold-start throw. */
export async function warmupDb(): Promise<void> {
  try {
    await withDb(() => prisma.$queryRaw`SELECT 1`, 5);
    console.log("[db] warm");
  } catch (err) {
    console.warn(`[db] warmup failed (will retry lazily): ${(err as any)?.message ?? err}`);
  }
}
