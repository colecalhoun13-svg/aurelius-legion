// core/operatorHelpers.ts

import { db } from "./db/prisma";
import type { EngineContext } from "./engineTypes";

export async function getOperatorIdByName(name: string): Promise<string> {
  const op = await db.operator.findUnique({
    where: { name },
  });

  if (!op) {
    throw new Error(`Operator '${name}' not found in DB. Did you run seedOperators?`);
  }

  return op.id;
}

export function buildEngineContext(operatorId: string): EngineContext {
  return {
    requestId: `req-${Date.now()}`,
    operatorId,
    timestamp: new Date().toISOString(),
    logger: {
      info: (msg, ctx) => console.log(`[INFO] ${msg}`, ctx),
      warn: (msg, ctx) => console.warn(`[WARN] ${msg}`, ctx),
      error: (msg, ctx) => console.error(`[ERROR] ${msg}`, ctx),
    },
    memory: {
      read: async () => null,
      write: async () => null,
      search: async () => [],
    },
    tools: {
      runTool: async () => null,
    },
    config: {
      environment: process.env.NODE_ENV === "production" ? "prod" : "dev",
    },
  };
}
