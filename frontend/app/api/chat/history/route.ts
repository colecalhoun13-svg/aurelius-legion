import { NextResponse } from "next/server";

// DB-backed — always live.
export const dynamic = "force-dynamic";

// GET → the recent conversation, oldest-first, so the chat screen survives
// restarts. The turns were ALWAYS persisted (ConversationTurn is how Aurelius
// keeps its own continuity) — the screen just never asked for them.
export async function GET() {
  try {
    const { prisma } = await import("../../../../../aurelius/core/db/prisma");
    const turns = await prisma.conversationTurn.findMany({
      orderBy: { createdAt: "desc" },
      take: 60, // ~30 exchanges — continuity without dumping months of scroll
      select: { role: true, content: true, createdAt: true },
    });
    const messages = turns.reverse().map((t: any) => ({
      role: t.role === "cole" ? "user" : "aurelius",
      content: t.content,
      at: t.createdAt,
    }));
    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("Chat history API error:", error);
    return NextResponse.json({ error: error?.message ?? "failed to load history" }, { status: 500 });
  }
}
