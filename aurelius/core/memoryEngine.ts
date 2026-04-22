// core/memoryEngine.ts
// Aurelius OS v3.4 — Memory helpers (DB-backed)

import { db } from "./db/prisma.ts";
import type { Memory } from "@prisma/client";

export async function readMemory(operatorId: string): Promise<Memory[]> {
  return db.memory.findMany({
    where: { operatorId },
    orderBy: { createdAt: "asc" },
  });
}

export async function writeMemory(
  operatorId: string,
  updates: Record<string, any>
): Promise<Memory[]> {
  const entries: { category: string; value: string; metadata?: any }[] = [];

  for (const [category, value] of Object.entries(updates)) {
    entries.push({
      category,
      value: typeof value === "string" ? value : JSON.stringify(value),
      metadata: typeof value === "object" ? value : undefined,
    });
  }

  await db.$transaction(
    entries.map((e) =>
      db.memory.create({
        data: {
          operatorId,
          category: e.category,
          value: e.value,
          metadata: e.metadata,
        },
      })
    )
  );

  return readMemory(operatorId);
}
