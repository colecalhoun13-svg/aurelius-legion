// aurelius/compiled/chatCompiler.ts
//
// CLOSE THE COMPILE LOOP IN THE MAIN BRAIN (NORTH_STAR §2 — compounding
// intelligence). The read side was already wired — buildSystemPrompt loads an
// operator's auto_factual + confirmed_heuristic patterns into every chat prompt
// (router.ts::loadOperatorPatternsForPrompt). But the WRITE side only fired in
// the training room: only training/reasoner.ts ran reasonWithCompilation →
// detectPatterns. So Aurelius surfaced patterns it never actually MINED from
// everyday conversation. This closes it: substantive chat turns write a
// reasoning-cache entry and run pattern detection, so a recurring KIND of
// exchange (≥3) compiles into a proposed heuristic Cole can confirm on the Bridge
// — after which it grounds future chat.
//
// Clustering is deliberately CONSERVATIVE and grounded in the existing engine
// (compiled/similarity.ts does per-tag exact matching; detector.ts gates on tag
// consistency AND reasoning-word overlap). A naive {operator} signature would lump
// every turn together and mint garbage, so we key on TOPIC:
//   • signature tags   = the turn's significant keywords → same-topic turns match,
//                        different topics don't.
//   • entityKey        = a deterministic topicKey → detectPatterns' upsert keeps
//                        each topic its OWN pattern instead of collapsing to one.
//   • factualThreshold = disabled for chat (no auto-facts); heuristics only, ≥3.
// The reasoning-consistency gate (detector.ts) then requires the ANSWERS to
// actually overlap, so coincidental-keyword turns don't compile.

import { prisma } from "../core/db/prisma.ts";
import { detectHeuristics } from "./detector.ts";
import type { TaggedSignature, CompiledPatternShape } from "./types.ts";

const MIN_INPUT = 16;
const MIN_ANSWER = 60;
const MIN_KEYWORDS = 2; // below this there's too little signal to cluster honestly

// Small stop-word list so topic keys form from content words, not filler.
const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "what", "when", "where", "which", "your", "you",
  "have", "has", "had", "was", "were", "are", "can", "could", "would", "should", "will", "about",
  "from", "into", "just", "like", "want", "need", "make", "made", "does", "did", "how", "why",
  "who", "get", "got", "give", "please", "tell", "know", "think", "there", "their", "them", "they",
  "some", "any", "all", "one", "two", "not", "but", "out", "our", "his", "her", "she", "him",
]);

function topicKeywords(input: string): string[] {
  return [
    ...new Set(
      input
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    ),
  ]
    .sort()
    .slice(0, 5);
}

function topicKey(keywords: string[]): string {
  return keywords.join("_") || "general";
}

/** Topic-tag signature: same-topic turns cluster, different topics don't. */
export function buildChatSignature(input: string): { sig: TaggedSignature; keywords: string[] } {
  const keywords = topicKeywords(input);
  const tags: Record<string, any> = {};
  for (const k of keywords) tags[k] = true;
  return { sig: { tags, fingerprint: `chat:${topicKey(keywords)}`, raw: input.slice(0, 400) }, keywords };
}

/**
 * Compile one chat exchange into the second brain's understanding. Fire-and-forget
 * from the caller — a compile step must never block or fail a reply.
 */
export async function compileFromChat(args: {
  operatorId: string;
  operatorName: string;
  input: string;
  answer: string;
}): Promise<void> {
  try {
    const input = (args.input ?? "").trim();
    const answer = (args.answer ?? "").trim();
    if (input.length < MIN_INPUT || answer.length < MIN_ANSWER) return;
    // Answers that ran a TOOL are live/state-dependent (today's tasks, a web
    // result) — the reasoning isn't a stable heuristic, so don't compile them.
    if (/\[TOOL:/i.test(answer)) return;

    const { sig, keywords } = buildChatSignature(input);
    if (keywords.length < MIN_KEYWORDS) return;
    const key = topicKey(keywords);

    // Direct create (not writeCache): writeCache auto-embeds the summary, but chat
    // clustering keys on topicKey + tags, not the answer embedding — so skip the
    // per-turn embedding cost (same efficiency choice as semanticReuse).
    await prisma.reasoningCacheEntry.create({
      data: {
        operatorId: args.operatorId,
        domain: "chat_compiled",
        entityKey: key,
        externalScopeId: "chat",
        subContext: args.operatorName,
        situationSignature: sig as any,
        reasoningSummary: answer.slice(0, 1500),
        sourceMemoryIds: [],
        usageCount: 0,
        previousTags: [],
      },
    });

    const detected = await detectHeuristics({
      operatorId: args.operatorId,
      domain: "chat_compiled",
      entityKey: key,
      signature: sig,
      heuristicThreshold: 3, // heuristics only — chat never auto-compiles facts
    });

    for (const p of detected) {
      if (p.status === "proposed_heuristic") await surfaceHeuristicForConfirm(p);
    }
  } catch (err) {
    console.warn("[chatCompiler] compile failed (non-fatal):", (err as any)?.message ?? err);
  }
}

/**
 * A newly proposed heuristic is INERT until confirmed (only auto_factual +
 * confirmed_heuristic ground reasoning). Surface it on the Bridge so Cole can
 * confirm with one tap — reusing the executor gate: pattern.confirm is an unknown
 * (non-grantable) class, so executeAction always GATES it to a pending confirm,
 * and the pattern.confirm finalizer flips it to confirmed on Cole's tap.
 * Deduped so a topic doesn't re-surface every turn.
 */
async function surfaceHeuristicForConfirm(p: CompiledPatternShape): Promise<void> {
  const sourceId = `pattern:${p.id}`;
  const already = await prisma.bridgeSignal.count({ where: { sourceType: "heuristic_confirm", sourceId } });
  if (already > 0) return;

  const theme = readTheme(p.patternSignature) || "a recurring way you think about this";
  const { executeAction } = await import("../autonomy/executor.ts");
  await executeAction({
    actionClass: "pattern.confirm",
    sourceType: "heuristic_confirm",
    sourceId,
    prepare: async () => ({
      title: "I think I've spotted a pattern",
      body:
        `After ${p.supportCount} similar exchanges, here's what I've learned holds:\n\n` +
        `“${theme}”\n\n` +
        `Confirm and I'll reason from it going forward. Ignore and it stays an observation, steering nothing.`,
      domain: "personal",
      payload: { patternId: p.id },
    }),
  });
}

function readTheme(sig: any): string {
  if (sig && typeof sig === "object" && typeof sig.recurringReasoningTheme === "string") {
    return sig.recurringReasoningTheme.trim();
  }
  return "";
}

/** Bridge-confirm finalizer target: a confirmed heuristic starts grounding chat. */
export async function confirmHeuristic(patternId: string): Promise<any> {
  if (!patternId) throw new Error("confirmHeuristic needs a patternId");
  return prisma.compiledPattern.update({
    where: { id: patternId },
    data: { status: "confirmed_heuristic" },
  });
}
