// aurelius/compiled/mirror.ts
//
// MIRROR & MAILBOX — one feature (the council's centerpiece, Outsider's design).
//
// The outcome loop's negative wire was unplugged: recordCorrection's only
// callers were an HTTP endpoint and the smoke suite, while reinforcement ran
// every Sunday on silence. And when Cole DID correct, decay guessed an address.
// Both problems are the same missing feature:
//
//   MIRROR  — "why?" surfaces the rules that informed the last decision, in chat.
//   MAILBOX — replying "rule 2 is wrong" / "that was wrong" IS the correction,
//             recorded against exactly the rules he's looking at. No address
//             inference, no HTTP ritual. Mirror and mailbox are the same feature.
//
// The lens stays invisible in answers (Decision Mode unchanged) — provenance is
// pull-based: shown when Cole asks, never decorating the reply.
//
// Mirror context lives under scope="system" (never embedded, never recalled).

import { prisma } from "../core/db/prisma.ts";

const MIRROR_KEY = "mirror:last_shown";
const FIRED_MSG = "decision:patterns_fired";
const MIRROR_TTL_HOURS = 48;

const WHY_RE =
  /^\s*(why\??|why (did you|that)( say| recommend| call| answer)?( that| it)?\??|what (rules? )?informed (that|this|it)\??|show me (why|the rules)\??|what('s| is) behind (that|this)\??)\s*$/i;

/** "why?" — Cole is asking to see the rules behind the last decision. */
export function isWhyQuery(message: string): boolean {
  return WHY_RE.test(message ?? "");
}

const ORDINALS: Record<string, number> = {
  "1": 0, "2": 1, "3": 2, "4": 3, "5": 4,
  first: 0, second: 1, third: 2, fourth: 3, fifth: 4,
};

export type RuleCorrection =
  | { kind: "rule"; index: number } // 0-based index into the last-shown list
  | { kind: "decision" };

/**
 * Parse a correction reply. Conservative by design — a false positive files a
 * correction Cole didn't mean, which is worse than missing one (he can always
 * rephrase). Whole-decision corrections must be short and lead the message.
 */
export function parseRuleCorrection(message: string): RuleCorrection | null {
  const m = (message ?? "").trim();
  if (!m || m.length > 120) return null;

  const rule = m.match(
    /\b(?:rule|number)\s*#?(\d|first|second|third|fourth|fifth)\b[^.!?]{0,20}?\b(?:is|was|'s)?\s*(?:wrong|off|bad|outdated|dead)\b|\b(?:drop|kill|remove|retire|discard)\s+(?:rule|number)\s*#?(\d|first|second|third|fourth|fifth)\b/i
  );
  if (rule) {
    const key = (rule[1] ?? rule[2] ?? "").toLowerCase();
    const index = ORDINALS[key];
    if (index !== undefined) return { kind: "rule", index };
  }

  if (m.length <= 60 && /^(no[,.]?\s+)?(that|this)('s| was| is)?\s*(just\s+)?(wrong|a bad call|off|not right|a miss)\b/i.test(m)) {
    return { kind: "decision" };
  }
  return null;
}

const RATIFY_RE =
  /^(yes[,.]?\s+)?(good|great|solid|right) call\b[.!]?$|^that was (right|correct|spot[- ]on|the right call|a good call)\b[.!]?$|^you (were|got that) right\b[.!]?$/i;

/** Explicit ratification — the ONLY signal that raises trust (silence never does). */
export function parseRatification(message: string): boolean {
  const m = (message ?? "").trim();
  return m.length <= 60 && RATIFY_RE.test(m);
}

type MirrorContext = { patternIds: string[]; firedEventId: string; shownAt: string };

async function globalOperatorId(): Promise<string | null> {
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  return resolveOperatorId("global").catch(() => null);
}

async function saveMirrorContext(operatorId: string, ctx: MirrorContext): Promise<void> {
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId, scope: "system", key: MIRROR_KEY } },
    update: { value: ctx as any },
    create: {
      operatorId, scope: "system", key: MIRROR_KEY, value: ctx as any,
      sourceType: "mirror_context", createdBy: "system",
    },
  });
}

async function loadMirrorContext(operatorId: string): Promise<MirrorContext | null> {
  const row = await prisma.knowledgeEntry.findUnique({
    where: { operatorId_scope_key: { operatorId, scope: "system", key: MIRROR_KEY } },
  });
  const ctx = row?.value as MirrorContext | undefined;
  if (!ctx?.patternIds?.length || !ctx.shownAt) return null;
  const ageHours = (Date.now() - new Date(ctx.shownAt).getTime()) / 3600_000;
  return ageHours <= MIRROR_TTL_HOURS ? ctx : null;
}

function ruleText(sig: any): string {
  return sig && typeof sig === "object" && typeof sig.recurringReasoningTheme === "string"
    ? sig.recurringReasoningTheme.trim()
    : "";
}

function sourceLabel(sig: any): string {
  const s = sig && typeof sig === "object" && typeof sig.source === "string" ? sig.source : "";
  if (/cole/i.test(s)) return "from your own corrections";
  if (/curriculum:/i.test(s)) return `from study (${s.replace(/^curriculum:\s*/i, "")})`;
  return s || "compiled from experience";
}

