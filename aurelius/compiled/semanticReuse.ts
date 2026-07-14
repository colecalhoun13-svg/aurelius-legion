// aurelius/compiled/semanticReuse.ts
//
// THE READ SIDE OF COMPILED UNDERSTANDING, SYSTEM-WIDE. Until now only
// training reasoning consulted the cache before spending an LLM call —
// chat and everything routed through runLLM paid full price every time,
// even for a question answered identically last Tuesday. This closes
// the loop: every reusable answer is cached with an embedding, and a
// sufficiently-similar repeat question (≥ SIMILARITY, within FRESH_DAYS)
// is served from compiled understanding instead of a model.
//
// Honesty guards: error text is never cached, thin exchanges are never
// cached, and a reuse announces itself (engine "compiled") in the call
// log — the scoreboard's llmDependenceRate falls only when this fires,
// which is exactly what that metric is for.

import { prisma } from "../core/db/prisma.ts";
import { semanticRecall } from "../retrieval/retrieve.ts";
import { embedSourceSafe } from "../retrieval/embedPipeline.ts";

const SIMILARITY = 0.93; // near-duplicate, not merely related
const FRESH_DAYS = 14;   // knowledge moves; stale conclusions don't serve
const MIN_QUESTION = 12; // chars — below this, matching is noise
const MIN_ANSWER = 40;   // don't compile one-word replies

function engineUnavailableText(text: string): boolean {
  // Match every engine's keyless string ("<PROVIDER>_API_KEY is not configured.",
  // "Anthropic engine is not configured.") and the all-down line — but NOT a
  // legitimate "your calendar is not configured" answer (Aurelius is
  // dormant-until-configured by design), so anchor to _API_KEY / "engine".
  return /_API_KEY is not configured|engine is not configured|Missing .*_API_KEY|All configured LLM providers failed/i.test(text);
}

/** Only these task types are semantically re-servable — never realtime. */
const REUSABLE_TASK_TYPES = new Set(["chat", "summary", "analysis", "quick_reply"]);

export function isReusableTask(taskType: string, task: { needsRealtime?: boolean; hasMultimodal?: boolean }): boolean {
  return REUSABLE_TASK_TYPES.has(taskType) && !task.needsRealtime && !task.hasMultimodal;
}

/**
 * Check compiled understanding before spending an LLM call. A hit bumps
 * usageCount (and updatedAt — the scoreboard's cacheReuse numerator).
 */
export async function tryReuseAnswer(args: {
  operatorId: string;
  input: string;
}): Promise<{ text: string; cacheId: string; similarity: number } | null> {
  try {
    if (args.input.trim().length < MIN_QUESTION) return null;
    const hits = await semanticRecall({
      query: args.input,
      limit: 3,
      sourceTypes: ["reasoning_cache"],
    });
    const top = hits[0];
    if (!top || top.similarity < SIMILARITY) return null;

    const entry = await prisma.reasoningCacheEntry.findUnique({ where: { id: top.sourceId } });
    if (!entry || entry.domain !== "chat_reuse") return null; // training cache has its own reader
    // Operator isolation: recall isn't scoped by operator, so a near-duplicate
    // question could surface ANOTHER operator's cached answer. Only reuse this
    // operator's own compiled understanding.
    if (entry.operatorId !== args.operatorId) return null;
    if (Date.now() - entry.createdAt.getTime() > FRESH_DAYS * 86400_000) return null;

    // Summary is stored as "Q: ...\nA: ..." — serve only the answer.
    const answer = entry.reasoningSummary.replace(/^Q:[\s\S]*?\nA:\s*/, "").trim();
    if (!answer || engineUnavailableText(answer)) return null;

    await prisma.reasoningCacheEntry.update({
      where: { id: entry.id },
      data: { usageCount: { increment: 1 } }, // updatedAt bumps → scoreboard sees the reuse
    });
    return { text: answer, cacheId: entry.id, similarity: top.similarity };
  } catch (err) {
    console.warn("[compiled] reuse lookup failed (non-fatal):", (err as any)?.message ?? err);
    return null;
  }
}

/**
 * After a real LLM answer, compile it for future reuse. Fire-and-forget
 * by callers — a cache write never blocks a reply.
 */
export async function recordAnswer(args: {
  operatorId: string;
  operatorName: string;
  taskType: string;
  input: string;
  answer: string;
}): Promise<void> {
  if (args.input.trim().length < MIN_QUESTION) return;
  if (args.answer.trim().length < MIN_ANSWER) return;
  if (engineUnavailableText(args.answer)) return; // never file error text as knowledge
  // Never cache an answer that ran a TOOL — its content is live/state-dependent
  // (today's tasks, a web result, an inbox). Re-serving the frozen prose 14 days
  // later would hand back stale data. Only pure-reasoning answers are reusable.
  if (/\[TOOL:/i.test(args.answer)) return;

  // Direct create (not writeCache): writeCache auto-embeds the summary,
  // but reuse must match QUESTION-to-question — embedding the Q+A blob
  // would put the similarity gate out of reach for real paraphrases.
  const entry = await prisma.reasoningCacheEntry.create({
    data: {
      operatorId: args.operatorId,
      domain: "chat_reuse",
      entityKey: args.operatorName,
      externalScopeId: "runLLM",
      situationSignature: {
        tags: { taskType: args.taskType, operator: args.operatorName },
        fingerprint: `chat:${args.operatorName}:${args.input.slice(0, 80).toLowerCase()}`,
        raw: { input: args.input.slice(0, 500) },
      },
      reasoningSummary: `Q: ${args.input.slice(0, 500)}\nA: ${args.answer.slice(0, 3000)}`,
      sourceMemoryIds: [],
      usageCount: 0,
      previousTags: [],
    },
  });
  embedSourceSafe({
    sourceType: "reasoning_cache",
    sourceId: entry.id,
    text: args.input.slice(0, 2000), // the QUESTION is the retrieval key
    operatorId: args.operatorId,
    domain: "chat_reuse",
  });
}
