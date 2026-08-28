// aurelius/router/productivityRouter.ts
//
// Express surface for the productivity plane. Thin: every route delegates
// to aurelius/productivity/service.ts. Mounted at /api/productivity.

import { Router, type Request, type Response } from "express";
import {
  createTask,
  updateTask,
  completeTask,
  listTasks,
  quickCapture,
  createHabit,
  completeHabit,
  listHabits,
  upsertTodayPlan,
  getToday,
  ackBridgeSignal,
  createGoal,
  listGoals,
  bumpGoal,
  getProductivityStats,
  getAureliusActivity,
  createProject,
  listProjectsWithProgress,
  getDeck,
} from "../productivity/service.ts";
import { runNightlyPulse, runWeekendPulse } from "../autonomy/pulse.ts";
import { computeWeeklySnapshot, listSnapshots } from "../measurement/scoreboard.ts";

export const productivityRouter = Router();

// ── Today ────────────────────────────────────────────────────────────

productivityRouter.get("/today", async (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json(await getToday(date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/plan", async (req: Request, res: Response) => {
  try {
    res.json(await upsertTodayPlan(req.body ?? {}));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Tasks ────────────────────────────────────────────────────────────

productivityRouter.get("/tasks", async (req: Request, res: Response) => {
  try {
    res.json(
      await listTasks({
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        domain: typeof req.query.domain === "string" ? req.query.domain : undefined,
      })
    );
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/tasks", async (req: Request, res: Response) => {
  try {
    if (!req.body?.title || typeof req.body.title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }
    res.json(await createTask(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    res.json(await updateTask(String(req.params.id), req.body ?? {}));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/tasks/:id/complete", async (req: Request, res: Response) => {
  try {
    res.json(await completeTask(String(req.params.id)));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Capture ──────────────────────────────────────────────────────────

productivityRouter.post("/capture", async (req: Request, res: Response) => {
  try {
    if (!req.body?.content || typeof req.body.content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }
    res.json(await quickCapture(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Habits ───────────────────────────────────────────────────────────

productivityRouter.get("/habits", async (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json(await listHabits(date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/habits", async (req: Request, res: Response) => {
  try {
    if (!req.body?.name || typeof req.body.name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    res.json(await createHabit(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/habits/:id/complete", async (req: Request, res: Response) => {
  try {
    res.json(await completeHabit(String(req.params.id), req.body?.date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Command Deck ─────────────────────────────────────────────────────

productivityRouter.get("/deck", async (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json(await getDeck(date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// The inbox view: uncategorised captures waiting to be triaged.
productivityRouter.get("/inbox", async (_req: Request, res: Response) => {
  try {
    res.json(await listTasks({ status: "inbox" }));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// The Today view's single write endpoint. Body: { action, ...payload }. Moved
// here from the Next route so every productivity write runs in the one process.
productivityRouter.post("/actions", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    switch (body.action) {
      case "createTask":
        return res.json(await createTask({ title: body.title, status: body.status ?? "today", priority: body.priority, domain: body.domain, scheduledFor: body.scheduledFor }));
      case "completeTask":
        return res.json(await completeTask(body.id));
      case "capture":
        return res.json(await quickCapture({ content: body.content }));
      case "createHabit":
        return res.json(await createHabit({ name: body.name }));
      case "completeHabit":
        return res.json(await completeHabit(body.id, body.date));
      case "setPlan":
        return res.json(await upsertTodayPlan({ date: body.date, focus: body.focus }));
      case "createGoal":
        return res.json(await createGoal({ name: body.name, target: body.target, horizon: body.horizon, domain: body.domain }));
      case "bumpGoal":
        return res.json(await bumpGoal(body.id, body.delta ?? 1));
      case "createProject":
        return res.json(await createProject({ name: body.name, domain: body.domain, targetDate: body.targetDate }));
      case "routeTask":
        return res.json(await updateTask(body.id, { status: body.status }));
      case "ackSignal":
        return res.json(await ackBridgeSignal(body.id, body.status ?? "acknowledged"));
      default:
        return res.status(400).json({ error: `unknown action: ${body.action}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Action failed" });
  }
});

// THE WINDSHIELD FEED: next calendar event, free hours left today, and
// Aurelius's own next scheduled move. Moved here from the Next route (the cron
// roster lives in this process). Keep DAILY/SUNDAY in step with index.ts.
const UPNEXT_DAILY: Array<{ t: string; label: string }> = [
  { t: "02:00", label: "database backup" }, { t: "06:00", label: "RSS ingest" }, { t: "06:30", label: "market pulse" },
  { t: "06:45", label: "schedule protection" }, { t: "07:00", label: "morning briefing" }, { t: "08:00", label: "initiative pulse" },
  { t: "13:00", label: "midday check" }, { t: "21:15", label: "queue sweep" }, { t: "21:30", label: "nightly debrief" },
];
const UPNEXT_SUNDAY: Array<{ t: string; label: string }> = [
  { t: "09:00", label: "weekend research" }, { t: "17:00", label: "persona observer" }, { t: "18:00", label: "weekly planning" },
  { t: "19:00", label: "freshness sweep" }, { t: "19:30", label: "capability gaps" }, { t: "20:00", label: "weekly scoreboard" },
  { t: "21:00", label: "decision curriculum" }, { t: "22:00", label: "curriculum ingest" },
];
productivityRouter.get("/upnext", async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import("../core/db/prisma.ts");
    const tz = process.env.AURELIUS_TZ?.trim() || undefined;
    const now = new Date();
    const hm = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
    const weekday = now.toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
    const todayKey = now.toLocaleDateString("en-CA", { timeZone: tz });
    const roster = [...UPNEXT_DAILY, ...(weekday === "Sun" ? UPNEXT_SUNDAY : [])].sort((a, b) => a.t.localeCompare(b.t));
    const upcoming = roster.find((j) => j.t > hm);
    const tomorrowWeekday = new Date(now.getTime() + 86400_000).toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
    const tomorrowRoster = [...UPNEXT_DAILY, ...(tomorrowWeekday === "Sun" ? UPNEXT_SUNDAY : [])].sort((a, b) => a.t.localeCompare(b.t));
    const nextMove = upcoming ? { time: upcoming.t, label: upcoming.label, tomorrow: false } : { time: tomorrowRoster[0]!.t, label: tomorrowRoster[0]!.label, tomorrow: true };
    const nextEventRow = await prisma.calendarEvent.findFirst({
      where: { startAt: { gte: now, lte: new Date(now.getTime() + 48 * 3600_000) } },
      orderBy: { startAt: "asc" },
      select: { title: true, startAt: true, raw: true },
    });
    const nextEvent = nextEventRow ? { title: nextEventRow.title, startAt: nextEventRow.startAt, allDay: !!(nextEventRow.raw as any)?.allDay } : null;
    const nowHour = Number(hm.slice(0, 2)) + Number(hm.slice(3, 5)) / 60;
    let freeHours = Math.max(0, 22 - nowHour);
    if (freeHours > 0) {
      const eventsAhead = await prisma.calendarEvent.findMany({
        where: { startAt: { gte: now, lte: new Date(now.getTime() + 24 * 3600_000) } },
        select: { startAt: true, endAt: true, raw: true },
      });
      const busy = eventsAhead
        .filter((e) => !(e.raw as any)?.allDay)
        .filter((e) => e.startAt.toLocaleDateString("en-CA", { timeZone: tz }) === todayKey)
        .reduce((h, e) => h + Math.max(0, (e.endAt.getTime() - e.startAt.getTime()) / 3600_000), 0);
      freeHours = Math.max(0, freeHours - busy);
    }
    res.json({ nextEvent, freeHours: Math.round(freeHours * 2) / 2, nextMove });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load up-next" });
  }
});

// ── Projects ─────────────────────────────────────────────────────────

productivityRouter.get("/projects", async (_req: Request, res: Response) => {
  try {
    res.json(await listProjectsWithProgress());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/projects", async (req: Request, res: Response) => {
  try {
    if (!req.body?.name || typeof req.body.name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    res.json(await createProject(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Goals ────────────────────────────────────────────────────────────

productivityRouter.get("/goals", async (_req: Request, res: Response) => {
  try {
    res.json(await listGoals());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/goals", async (req: Request, res: Response) => {
  try {
    if (!req.body?.name || typeof req.body.name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    res.json(await createGoal(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/goals/:id/bump", async (req: Request, res: Response) => {
  try {
    res.json(await bumpGoal(String(req.params.id), req.body?.delta ?? 1));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Trackers + Aurelius activity ─────────────────────────────────────

productivityRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json(await getProductivityStats(date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.get("/activity", async (_req: Request, res: Response) => {
  try {
    res.json(await getAureliusActivity());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.get("/score", async (_req: Request, res: Response) => {
  try {
    const { computeOperatorScore } = await import("../measurement/operatorScore.ts");
    res.json(await computeOperatorScore());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.get("/scoreboard", async (_req: Request, res: Response) => {
  try {
    res.json({ snapshots: await listSnapshots() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/scoreboard/run", async (req: Request, res: Response) => {
  try {
    res.json(await computeWeeklySnapshot(req.body?.weekStart));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Pulse (manual triggers — the scheduler fires these on its own) ───

productivityRouter.post("/pulse/nightly", async (req: Request, res: Response) => {
  try {
    res.json(await runNightlyPulse(req.body?.date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/pulse/midday", async (req: Request, res: Response) => {
  try {
    const { runMiddayCheck } = await import("../planning/tools.ts");
    res.json(await runMiddayCheck(req.body?.date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/plan/week", async (_req: Request, res: Response) => {
  try {
    const { planWeekLite } = await import("../planning/tools.ts");
    res.json(await planWeekLite());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/pulse/market", async (req: Request, res: Response) => {
  try {
    const { runMarketPulse } = await import("../wealth/engine.ts");
    res.json(await runMarketPulse(req.body?.date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/pulse/weekend", async (_req: Request, res: Response) => {
  try {
    res.json(await runWeekendPulse());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Bridge ───────────────────────────────────────────────────────────

productivityRouter.post("/bridge/:id/ack", async (req: Request, res: Response) => {
  try {
    const status = req.body?.status ?? "acknowledged";
    if (!["acknowledged", "acted", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "invalid status" });
    }
    res.json(await ackBridgeSignal(String(req.params.id), status));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
