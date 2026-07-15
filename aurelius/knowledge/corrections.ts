// aurelius/knowledge/corrections.ts
//
// CORRECTIONS CAPTURE — the trust loop's input. The Correction table has
// existed since Phase 4.5; this is the write path. A correction is
// EXPLICIT COLE ACTION, so it applies immediately (the propose→confirm
// gate exists to check Aurelius-initiated writes, not Cole's):
//
//   1. Correction row — the scoreboard's correction count is real now.
//   2. If it targets a knowledge entry and carries a replacement value,
//      the entry updates in place with cole_correction provenance.
//   3. A memory ("corrections" category) so recall learns the shape of
//      what Aurelius gets wrong.

import { prisma } from "../core/db/prisma.ts";

export type CorrectionInput = {
  targetType: "compiled_pattern" | "knowledge_entry" | "reasoning_output" | "bridge_signal" | "wiki_page";
  targetId: string;
  correctionType?: "value_wrong" | "pattern_wrong" | "context_wrong" | "should_have_asked";
  reason: string;
  after?: unknown; // replacement value, when Cole supplies one
  operatorName?: string;
};

export async function recordCorrection(input: CorrectionInput) {
  const { resolveOperatorId, setKnowledge } = await import("./store.ts");
  const operatorName = input.operatorName ?? "global";
  const operatorId = await resolveOperatorId(operatorName);

  // Snapshot what's being corrected, when we can find it.
  let before: unknown = null;
  let applied = false;

  if (input.targetType === "knowledge_entry") {
    const entry = await prisma.knowledgeEntry.findUnique({ where: { id: input.targetId } });
    before = entry?.value ?? null;
    if (entry && input.after !== undefined) {
      await setKnowledge({
        operatorId: entry.operatorId,
        scope: entry.scope,
        key: entry.key,
        value: input.after as any,
        sourceType: "cole_correction" as any,
        sourceId: input.targetId,
        rationale: input.reason,
        updatedBy: "cole",
      });
      applied = true;
    }
  } else if (input.targetType === "compiled_pattern") {
    const pattern = await prisma.compiledPattern.findUnique({ where: { id: input.targetId } });
    before = pattern?.patternSignature ?? null;
    if (pattern) {
      // A corrected pattern stops steering — kept as observation only.
      await prisma.compiledPattern.update({
        where: { id: input.targetId },
        data: { status: "discarded" },
      });
      applied = true;
    }
  } else if (input.targetType === "reasoning_output") {
    // Cole corrected a DECISION (not a specific rule) → the outcome loop decays
    // the patterns that informed it. Graded, not fatal: a rule that keeps landing
    // in corrected decisions falls below the trust floor and stops loading;
    // Cole's direct hand on a pattern (above) remains the outright kill.
    try {
      const { decayRecentlyFired } = await import("../compiled/outcomeLoop.ts");
      const n = await decayRecentlyFired({ reason: input.reason });
      if (n > 0) {
        applied = true;
        console.log(`[corrections] decayed ${n} pattern(s) that informed the corrected decision`);
      }
    } catch (err) {
      console.warn("[corrections] outcome decay failed (correction still recorded):", err);
    }
  }

  const row = await prisma.correction.create({
    data: {
      operatorId: operatorId ?? undefined,
      targetType: input.targetType,
      targetId: input.targetId,
      correctionType: input.correctionType ?? "value_wrong",
      before: before as any,
      after: (input.after ?? null) as any,
      reason: input.reason,
    },
  });

  // Recall learns from what got corrected.
  try {
    const { saveMemory } = await import("../memory/memoryService.ts");
    await saveMemory({
      operator: operatorName,
      category: "corrections",
      value: `Cole corrected ${input.targetType} — ${input.reason}`,
      relatedOperators: [],
      metadata: { correctionId: row.id, targetType: input.targetType, targetId: input.targetId },
    });
  } catch (err) {
    console.warn("[corrections] memory write failed (correction still recorded):", err);
  }

  console.log(`[corrections] ${input.targetType}/${input.targetId} — ${applied ? "applied" : "recorded"}`);
  return { correction: row, applied };
}

export async function listCorrections(limit = 20) {
  return prisma.correction.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
