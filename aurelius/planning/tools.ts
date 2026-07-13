// aurelius/planning/tools.ts
//
// PLANNING & SCHEDULING TOOLS (OG doc Parts VII + X). Everything works
// from tasks/goals/habits/gaps alone; when the Google Calendar sync is
// live, overload math and the weekly session upgrade themselves with
// real time blocks — same contracts, sharper numbers.
//
//   analyzeWeek        — the week in numbers + what's dragging
//   detectOverload     — due-load vs daily capacity, next 7 days
//   breakGoalIntoSteps — LLM decomposes a goal into proposed tasks
//                        (origin aurelius_proposed, land in inbox — Cole
//                        triages; nothing self-schedules)
//   planWeekLite       — the six-phase weekly planning session:
//                        last-week review → goal review → candidate
//                        generation (deterministic, capacity-capped,
//                        calendar-slotted) → workload → overload →
//                        briefing → RitualInstance + signal
//
// Hard rules carried: propose, never impose. Generated tasks are
// suggestions in the inbox; the plan is a briefing, not a fait accompli.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { extractDirectives } from "../llm/directiveParser.ts";
import { computeOperatorScore } from "../measurement/operatorScore.ts";

const DAILY_CAPACITY = 5; // tasks/day baseline; calendar shrinks it on busy days
const MINUTES_PER_TASK = 90; // planning heuristic: one meaningful task ≈ a 90-min block

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

  // Real time blocks, when the calendar is synced: free minutes in the
  // waking window shrink each day's task capacity. With no calendar the
  // math degrades to the flat baseline — the v1 contract, unchanged.
  let availability: Awaited<ReturnType<typeof import("../calendar/engine.ts").findAvailability>> = [];
  try {
    const { isCalendarConnected } = await import("../calendar/googleAuth.ts");
    if (await isCalendarConnected()) {
      const { findAvailability } = await import("../calendar/engine.ts");
      availability = await findAvailability({ days: 7, minMinutes: 30 });
    }
  } catch (err) {
    console.warn("[planning] calendar unavailable for overload math (using baseline):", (err as any)?.message ?? err);
  }

  const days: Array<{
    date: string;
    due: number;
    capacity: number;
    busyMinutes: number;
    overloaded: boolean;
  }> = [];
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
    const avail = availability.find((a) => a.date === dstr);
    const capacity = avail
      ? Math.max(1, Math.min(DAILY_CAPACITY, Math.floor(avail.freeMinutes / MINUTES_PER_TASK)))
      : DAILY_CAPACITY;
    days.push({
      date: dstr,
      due,
      capacity,
      busyMinutes: avail?.busyMinutes ?? 0,
      overloaded: due > capacity,
    });
  }
  const backlog = await prisma.task.count({
    where: { dueDate: { lt: now }, status: { notIn: ["done", "abandoned"] } },
  });
  const overloadedDays = days.filter((d) => d.overloaded);
  return {
    days,
    backlog,
    overloadedDays,
    capacityPerDay: DAILY_CAPACITY,
    calendarInformed: availability.length > 0,
  };
}

