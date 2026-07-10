// aurelius/productivity/service.ts
//
// Productivity plane — Cole's lane. The domain service for tasks, projects,
// goals, habits, capture, the daily plan, and bridge signals. All access to
// these tables flows through here; routes stay thin.
//
// Conventions:
// - "today" is a YYYY-MM-DD string the CLIENT supplies (the phone knows
//   Cole's timezone; the server doesn't guess). Falls back to server date.
// - Notes and tasks index into semantic recall on write, fire-and-forget.
// - Nothing here prescribes or auto-acts. Aurelius-originated tasks arrive
//   with origin="aurelius_proposed" and sit in inbox until Cole triages.

import { prisma } from "../core/db/prisma.ts";
import { embedSourceSafe } from "../retrieval/embedPipeline.ts";

// ── Date helpers ─────────────────────────────────────────────────────

function dayRange(dateStr?: string): { date: Date; start: Date; end: Date; dstr: string } {
  const dstr = dateStr ?? new Date().toISOString().slice(0, 10);
  const start = new Date(`${dstr}T00:00:00.000Z`);
  const end = new Date(`${dstr}T23:59:59.999Z`);
  return { date: start, start, end, dstr };
}

// ── Tasks ────────────────────────────────────────────────────────────

export type CreateTaskInput = {
  title: string;
  description?: string;
  domain?: string;
  status?: string;       // default "inbox"
  priority?: string;
  dueDate?: string;      // ISO
  scheduledFor?: string; // ISO
  projectId?: string;
  goalId?: string;
  operatorId?: string;
  origin?: string;
  originContext?: any;
};

export async function createTask(input: CreateTaskInput) {
  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      domain: input.domain ?? "personal",
      status: input.status ?? "inbox",
      priority: input.priority ?? "normal",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      projectId: input.projectId ?? null,
      goalId: input.goalId ?? null,
      operatorId: input.operatorId ?? null,
      origin: input.origin ?? "cole",
      originContext: input.originContext ?? undefined,
    },
  });

  embedSourceSafe({
    sourceType: "task",
    sourceId: task.id,
    text: [task.title, task.description].filter(Boolean).join(" — "),
    operatorId: task.operatorId,
    domain: task.domain,
  });

  return task;
}

export async function updateTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    domain: string;
    dueDate: string | null;
    scheduledFor: string | null;
    projectId: string | null;
    goalId: string | null;
  }>
) {
  const data: any = { ...patch };
  if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  if (patch.scheduledFor !== undefined)
    data.scheduledFor = patch.scheduledFor ? new Date(patch.scheduledFor) : null;
  if (patch.status === "done") data.completedAt = new Date();
  return prisma.task.update({ where: { id }, data });
}

export async function completeTask(id: string) {
  return prisma.task.update({
    where: { id },
    data: { status: "done", completedAt: new Date() },
  });
}

export async function listTasks(filter: { status?: string; domain?: string; limit?: number } = {}) {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.domain) where.domain = filter.domain;
  return prisma.task.findMany({
    where,
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: filter.limit ?? 100,
  });
}

// ── Quick capture ────────────────────────────────────────────────────

export async function quickCapture(input: {
  content: string;
  title?: string;
  domain?: string;
  captureContext?: string;
  operatorId?: string;
}) {
  const note = await prisma.note.create({
    data: {
      content: input.content,
      title: input.title ?? null,
      domain: input.domain ?? "personal",
      captureContext: input.captureContext ?? "quick_capture",
      operatorId: input.operatorId ?? null,
    },
  });

  embedSourceSafe({
    sourceType: "note",
    sourceId: note.id,
    text: [note.title, note.content].filter(Boolean).join("\n"),
    operatorId: note.operatorId,
    domain: note.domain,
  });

  return note;
}

// ── Habits ───────────────────────────────────────────────────────────

export async function createHabit(input: {
  name: string;
  cadence?: string;
  domain?: string;
  operatorId?: string;
}) {
  return prisma.habit.create({
    data: {
      name: input.name,
      cadence: input.cadence ?? "daily",
      domain: input.domain ?? "personal",
      operatorId: input.operatorId ?? null,
    },
  });
}

