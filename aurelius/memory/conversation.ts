// aurelius/memory/conversation.ts
//
// CONVERSATION CONTINUITY. Chat turns persist, and the most recent ones
// flow back into the next prompt (Layer 5.25) — so "like we discussed"
// works across restarts, devices, and days. Long-term meaning still
// lives in memories/knowledge; this layer is the short-term thread the
// research keeps calling the missing piece: without it, every context
// reset replays the same failures.

import { prisma } from "../core/db/prisma.ts";

/** Fire-and-forget — persisting the thread never blocks the reply. */
export function recordTurns(args: {
  coleMessage: string;
  aureliusReply: string;
  operatorName?: string;
  engine?: string;
}) {
  // Stamp explicit timestamps 1ms apart. createMany with @default(now()) can give
  // both rows an identical createdAt, and recentConversationBlock orders by
  // createdAt alone — so Cole's turn and the reply could render out of order
  // ("You:" before "Cole:"). The 1ms gap makes the pair's order deterministic.
  const t0 = new Date();
  prisma.conversationTurn
    .createMany({
      data: [
        { role: "cole", content: args.coleMessage.slice(0, 4000), operatorName: args.operatorName, createdAt: t0 },
        {
          role: "aurelius",
          content: args.aureliusReply.slice(0, 4000),
          operatorName: args.operatorName,
          engine: args.engine,
          createdAt: new Date(t0.getTime() + 1),
        },
      ],
    })
    .catch((err) => console.warn("[conversation] persist failed (reply unaffected):", err?.message ?? err));
}

/**
 * The last few turns inside the window, oldest→newest, trimmed for
 * prompt injection. Empty string when there's nothing recent — the
 * layer simply doesn't render.
 */
export async function recentConversationBlock(maxTurns = 6, windowHours = 48): Promise<string> {
  const turns = await prisma.conversationTurn.findMany({
    where: { createdAt: { gte: new Date(Date.now() - windowHours * 3600_000) } },
    orderBy: { createdAt: "desc" },
    take: maxTurns,
  });
  if (turns.length === 0) return "";
  const lines = turns
    .reverse()
    .map((t) => `${t.role === "cole" ? "Cole" : "You"}: ${t.content.slice(0, 500)}`);
  return [
    "═══ RECENT CONVERSATION (continuity — do not re-ask what's answered here) ═══",
    ...lines,
  ].join("\n");
}
