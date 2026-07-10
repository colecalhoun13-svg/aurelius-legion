// aurelius/planning/tools.ts
//
// PLANNING & SCHEDULING TOOLS v1 (OG doc Parts VII + X) — calendar-less
// edition. Everything here works from tasks/goals/habits/gaps alone;
// when Google Calendar lands, these gain time-blocking without changing
// their contracts.
//
//   analyzeWeek        — the week in numbers + what's dragging
//   detectOverload     — due-load vs daily capacity, next 7 days
//   breakGoalIntoSteps — LLM decomposes a goal into proposed tasks
//                        (origin aurelius_proposed, land in inbox — Cole
//                        triages; nothing self-schedules)
//   planWeekLite       — the six-phase weekly planning session, v1:
//                        goal review → candidate generation → workload →
//                        overload → briefing → RitualInstance + signal
//
// Hard rules carried: propose, never impose. Generated tasks are
// suggestions in the inbox; the plan is a briefing, not a fait accompli.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { computeOperatorScore } from "../measurement/operatorScore.ts";

const DAILY_CAPACITY = 5; // tasks/day heuristic until calendar-informed

export async function analyzeWeek() {
  const score = await computeOperatorScore();
  const week = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [done, created, goals] = await Promise.all([
    prisma.task.count({ where: { status: "done", completedAt: { gte: week } } }),
    prisma.task.count({ where: { createdAt: { gte: week } } }),
    prisma.goal.findMany({
      where: { status: "active" },
      select: { name: true, measure: true, horizon: true },
    }),
  ]);
  return {
    score: score.score,
    components: score.components,
    insights: score.insights,
    tasksDone: done,
    tasksCreated: created,
    activeGoals: goals.map((g) => ({ name: g.name, horizon: g.horizon, measure: g.measure })),
  };
}

export async function detectOverload() {
  const now = new Date();
  const days: Array<{ date: string; due: number; overloaded: boolean }> = [];
  for (let i = 0; i < 7; i++) {
    const start = new Date(now.getTime() + i * 24 * 3600 * 1000);
    const dstr = start.toISOString().slice(0, 10);
    const dayStart = new Date(`${dstr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dstr}T23:59:59.999Z`);
    const due = await prisma.task.count({
      where: {
        status: { notIn: ["done", "abandoned"] },
        OR: [
          { dueDate: { gte: dayStart, lte: dayEnd } },
          { scheduledFor: { gte: dayStart, lte: dayEnd } },
        ],
      },
    });
    days.push({ date: dstr, due, overloaded: due > DAILY_CAPACITY });
  }
  const backlog = await prisma.task.count({
    where: { dueDate: { lt: now }, status: { notIn: ["done", "abandoned"] } },
  });
  const overloadedDays = days.filter((d) => d.overloaded);
  return { days, backlog, overloadedDays, capacityPerDay: DAILY_CAPACITY };
}

function engineUnavailable(text: string): boolean {
  return /engine is not configured|Missing .*_API_KEY/i.test(text);
}

/**
 * LLM decomposes a goal into 3-7 concrete steps → proposed tasks in the
 * inbox (origin aurelius_proposed, linked to the goal). Honest keyless:
 * returns proposed=0 with a reason instead of inventing steps.
 */
