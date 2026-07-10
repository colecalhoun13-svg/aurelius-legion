// aurelius/knowledge/escalation.ts
//
// AUTONOMY ESCALATION — the opt-in matrix (NORTH_STAR §6 block 4).
//
// Hard rule: nothing auto-applies without opt-in. This is the opt-in:
// per operator, a list of intent-class ids Cole has granted standing
// auto-apply for, stored IN Living Knowledge (autonomy.auto_apply_intents)
// so granting/revoking flows through the same propose→confirm loop as
// everything else. Absent entry = nothing auto-applies (the default
// posture). Auto-applies are always surfaced on the Bridge — silent
// automation is forbidden even when authorized.

import { getKnowledge } from "./store.ts";

export const ESCALATION_SCOPE = "autonomy";
export const ESCALATION_KEY = "auto_apply_intents";

export async function getAutoApplyIntents(operatorId: string): Promise<string[]> {
  try {
    const entry = await getKnowledge(operatorId, ESCALATION_SCOPE, ESCALATION_KEY);
    if (Array.isArray(entry?.value) && entry.value.every((v: any) => typeof v === "string")) {
      return entry.value as string[];
    }
  } catch (err) {
    console.warn("[escalation] matrix lookup failed — defaulting to no auto-apply:", err);
  }
  return [];
}

/**
 * May this proposal auto-apply? Requires: intent class opted in, AND the
 * proposal isn't touching the escalation matrix itself (self-escalation
 * is never automatic, no matter what the matrix says).
 */
export async function isAutoApproved(
  operatorId: string,
  intentClassId: string,
  scope: string
): Promise<boolean> {
  if (scope === ESCALATION_SCOPE) return false;
  const opted = await getAutoApplyIntents(operatorId);
  return opted.includes(intentClassId);
}
