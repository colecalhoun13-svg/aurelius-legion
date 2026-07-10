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
  };
}

// ── Bridge signals ───────────────────────────────────────────────────

export async function ackBridgeSignal(id: string, status: "acknowledged" | "acted" | "dismissed") {
  return prisma.bridgeSignal.update({
    where: { id },
    data: { status },
  });
}