export async function breakGoalIntoSteps(goalIdOrName: string) {
  const goal = await prisma.goal.findFirst({
    where: { OR: [{ id: goalIdOrName }, { name: { contains: goalIdOrName, mode: "insensitive" } }] },
  });
  if (!goal) return { ok: false as const, error: `goal not found: ${goalIdOrName}` };

  const existing = await prisma.task.findMany({
    where: { goalId: goal.id, status: { notIn: ["done", "abandoned"] } },
    select: { title: true },
  });

  const response = await runLLM({
    taskType: "chat",
    operators: { primary: "strategy", secondaries: [] },
    input: `
Break this goal into 3-7 concrete, atomic next steps (each completable in
one sitting). Respond with ONLY a JSON array of strings, no prose.
GOAL: ${goal.name}${goal.measure ? ` (measure: ${JSON.stringify(goal.measure)})` : ""}
DOMAIN: ${goal.domain}
${existing.length ? `ALREADY OPEN (don't repeat): ${existing.map((t) => t.title).join("; ")}` : ""}
`.trim(),
  });

  if (engineUnavailable(response.text)) {
    return { ok: false as const, error: "no LLM engine available to decompose the goal" };
  }
  let steps: string[] = [];
  try {
    const match = response.text.match(/\[[\s\S]*\]/);
    if (match) steps = JSON.parse(match[0]).filter((s: any) => typeof s === "string" && s.trim());
  } catch {
    return { ok: false as const, error: "could not parse steps from LLM output" };
  }
  if (steps.length === 0) return { ok: false as const, error: "LLM produced no usable steps" };

  const created: string[] = [];
  for (const title of steps.slice(0, 7)) {
    const t = await prisma.task.create({
      data: {
        title,
        domain: goal.domain,
        status: "inbox",
        origin: "aurelius_proposed",
        goalId: goal.id,
        originContext: { source: "break_goal_into_steps", goal: goal.name },
      },
    });
    created.push(t.title);
  }

  await prisma.bridgeSignal.create({
    data: {
      kind: "opportunity",
      domain: goal.domain,
      sourceType: "reasoning_output",
      sourceId: goal.id,
      severity: "notice",
      title: `${created.length} steps proposed for "${goal.name}"`,
      body: created.map((t) => `• ${t}`).join("\n") + "\n\nIn your inbox — triage or toss.",
    },
  });

  return { ok: true as const, goal: goal.name, proposed: created };
}

/**
 * WEEKLY PLANNING v1 — the six phases, calendar-less. Deterministic
 * facts always; the LLM voices the briefing when an engine exists.
 */
export async function planWeekLite() {
  // 1. Goal review + 3. workload + 5. overload
  const [analysis, overload, inbox, overdue] = await Promise.all([
    analyzeWeek(),
    detectOverload(),
    prisma.task.count({ where: { status: "inbox" } }),
    prisma.task.findMany({
      where: { dueDate: { lt: new Date() }, status: { notIn: ["done", "abandoned"] } },
      select: { title: true },
      take: 8,
    }),
  ]);

  // Deterministic skeleton — the truth of the week ahead
  const skeleton = [
    `Operator Score: ${analysis.score}/100 · ${analysis.tasksDone} done last week`,
    `Active goals: ${analysis.activeGoals.map((g) => g.name).join(" · ") || "(none set)"}`,
    `Backlog: ${overload.backlog} overdue · ${inbox} untriaged in inbox`,
    overload.overloadedDays.length
      ? `Overloaded days ahead: ${overload.overloadedDays.map((d) => `${d.date} (${d.due} due)`).join(", ")}`
      : "No day ahead exceeds capacity.",
    overdue.length ? `Oldest overdue: ${overdue.map((t) => t.title).slice(0, 5).join("; ")}` : "",
    analysis.insights.length ? `Signals: ${analysis.insights.join(" ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // 6. Briefing — LLM voice on top when available
  let briefing = skeleton;
  try {
    const response = await runLLM({
      taskType: "chat",
      operators: { primary: "strategy", secondaries: [] },
      input: `
Write Cole's weekly planning briefing from the ground truth below. Structure:
the week's single priority (pick it from the goals/backlog), what to clear
first, where the risk is (overload/overdue), and one sentence on pace. Under
200 words, no headers. Propose — Cole decides.

═══ GROUND TRUTH ═══
${skeleton}
`.trim(),
    });
    if (!engineUnavailable(response.text)) briefing = response.text;
  } catch (err) {
    console.warn("[planning] briefing voice failed, shipping skeleton:", err);
  }

  // File as the weekly_planning ritual instance + surface on the Bridge
  const { ensureRituals } = await import("../rituals/engine.ts");
  await ensureRituals();
  const ritual = await prisma.ritual.findUnique({ where: { name: "weekly_planning" } });
  const instance = await prisma.ritualInstance.create({
    data: {
      ritualId: ritual!.id,
      scheduledFor: new Date(),
      firedAt: new Date(),
      status: "generated",
      outputText: briefing,
      outputStructured: { score: analysis.score, backlog: overload.backlog, overloadedDays: overload.overloadedDays.length },
      deliveredVia: "in_app",
    },
  });
  await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      domain: "personal",
      sourceType: "ritual",
      sourceId: instance.id,
      severity: "notice",
      title: "Weekly planning session — the week ahead",
      body: briefing.slice(0, 1500),
    },
  });

  console.log(`[planning] weekly session filed (${instance.id})`);
  return { instanceId: instance.id, briefing, analysis, overload };
}

/**
 * MIDDAY CHECK (OG doc Part XIX) — 13:00, corrective tone, deterministic.
 * Only surfaces when there's something to correct; silence when on pace.
 */
export async function runMiddayCheck(dateStr?: string) {
  const dstr = dateStr ?? new Date().toISOString().slice(0, 10);
  const start = new Date(`${dstr}T00:00:00.000Z`);
  const end = new Date(`${dstr}T23:59:59.999Z`);

  const [plan, doneToday, openToday] = await Promise.all([
    prisma.dailyPlan.findUnique({ where: { date: start } }),
    prisma.task.count({ where: { status: "done", completedAt: { gte: start, lte: end } } }),
    prisma.task.count({
      where: {
        OR: [{ status: "today" }, { scheduledFor: { gte: start, lte: end } }],
        NOT: { status: { in: ["done", "abandoned"] } },
      },
    }),
  ]);

  const planned = doneToday + openToday;
  // On pace or nothing planned → stay silent. The midday check earns its
  // interruption or doesn't happen.
  if (planned === 0 || doneToday / planned >= 0.4) {
    return { fired: false as const, doneToday, openToday };
  }

  const body = [
    `Half the day is gone: ${doneToday}/${planned} moved${plan?.focus ? ` — focus was "${plan.focus}"` : ""}.`,
    openToday > 0 ? `${openToday} still open. Pick the one that matters and clear it before anything new.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const signal = await prisma.bridgeSignal.create({
    data: {
      kind: "gap_alert",
      domain: "personal",
      sourceType: "ritual",
      severity: "attention",
      title: `Midday check — ${doneToday}/${planned} by 13:00`,
      body,
    },
  });

  // Push to the phone if the bridge is live
  import("../telegram/bot.ts")
    .then((t) => t.sendToCole(`⚡ ${body}`))
    .catch(() => {});

  console.log(`[planning] midday check fired (${signal.id})`);
  return { fired: true as const, doneToday, openToday, signalId: signal.id };
}