/**
 * Record a completion and maintain streaks. Idempotent per day —
 * completing twice on the same date returns the existing completion.
 */
export async function completeHabit(habitId: string, dateStr?: string) {
  const { start, end, dstr } = dayRange(dateStr);

  const existing = await prisma.habitCompletion.findFirst({
    where: { habitId, completedAt: { gte: start, lte: end } },
  });
  if (existing) return { completion: existing, alreadyDone: true };

  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) throw new Error(`habit not found: ${habitId}`);

  const completion = await prisma.habitCompletion.create({
    data: { habitId, completedAt: new Date(`${dstr}T12:00:00.000Z`) },
  });

  // Streak: continued if the previous completion was yesterday.
  const yesterday = new Date(start.getTime() - 24 * 3600 * 1000);
  const yesterdayDone = await prisma.habitCompletion.findFirst({
    where: {
      habitId,
      completedAt: { gte: yesterday, lt: start },
      id: { not: completion.id },
    },
  });
  const streak = yesterdayDone ? habit.streak + 1 : 1;

  await prisma.habit.update({
    where: { id: habitId },
    data: { streak, longestStreak: Math.max(habit.longestStreak, streak) },
  });

  return { completion, alreadyDone: false, streak };
}

export async function listHabits(dateStr?: string) {
  const { start, end } = dayRange(dateStr);
  const habits = await prisma.habit.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  const completions = await prisma.habitCompletion.findMany({
    where: { completedAt: { gte: start, lte: end }, habitId: { in: habits.map((h) => h.id) } },
  });
  const doneSet = new Set(completions.map((c) => c.habitId));
  return habits.map((h) => ({ ...h, doneToday: doneSet.has(h.id) }));
}

// ── Daily plan + Today assembly ──────────────────────────────────────

export async function upsertTodayPlan(input: {
  date?: string;
  focus?: string;
  headline?: string;
  taskIds?: string[];
  generatedBy?: string;
}) {
  const { date } = dayRange(input.date);
  return prisma.dailyPlan.upsert({
    where: { date },
    create: {
      date,
      focus: input.focus ?? null,
      headline: input.headline ?? null,
      taskIds: input.taskIds ?? [],
      generatedBy: input.generatedBy ?? "cole_manual",
    },
    update: {
      ...(input.focus !== undefined ? { focus: input.focus } : {}),
      ...(input.headline !== undefined ? { headline: input.headline } : {}),
      ...(input.taskIds !== undefined ? { taskIds: input.taskIds } : {}),
      generatedBy: input.generatedBy ?? "revised",
    },
  });
}

/**
 * Everything the Today view needs in one call.
 */
