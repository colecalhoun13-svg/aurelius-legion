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
