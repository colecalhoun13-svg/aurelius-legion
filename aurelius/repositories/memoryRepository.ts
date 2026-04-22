/**
 * repositories/memoryRepository.ts
 * Aurelius OS v3.4 — Memory repository (Phase 4)
 */

import { prisma } from "../core/db/prisma";

export async function saveMemory(params: {
  operatorId: string;
  category: string;
  value: string;
  metadata?: Record<string, any>;
}) {
  return prisma.memory.create({
    data: {
      operatorId: params.operatorId,
      category: params.category,
      value: params.value,
      metadata: params.metadata ?? {}
    }
  });
}

export async function getMemoriesByCategory(operatorId: string, category: string) {
  return prisma.memory.findMany({
    where: { operatorId, category },
    orderBy: { updatedAt: "desc" }
  });
}

export async function searchMemories(operatorId: string, query: string) {
  return prisma.memory.findMany({
    where: {
      operatorId,
      OR: [
        { value: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } }
      ]
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getMemoryTimeline(operatorId: string) {
  return prisma.memory.findMany({
    where: { operatorId },
    orderBy: { updatedAt: "desc" }
  });
}