function engineUnavailable(text: string): boolean {
  return /_API_KEY is not configured|engine is not configured|Missing .*_API_KEY|All configured LLM providers failed/i.test(text);
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
 * PHASE 2 — CANDIDATE GENERATION. Which tasks should make the week?
 * Fully deterministic: overdue first (oldest debt is loudest), then
 * goal-linked open work (the week should serve the goals), then aging
 * inbox items. Capped at the week's real capacity. When the calendar is
 * synced, the top candidates get a suggested free block. Proposals in a
 * briefing — nothing is scheduled for Cole.
 */
export async function generateWeekCandidates(weekCapacity: number) {
  const now = new Date();
  const openNotDone = { status: { notIn: ["done", "abandoned"] } };

  const [overdue, goalLinked, aging] = await Promise.all([
    prisma.task.findMany({
      where: { ...openNotDone, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: { goal: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { ...openNotDone, goalId: { not: null }, dueDate: null, scheduledFor: null },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: 10,
      include: { goal: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { status: "inbox", goalId: null },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);

  const seen = new Set<string>();
  const candidates: Array<{ id: string; title: string; reason: string }> = [];
  const push = (t: { id: string; title: string }, reason: string) => {
    if (seen.has(t.id) || candidates.length >= weekCapacity) return;
    seen.add(t.id);
    candidates.push({ id: t.id, title: t.title, reason });
  };
  for (const t of overdue) {
    const days = Math.round((now.getTime() - t.dueDate!.getTime()) / 86400_000);
    push(t, `overdue ${days}d`);
  }
  for (const t of goalLinked) push(t, `goal: ${t.goal?.name ?? "linked"}`);
  for (const t of aging) {
    const days = Math.round((now.getTime() - (t as any).createdAt.getTime()) / 86400_000);
    push(t, `inbox ${days}d — schedule it or toss it`);
  }

  // Calendar-aware: pair the top candidates with real open blocks.
  const slotted: Array<{ title: string; reason: string; suggestedSlot?: string }> = candidates.map(
    (c) => ({ title: c.title, reason: c.reason })
  );
  try {
    const { isCalendarConnected } = await import("../calendar/googleAuth.ts");
    if (await isCalendarConnected()) {
      const { findAvailability } = await import("../calendar/engine.ts");
      const days = await findAvailability({ days: 7, minMinutes: 60 });
      const blocks = days
        .flatMap((d) => d.slots.map((s) => ({ ...s, date: d.date })))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, Math.min(3, slotted.length));
      blocks.forEach((b, i) => {
        slotted[i].suggestedSlot = `${b.date} ${b.start.slice(11, 16)}–${b.end.slice(11, 16)} (${b.minutes}m free)`;
      });
    }
  } catch {
    // calendar unavailable → candidates ship without slots, unchanged
  }

  return slotted;
}

/**
 * WEEKLY PLANNING — the six phases. Deterministic facts always; the LLM
 * voices the briefing when an engine exists. Candidates are proposals in
 * the briefing; nothing self-schedules.
 */
export async function planWeekLite() {
  // 1. Goal review + 3. workload + 5. overload
  const [analysis, overload, inbox, overdue, weekEvents] = await Promise.all([
    analyzeWeek(),
    detectOverload(),
    prisma.task.count({ where: { status: "inbox" } }),
    prisma.task.findMany({
      where: { dueDate: { lt: new Date() }, status: { notIn: ["done", "abandoned"] } },
      select: { title: true },
      take: 8,
    }),
    prisma.calendarEvent.findMany({
      where: { startAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400_000) } },
      orderBy: { startAt: "asc" },
      select: { title: true, startAt: true },
    }),
  ]);

  // 2. Candidate generation — what should make the week, within capacity
  const weekCapacity = overload.days.reduce((n, d) => n + d.capacity, 0);
  const candidates = await generateWeekCandidates(Math.min(weekCapacity, 15));

  // Calendar shape of the week (only when events are actually synced)
  const byDay = new Map<string, number>();
  for (const e of weekEvents) {
    const k = e.startAt.toISOString().slice(0, 10);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const busiest = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];

  // Deterministic skeleton — the truth of the week ahead
  const skeleton = [
    `Operator Score: ${analysis.score}/100 · ${analysis.tasksDone} done last week`,
    `Active goals: ${analysis.activeGoals.map((g) => g.name).join(" · ") || "(none set)"}`,
    `Backlog: ${overload.backlog} overdue · ${inbox} untriaged in inbox`,
    weekEvents.length
      ? `Calendar: ${weekEvents.length} events this week · busiest day ${busiest![0]} (${busiest![1]} events)`
      : "",
    overload.overloadedDays.length
      ? `Overloaded days ahead: ${overload.overloadedDays.map((d) => `${d.date} (${d.due} due, capacity ${d.capacity})`).join(", ")}`
      : "No day ahead exceeds capacity.",
    candidates.length
      ? `Candidates for the week (${candidates.length}, capacity ${weekCapacity}):\n` +
        candidates
          .map((c) => `  • ${c.title} — ${c.reason}${c.suggestedSlot ? ` → ${c.suggestedSlot}` : ""}`)
          .join("\n")
      : "",
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
    if (!engineUnavailable(response.text)) {
      // Strip any stray directive — the tool catalog is in the prompt, but this
      // briefing must never print raw "[TOOL: ...]" text to Cole.
      briefing = extractDirectives(response.text ?? "").cleanedText || response.text;
    }
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
 * DAILY PLANNING — "plan my day." The daily analogue of planWeekLite: pull
 * today's open + scheduled tasks, overdue backlog, calendar, and today's
 * capacity, then voice a short plan (one priority, attack order, risk, pace).
 * Persists as today's plan (aurelius-generated) so the Today view reflects it.
 * Propose, never impose — nothing self-schedules.
 */
export async function planDay(dateStr?: string) {
  const { getToday, upsertTodayPlan } = await import("../productivity/service.ts");
  const today = await getToday(dateStr);
  const overload = await detectOverload();
  const todayCap = overload.days[0];

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const taskLines = today.tasks.length
    ? today.tasks.map((t: any) => `- [${t.priority}] ${t.title}${t.scheduledFor ? " (scheduled)" : ""}`).join("\n")
    : "(nothing queued for today yet)";
  const overdueLines = today.overdue.length
    ? today.overdue.slice(0, 8).map((t: any) => `- ${t.title} (overdue)`).join("\n")
    : "(no overdue)";
  const calLines = today.calendarEvents.length
    ? today.calendarEvents
        .map((e: any) => {
          const d = new Date(e.startAt);
          return `- ${pad2(d.getHours())}:${pad2(d.getMinutes())} ${e.title}`;
        })
        .join("\n")
    : "(no calendar events synced for today)";

  const skeleton = [
    `Date: ${today.date}`,
    today.plan?.focus ? `Existing focus: ${today.plan.focus}` : "",
    `Open today (${today.tasks.length}):\n${taskLines}`,
    `Overdue backlog:\n${overdueLines}`,
    `Calendar:\n${calLines}`,
    todayCap
      ? `Capacity today: ${todayCap.capacity} task-slots, ${todayCap.due} due${todayCap.overloaded ? " — OVERLOADED" : ""}`
      : "",
    `Done so far today: ${today.doneToday}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let plan = skeleton;
  try {
    const response = await runLLM({
      taskType: "chat",
      operators: { primary: "strategy", secondaries: [] },
      input: `
Write Cole's plan for TODAY from the ground truth below. Structure: the single
priority for today, the order to attack the open items, where the risk is
(overload / overdue / a tight calendar), and one sentence on pace. Under 150
words, no headers. Propose — Cole decides; nothing self-schedules.

═══ GROUND TRUTH ═══
${skeleton}
`.trim(),
    });
    if (!engineUnavailable(response.text)) {
      plan = extractDirectives(response.text ?? "").cleanedText || response.text;
    }
  } catch (err) {
    console.warn("[planning] day plan voice failed, shipping skeleton:", err);
  }

  await upsertTodayPlan({ date: today.date, headline: plan.slice(0, 1000), generatedBy: "aurelius" });

  return {
    date: today.date,
    plan,
    openCount: today.tasks.length,
    overdueCount: today.overdue.length,
    overloaded: !!todayCap?.overloaded,
  };
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