/**
 * MIRROR: render the rules behind the most recent decision. Honest when there's
 * nothing to show — no fired event means the answer was reasoned fresh.
 */
export async function handleWhyQuery(): Promise<string> {
  const fired = await prisma.logEntry.findFirst({
    where: { type: "trace", message: FIRED_MSG, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { createdAt: "desc" },
  });
  const ids: string[] = ((fired?.context as any)?.patternIds ?? []).filter((v: any) => typeof v === "string");
  if (!fired || ids.length === 0) {
    return "No compiled rules informed a recent decision — that answer was reasoned fresh, not from the lens. Rules only load on real decision questions.";
  }

  const patterns = await prisma.compiledPattern.findMany({ where: { id: { in: ids } } });
  const byId = new Map(patterns.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof patterns;
  if (ordered.length === 0) {
    return "The rules behind that decision have since been retired — nothing left to show.";
  }

  const decision = ((fired.context as any)?.decision ?? "").toString().slice(0, 140);
  const lines = ordered.map((p, i) => {
    const trust = Math.round((p.confidenceScore ?? 0) * 100);
    return `${i + 1}. “${ruleText(p.patternSignature)}” — ${sourceLabel(p.patternSignature)} · trust ${trust}%`;
  });

  const operatorId = await globalOperatorId();
  if (operatorId) {
    await saveMirrorContext(operatorId, {
      patternIds: ordered.map((p) => p.id),
      firedEventId: fired.id,
      shownAt: new Date().toISOString(),
    });
  }

  return (
    `That call${decision ? ` (“${decision}”)` : ""} leaned on:\n\n${lines.join("\n")}\n\n` +
    `Reply “rule 2 is wrong” to retire one, or “that was wrong” if the whole call missed — either way I learn from it.`
  );
}

/**
 * MAILBOX: apply a correction reply against the rules Cole was just shown.
 * Returns the reply text, or null when the message isn't a correction (callers
 * fall through to the normal chat path). A named rule = Cole's direct hand =
 * discard outright; a whole-decision correction = graded decay of exactly the
 * shown set (or the fallback fired-set when nothing was shown).
 */
export async function handleCorrectionReply(message: string): Promise<string | null> {
  const parsed = parseRuleCorrection(message);
  if (!parsed) return null;

  const operatorId = await globalOperatorId();
  const ctx = operatorId ? await loadMirrorContext(operatorId) : null;
  const { recordCorrection } = await import("../knowledge/corrections.ts");

  if (parsed.kind === "rule") {
    if (!ctx) {
      return "I'm not sure which rule you mean — ask “why?” first and I'll show the rules behind the last call, numbered.";
    }
    const patternId = ctx.patternIds[parsed.index];
    if (!patternId) {
      return `The last mirror showed ${ctx.patternIds.length} rule(s) — there's no number ${parsed.index + 1}. Ask “why?” to see them again.`;
    }
    const pattern = await prisma.compiledPattern.findUnique({ where: { id: patternId } });
    await recordCorrection({
      targetType: "compiled_pattern",
      targetId: patternId,
      correctionType: "pattern_wrong",
      reason: message.slice(0, 300),
    });
    const text = pattern ? ruleText(pattern.patternSignature) : "";
    return `Retired${text ? `: “${text}”` : " that rule"}. It won't steer another decision — kept as an observation only.`;
  }

  // Whole-decision correction: decay exactly the shown set when a mirror is
  // live; otherwise the consumed-event fallback grades the latest fired-set.
  const res = await recordCorrection({
    targetType: "reasoning_output",
    targetId: ctx?.firedEventId ?? "chat_correction",
    correctionType: "value_wrong",
    reason: message.slice(0, 300),
    patternIds: ctx?.patternIds,
  });
  return res.applied
    ? "Noted — the rules that informed that call each lost trust. Ones that keep missing will stop loading entirely."
    : "Noted and recorded. No compiled rules were behind that call, so there was nothing to decay — but the correction still teaches the Sunday curriculum.";
}

/**
 * RATIFICATION reply ("good call") — the rules behind the decision earn
 * validated/ratified counters and a small trust raise. One-shot: uses the live
 * mirror context if shown (then clears it), else consumes the latest fired-set.
 * Returns null when the message isn't a ratification.
 */
export async function handleRatificationReply(message: string): Promise<string | null> {
  if (!parseRatification(message)) return null;

  const operatorId = await globalOperatorId();
  const ctx = operatorId ? await loadMirrorContext(operatorId) : null;
  const { ratifyPatterns, ratifyRecentDecision } = await import("./outcomeLoop.ts");

  let n = 0;
  if (ctx) {
    n = await ratifyPatterns({ patternIds: ctx.patternIds, note: message.slice(0, 120) });
    if (operatorId) {
      await prisma.knowledgeEntry.deleteMany({ where: { operatorId, scope: "system", key: MIRROR_KEY } });
    }
  } else {
    n = await ratifyRecentDecision({ note: message.slice(0, 120) });
  }
  return n > 0
    ? `Logged — ${n} rule${n === 1 ? "" : "s"} behind that call earned trust. That's how the lens sharpens.`
    : "Glad it landed — no compiled rules were behind that one, so nothing to credit. The win still counts.";
}
