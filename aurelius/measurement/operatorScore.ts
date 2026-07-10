// aurelius/measurement/operatorScore.ts
//
// OPERATOR SCORE — one weighted, deterministic read on how Cole is
// operating (OG doc Part IX weights: completion 40 · balance 20 ·
// consistency 20 · priority 10 · recovery 10), with insights that name
// what's dragging.
//
// NO MODES. Cole's call: one voice, always — the register modulates
// naturally from (a) this live state and (b) what Aurelius has LEARNED
// about how Cole wants to be spoken to (persona.* entries in Living
// Knowledge, each one confirmed by Cole through propose→confirm).
// The voice never announces a shift and never switches personas.

import { prisma } from "../core/db/prisma.ts";
import { resolveOperatorId } from "../knowledge/store.ts";

export type OperatorScore = {
  score: number;
  components: {
    taskCompletion: number;    // /40
    categoryBalance: number;   // /20
    consistency: number;       // /20
    priorityAlignment: number; // /10
    recoveryLoad: number;      // /10
  };
  insights: string[];
  daysMeasured: number;
};

export async function computeOperatorScore(): Promise<OperatorScore> {
  const week = new Date(Date.now() - 7 * 24 * 3600 * 1000);
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

  return {
    score,
    components: { taskCompletion, categoryBalance, consistency, priorityAlignment, recoveryLoad },
    insights,
    daysMeasured: gaps.length,
  };
}

/**
 * Prompt Layer 1.5 — operator state + learned calibration, one voice.
 * The register comes from what Aurelius has learned about Cole (every
 * persona.* entry was confirmed by him), never from a mode switch.
 */
export async function getOperatorStateBlock(): Promise<string> {
  try {
    const s = await computeOperatorScore();
    const lines = [
      `═══ OPERATOR STATE ═══`,
      `Operator Score: ${s.score}/100 (completion ${s.components.taskCompletion}/40 · balance ${s.components.categoryBalance}/20 · consistency ${s.components.consistency}/20 · priority ${s.components.priorityAlignment}/10 · recovery ${s.components.recoveryLoad}/10)`,
      ...(s.insights.length ? [`Signals: ${s.insights.join(" ")}`] : []),
      "One voice — yours, always. Let this state tune your register naturally: when Cole is executing, match his tempo and stay brief; when follow-through slips, be more direct about the gap between intent and action. Never announce a shift, never switch personas.",
    ];

    // Learned calibration: everything Cole has confirmed about how he
    // wants to be spoken to. Grows through propose→confirm over time.
    const globalOp = await resolveOperatorId("strategy");
    if (globalOp) {
      const learned = await prisma.knowledgeEntry.findMany({
        where: { operatorId: globalOp, scope: "persona", active: true },
        select: { key: true, value: true },
        take: 12,
      });
      if (learned.length > 0) {
        lines.push("What Cole has taught you about speaking to him:");
        for (const e of learned) {
          lines.push(`  — ${e.key.replace(/_/g, " ")}: ${typeof e.value === "string" ? e.value : JSON.stringify(e.value)}`);
        }
      }
    }
    return lines.join("\n");
  } catch (err) {
    console.warn("[operatorScore] state block failed (non-fatal):", err);
    return "";
  }
}
