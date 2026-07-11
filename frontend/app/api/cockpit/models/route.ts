import { NextResponse } from "next/server";
import { prisma } from "../../../../../aurelius/core/db/prisma";

// Real telemetry — reads the same Postgres the backend writes.
export const dynamic = "force-dynamic";

// Context windows are provider constants (config, not telemetry).
const CONTEXT_WINDOWS: Record<string, number> = {
  anthropic: 1_000_000,
  openai: 128_000,
  groq: 131_072,
  gemini: 1_048_576,
  deepseek: 65_536,
  xai: 131_072,
};

export async function GET() {
  try {
    const rows = await prisma.logEntry.findMany({
      where: { type: "llm_call", createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { message: true, createdAt: true },
    });
    const seen = new Map<string, Date>();
    for (const r of rows) if (!seen.has(r.message)) seen.set(r.message, r.createdAt);
    return NextResponse.json(
      [...seen.entries()].map(([msg, last]) => {
        const [provider, ...rest] = msg.split("/");
        return {
          id: msg,
          name: rest.join("/") || msg,
          provider,
          contextWindow: CONTEXT_WINDOWS[provider] ?? 0,
          status: Date.now() - last.getTime() < 7 * 86400_000 ? "active" : "standby",
        };
      })
    );
  } catch {
    return NextResponse.json([]);
  }
}
