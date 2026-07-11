import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400_000);
    const [cacheEntries, patterns, llmCalls, cacheReuses] = await Promise.all([
      prisma.reasoningCacheEntry.count(),
      prisma.compiledPattern.count(),
      prisma.logEntry.count({ where: { type: "llm_call", createdAt: { gte: weekAgo } } }),
      prisma.reasoningCacheEntry.count({ where: { updatedAt: { gte: weekAgo }, createdAt: { lt: weekAgo } } }),
    ]);
    return NextResponse.json([
      { id: "compiled", timestamp: new Date().toISOString(), cacheEntries, patterns, llmCalls, cacheReuses },
    ]);
  } catch {
    return NextResponse.json([]);
  }
}