export async function getToday(dateStr?: string) {
  const { date, start, end, dstr } = dayRange(dateStr);

  const [plan, todayTasks, scheduledToday, overdue, inboxCount, habits, events, bridge] =
    await Promise.all([
      prisma.dailyPlan.findUnique({ where: { date } }),
      prisma.task.findMany({
        where: { status: "today" },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      }),
      prisma.task.findMany({
        where: {
          scheduledFor: { gte: start, lte: end },
          status: { notIn: ["done", "abandoned"] },
        },
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.task.findMany({
        where: { dueDate: { lt: start }, status: { notIn: ["done", "abandoned"] } },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),
      prisma.task.count({ where: { status: "inbox" } }),
      listHabits(dstr),
      prisma.calendarEvent.findMany({
        where: { startAt: { gte: start, lte: end } },
        orderBy: { startAt: "asc" },
      }),
      prisma.bridgeSignal.findMany({
        where: { status: { in: ["pending", "surfaced"] } },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 10,
      }),
    ]);

  // Merge status="today" tasks with tasks scheduled for today, de-duped.
  const seen = new Set<string>();
  const tasks = [...todayTasks, ...scheduledToday].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  const doneToday = await prisma.task.count({
    where: { status: "done", completedAt: { gte: start, lte: end } },
  });

  // Trackers + the Aurelius lane, in the same payload (one page fetch)
  const [stats, goals, activity] = await Promise.all([
    getProductivityStats(dstr),
    listGoals(),
    getAureliusActivity(),
  ]);

  return {
    date: dstr,
    plan,
    tasks,
    overdue,
    inboxCount,
    doneToday,
    habits,
    calendarEvents: events,
    bridgeSignals: bridge,
    stats,
    goals,
    activity,
  };
}

// ── Bridge signals ───────────────────────────────────────────────────

export async function ackBridgeSignal(id: string, status: "acknowledged" | "acted" | "dismissed") {
  return prisma.bridgeSignal.update({
    where: { id },
    data: { status },
  });
}

// ── Goals ────────────────────────────────────────────────────────────
// measure: { type: "count", target, current } — v1 supports counted goals;
// "big" vs "small" is the horizon field (life/year/quarter vs week-scale).

export async function createGoal(input: {
  name: string;
  domain?: string;
  horizon?: string;
  target?: number;
  unit?: string;
  targetDate?: string;
  projectId?: string;
  operatorId?: string;
}) {
  return prisma.goal.create({
    data: {
      name: input.name,
      domain: input.domain ?? "personal",
      horizon: input.horizon ?? "quarter",
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      projectId: input.projectId ?? null,
      operatorId: input.operatorId ?? null,
      measure: {
        type: "count",
        target: input.target ?? 1,
        current: 0,
        unit: input.unit ?? null,
      },
    },
  });
}

export async function listGoals(status: string = "active") {
  const goals = await prisma.goal.findMany({
    where: { status },
    orderBy: [{ horizon: "asc" }, { createdAt: "asc" }],
  });
  return goals.map((g) => {
    const m = (g.measure as any) ?? {};
    const target = Number(m.target ?? 1) || 1;
    const current = Number(m.current ?? 0);
    return { ...g, progressPct: Math.min(100, Math.round((current / target) * 100)) };
  });
}

/** Bump a counted goal's progress. Marks "hit" when target reached. */
export async function bumpGoal(id: string, delta: number = 1) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) throw new Error(`goal not found: ${id}`);
  const m = (goal.measure as any) ?? { type: "count", target: 1, current: 0 };
  const current = Math.max(0, Number(m.current ?? 0) + delta);
  const target = Number(m.target ?? 1) || 1;
  return prisma.goal.update({
    where: { id },
    data: {
      measure: { ...m, current },
      status: current >= target ? "hit" : "active",
    },
  });
}

// ── Productivity stats (the trackers) ────────────────────────────────

export async function getProductivityStats(dateStr?: string) {
  const { start, end } = dayRange(dateStr);
  const weekAgo = new Date(start.getTime() - 6 * 24 * 3600 * 1000);

  const [doneToday, doneWeek, capturesWeek, habits, gaps] = await Promise.all([
    prisma.task.count({ where: { status: "done", completedAt: { gte: start, lte: end } } }),
    prisma.task.count({ where: { status: "done", completedAt: { gte: weekAgo, lte: end } } }),
    prisma.note.count({ where: { createdAt: { gte: weekAgo, lte: end } } }),
    prisma.habit.findMany({ where: { active: true }, select: { name: true, streak: true } }),
    prisma.intentActionGap.findMany({
      where: { computedAt: { gte: weekAgo } },
      orderBy: { computedAt: "desc" },
      take: 7,
    }),
  ]);

  const bestStreak = habits.reduce((mx, h) => Math.max(mx, h.streak), 0);
  const avgGap =
    gaps.length > 0 ? gaps.reduce((s, g) => s + g.gapScore, 0) / gaps.length : null;

  return {
    doneToday,
    doneWeek,
    capturesWeek,
    bestStreak,
    // 1 = perfect follow-through on stated intent this week; null = no data yet
    followThrough: avgGap !== null ? Math.round((1 - avgGap) * 100) : null,
  };
}

// ── Projects ─────────────────────────────────────────────────────────
// Each project rolls up its tasks: progress %, how long it's been alive,
// runway to target, and "what it needs" = its open tasks (deterministic
// v1 — the LLM-suggested "what's missing" pass comes with the autonomy
// engine).

export async function createProject(input: {
  name: string;
  description?: string;
  domain?: string;
  priority?: string;
  targetDate?: string;
  operatorId?: string;
}) {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      domain: input.domain ?? "personal",
      priority: input.priority ?? "normal",
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      operatorId: input.operatorId ?? null,
    },
  });
  embedSourceSafe({
    sourceType: "project",
    sourceId: project.id,
    text: [project.name, project.description].filter(Boolean).join(" — "),
    operatorId: project.operatorId,
    domain: project.domain,
  });
  return project;
}

