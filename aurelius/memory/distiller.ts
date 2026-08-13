// aurelius/memory/distiller.ts
//
// NIGHTLY CONVERSATION DISTILLER (NORTH_STAR #59) — "actually remembers the
// past 48h."
//
// ConversationTurn rows are the raw chat log; recentConversationBlock injects
// the last few verbatim for short-term continuity. But raw turns age out of
// that window fast, and nothing ever CONDENSED them into durable memory — so a
// decision made or a preference revealed in yesterday's chat was gone by the
// day after. This job reads the last day-or-two of turns once a night and
// distills the parts that will still matter in a week into a Memory row, which
// the semantic-recall layer then surfaces long after the raw turns scroll off.
//
// Honest + bounded: it de-dups against its own last run (never re-distilling a
// window), refuses to run on too-few turns, and NEVER files model-error text as
// memory (hard rule 3). Inward: it writes one memory, nothing outward.

import { prisma } from "../core/db/prisma.ts";

const WINDOW_MS = 48 * 3600_000;
const MIN_TURNS = 4; // below this there's nothing worth condensing
const MAX_TURNS = 200; // bound the transcript we feed the model
const CATEGORY = "conversation_distillation";

export type DistillResult = {
  ran: boolean;
  reason: string;
  turns?: number;
  savedMemoryId?: string;
};

export async function distillRecentConversation(now = new Date()): Promise<DistillResult> {
  // Start where the last distillation left off, but never reach back past the
  // window — so a long quiet gap doesn't drag in stale turns, and a same-night
  // re-run finds nothing new instead of re-summarizing.
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const last = await prisma.memory
    .findFirst({ where: { category: CATEGORY }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
    .catch(() => null);
  const since = last?.createdAt && last.createdAt > windowStart ? last.createdAt : windowStart;

  const turns = await prisma.conversationTurn.findMany({
    where: { createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    take: MAX_TURNS,
    select: { role: true, content: true },
  });
  if (turns.length < MIN_TURNS) {
    return { ran: false, reason: `only ${turns.length} new turn(s) since last distillation — nothing worth condensing`, turns: turns.length };
  }

  const transcript = turns
    .map((t) => `${t.role === "cole" ? "Cole" : "Aurelius"}: ${t.content}`)
    .join("\n")
    .slice(0, 12000);

  const { runLLM } = await import("../llm/runLLM.ts");
  const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
  const res = await runLLM({
    taskType: "summary",
    operator: "strategy",
    noReuse: true,
    omitToolCatalog: true,
    input:
      `Distill the last day or two of conversation between Cole and you (Aurelius) into what will STILL matter in a week. ` +
      `Keep: decisions made, commitments, preferences revealed, unresolved threads, things to follow up on. ` +
      `Drop pleasantries, transient chatter, and anything already acted on. Write 3-8 tight bullets, no preamble, ` +
      `each a durable fact or open thread stated plainly.\n\nTRANSCRIPT:\n${transcript}`,
  });
  const value = (res.text ?? "").trim();
  // Never file an engine error as a "memory" — it would poison recall (hard rule 3).
  if (!value || value.length < 20 || engineUnavailableText(value)) {
    return { ran: false, reason: "no usable distillation (engine error or empty) — nothing saved", turns: turns.length };
  }

  const { saveMemory } = await import("./memoryService.ts");
  const saved = await saveMemory({
    operator: "strategy",
    category: CATEGORY,
    value,
    metadata: { turns: turns.length, windowHours: 48, distilledAt: now.toISOString() },
  });

  console.log(`[distiller] condensed ${turns.length} turns → 1 memory${saved?.id ? ` (${saved.id})` : ""}`);
  return { ran: true, reason: "distilled", turns: turns.length, savedMemoryId: saved?.id };
}
