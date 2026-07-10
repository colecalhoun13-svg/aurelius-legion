// aurelius/measurement/operatorScore.ts
//
// OPERATOR SCORE (OG doc Part IX) + PERSONALITY MODES (Part II).
//
// One weighted, deterministic number for how Cole is operating, with the
// breakdown, insights, and the mode it puts Aurelius in. Weights are the
// OG doc's: completion 40 · balance 20 · consistency 20 · priority 10 ·
// recovery 10. The score TRIGGERS the mode (90+ Tactical, 75+ Mentor,
// 60+ Commander, 40+ Stoic, else Accountability); Cole can override any
// time via Living Knowledge (persona.mode_override) — his word beats
// the math, per the invariants.

import { prisma } from "../core/db/prisma.ts";
import { getKnowledge, resolveOperatorId } from "../knowledge/store.ts";

export type OperatorMode = "tactical" | "mentor" | "commander" | "stoic" | "accountability";

export type OperatorScore = {
  score: number;
  mode: OperatorMode;
  modeSource: "score" | "cole_override";
  components: {
    taskCompletion: number;   // /40
    categoryBalance: number;  // /20
    consistency: number;      // /20
    priorityAlignment: number; // /10
    recoveryLoad: number;     // /10
  };
  insights: string[];
  daysMeasured: number;
};

const MODE_GUIDANCE: Record<OperatorMode, string> = {
  tactical: "Mode: TACTICAL. Cole is executing. Sharp, brief, dry wit allowed. Match his tempo; don't slow him down.",
  mentor: "Mode: MENTOR. Solid week with soft spots. Offer clarity and one refinement at a time; teach, don't lecture.",
  commander: "Mode: COMMANDER. Drift detected. Be direct about what's slipping and issue clear next moves. Pressure, with respect.",
  stoic: "Mode: STOIC. The week is heavy. Calm, grounded, no wit. Reduce to what matters; steady the line.",
  accountability: "Mode: ACCOUNTABILITY. Follow-through has collapsed. Surgical honesty about the gap between stated intent and action. No flattery, no filler — name it and give the single first step back.",
};

function modeFromScore(score: number): OperatorMode {
  if (score >= 90) return "tactical";
  if (score >= 75) return "mentor";
  if (score >= 60) return "commander";
  if (score >= 40) return "stoic";
  return "accountability";
}

export async function computeOperatorScore(): Promise<OperatorScore> {
  const now = Date.now();
  const week = new Date(now - 7 * 24 * 3600 * 1000);
  const window = { gte: week };

  const [done, created, habits, habitDone, gaps] = await Promise.all([
    prisma.task.findMany({
      where: { status: "done", completedAt: window },
      select: { domain: true, priority: true, completedAt: true },
    }),
    prisma.task.count({ where: { createdAt: window } }),
    prisma.habit.count({ where: { active: true } }),
    prisma.habitCompletion.count({ where: { completedAt: window } }),
    prisma.intentActionGap.findMany({ where: { windowStart: window }, select: { gapScore: true } }),
  ]);

  const insights: string[] = [];

  // 1. Task completion (40) — follow-through when measured, else done-vs-created
  let completionRatio: number;
  if (gaps.length >= 2) {
    completionRatio = 1 - gaps.reduce((s, g) => s + g.gapScore, 0) / gaps.length;
  } else {
    const denominator = Math.max(created, done.length, 1);
    completionRatio = Math.min(1, done.length / denominator);
  }
  const taskCompletion = Math.round(completionRatio * 40);
  if (completionRatio < 0.5) insights.push("More than half of stated intent didn't convert to action this week.");

  // 2. Category balance (20) — entropy of done-task domains vs uniform
  const byDomain = new Map<string, number>();
  for (const t of done) byDomain.set(t.domain, (byDomain.get(t.domain) ?? 0) + 1);
  let categoryBalance = 10; // neutral when too little data
  if (done.length >= 4 && byDomain.size >= 1) {
    const probs = [...byDomain.values()].map((n) => n / done.length);
    const entropy = -probs.reduce((s, p) => s + p * Math.log2(p), 0);
    const maxEntropy = Math.log2(Math.max(byDomain.size, 2));
    categoryBalance = Math.round((entropy / maxEntropy) * 20);
    const [topDomain, topCount] = [...byDomain.entries()].sort((a, b) => b[1] - a[1])[0]!;
    if (topCount / done.length > 0.75 && byDomain.size > 1)
      insights.push(`${Math.round((topCount / done.length) * 100)}% of completions were ${topDomain} — other lanes idled.`);
  }

  // 3. Consistency (20) — distinct active days of the last 7
  const activeDays = new Set(done.map((t) => t.completedAt!.toISOString().slice(0, 10))).size;
  const consistency = Math.round((activeDays / 7) * 20);
  if (activeDays <= 2 && done.length > 0) insights.push("Work clustered into 1-2 days — the week wasn't paced.");

  // 4. Priority alignment (10) — share of completions that were high/critical
  const highDone = done.filter((t) => t.priority === "high" || t.priority === "critical").length;
  const priorityAlignment = done.length > 0 ? Math.round((highDone / done.length) * 10) : 5;
  if (done.length >= 4 && highDone === 0) insights.push("Completions were all low-priority — the important work didn't move.");

  // 5. Recovery & load (10) — habit adherence as the recovery proxy
  const habitTarget = habits * 7;
  const recoveryLoad = habitTarget > 0 ? Math.round(Math.min(1, habitDone / habitTarget) * 10) : 5;
  if (habitTarget > 0 && habitDone / habitTarget < 0.4) insights.push("Habits under 40% — the base layer is eroding.");

  const score = Math.max(0, Math.min(100, taskCompletion + categoryBalance + consistency + priorityAlignment + recoveryLoad));

  // Mode: Cole's override wins over the math, always.
  let mode = modeFromScore(score);
  let modeSource: "score" | "cole_override" = "score";
  try {
    const globalOp = await resolveOperatorId("strategy");
    if (globalOp) {
      const override = await getKnowledge(globalOp, "persona", "mode_override");
      const v = typeof override?.value === "string" ? override.value.toLowerCase() : null;
      if (v && v in MODE_GUIDANCE) {
        mode = v as OperatorMode;
        modeSource = "cole_override";
      }
    }
  } catch {
    // override lookup is best-effort
  }

  return {
    score,
    mode,
    modeSource,
    components: { taskCompletion, categoryBalance, consistency, priorityAlignment, recoveryLoad },
    insights,
    daysMeasured: gaps.length,
  };
}

/** The prompt layer — one compact block for buildSystemPrompt. */
export async function getModePromptBlock(): Promise<string> {
  try {
    const s = await computeOperatorScore();
    return [
      `═══ OPERATOR STATE ═══`,
      `Operator Score: ${s.score}/100 (completion ${s.components.taskCompletion}/40 · balance ${s.components.categoryBalance}/20 · consistency ${s.components.consistency}/20 · priority ${s.components.priorityAlignment}/10 · recovery ${s.components.recoveryLoad}/10)${s.modeSource === "cole_override" ? " · mode set by Cole" : ""}`,
      MODE_GUIDANCE[s.mode],
      ...(s.insights.length ? [`Signals: ${s.insights.join(" ")}`] : []),
    ].join("\n");
  } catch (err) {
    console.warn("[operatorScore] mode block failed (non-fatal):", err);
    return "";
  }
}