export async function listProjectsWithProgress() {
  const projects = await prisma.project.findMany({
    where: { status: { in: ["active", "paused"] } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    include: {
      tasks: {
        select: { id: true, title: true, status: true, priority: true },
      },
    },
  });

  const now = Date.now();
  return projects.map((p) => {
    const total = p.tasks.length;
    const done = p.tasks.filter((t) => t.status === "done").length;
    const open = p.tasks.filter((t) => !["done", "abandoned"].includes(t.status));
    const daysActive = Math.max(1, Math.round((now - p.createdAt.getTime()) / 86400000));
    const daysToTarget = p.targetDate
      ? Math.round((p.targetDate.getTime() - now) / 86400000)
      : null;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      domain: p.domain,
      status: p.status,
      priority: p.priority,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
      tasksDone: done,
      tasksTotal: total,
      daysActive,
      daysToTarget,
      needs: open.slice(0, 3).map((t) => t.title), // "what it needs" v1
    };
  });
}

// ── Command Deck assembly ────────────────────────────────────────────
// Everything the deck renders, one call. Hero metrics CONFRONT — they
// tell Cole where he's behind, not how big the database is.

export async function getDeck(dateStr?: string) {
  const { start, dstr } = dayRange(dateStr);

  const [today, projects, pendingSignals] = await Promise.all([
    getToday(dstr),
    listProjectsWithProgress(),
    prisma.bridgeSignal.findMany({
      where: { status: { in: ["pending", "surfaced"] } },
      orderBy: [{ createdAt: "desc" }],
      take: 12,
    }),
  ]);

  // Hero metrics — the confrontation row
  const behindProjects = projects.filter(
    (p) => p.daysToTarget !== null && p.daysToTarget < 7 && p.progressPct < 80
  );
  const hero = {
    overdue: today.overdue.length,
    openToday: today.tasks.length,
    doneToday: today.doneToday,
    followThrough: today.stats.followThrough, // % of stated intent executed (7d)
    inbox: today.inboxCount,
    projectsAtRisk: behindProjects.map((p) => ({
      name: p.name,
      daysToTarget: p.daysToTarget,
      progressPct: p.progressPct,
    })),
    attentionSignals: pendingSignals.filter((s) =>
      ["attention", "critical"].includes(s.severity)
    ).length,
  };

  return {
    date: dstr,
    hero,
    plan: today.plan,
    tasks: today.tasks,
    overdue: today.overdue,
    habits: today.habits,
    goals: today.goals,
    stats: today.stats,
    projects,
    bridge: pendingSignals,
    activity: today.activity,
  };
}

// ── Aurelius activity (what the background is doing) ─────────────────

export async function getAureliusActivity() {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

  const [memories24h, reasoningRuns24h, patterns, researchRecent, signals, missions] =
    await Promise.all([
      prisma.memory.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.reasoningCacheEntry.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.compiledPattern.findMany({
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: { patternType: true, status: true, supportCount: true, domain: true, updatedAt: true },
      }),
      prisma.memory.findMany({
        where: { category: "research" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { value: true, createdAt: true },
      }),
      prisma.bridgeSignal.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { kind: true, severity: true, title: true, status: true, createdAt: true },
      }),
      prisma.mission.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          domain: true,
          planSummary: true,
          createdAt: true,
          finishedAt: true,
          steps: { orderBy: { idx: "asc" }, select: { kind: true, status: true } },
        },
      }),
    ]);

  return {
    counts: { memories24h, reasoningRuns24h },
    recentPatterns: patterns,
    recentResearch: researchRecent.map((r) => ({
      summary: r.value.slice(0, 140),
      at: r.createdAt,
    })),
    recentSignals: signals,
    missions,
  };
}
