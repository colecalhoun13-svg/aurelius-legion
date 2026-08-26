// aurelius/router/systemRouter.ts
//
// The grab-bag of read/observability surfaces the frontend used to compute by
// importing backend code directly. Consolidated here so they run in the one
// process that owns the registry, the schedule, and the executor. Mounted at
// /api/system. Handlers use dynamic imports (matching the app's convention and
// keeping the cold-start light).

import { Router, type Request, type Response } from "express";

export const systemRouter = Router();

// ── Engines / model routing ──────────────────────────────────────────
const ENGINE_ROUTING = [
  { tier: "strategic", provider: "anthropic", model: "claude-sonnet-4-6", when: "Default — planning, judgment, the operator voice", env: "ANTHROPIC_API_KEY" },
  { tier: "high leverage", provider: "anthropic", model: "claude-opus-4-7", when: "Hard calls where being wrong is expensive", env: "ANTHROPIC_API_KEY" },
  { tier: "fast", provider: "groq", model: "llama-3.3-70b-versatile", when: "Quick, low-stakes turns", env: "GROQ_API_KEY" },
  { tier: "structured", provider: "openai", model: "gpt-5.4-mini", when: "Strict-format extraction and parsing", env: "OPENAI_API_KEY" },
  { tier: "realtime", provider: "xai", model: "grok-4-1-fast-reasoning", when: "Needs live information", env: "XAI_API_KEY" },
  { tier: "multimodal", provider: "gemini", model: "gemini-2.5-pro", when: "Images and mixed media", env: "GEMINI_API_KEY" },
  { tier: "math cheap", provider: "deepseek", model: "deepseek-reasoner", when: "Numeric grinding on a budget", env: "DEEPSEEK_API_KEY" },
];
systemRouter.get("/engines", async (_req: Request, res: Response) => {
  try {
    const { registerAllEngines } = await import("../core/registerEngines.ts");
    const { listEngines } = await import("../core/engineRegistry.ts");
    registerAllEngines();
    const engines = listEngines().map((e: any) => ({ name: e.name, description: e.description ?? "" }));
    const routing = ENGINE_ROUTING.map((r) => ({ ...r, configured: Boolean(process.env[r.env]?.trim()), env: undefined }));
    const embeddings = { provider: (process.env.EMBEDDINGS_PROVIDER ?? "openai").trim().toLowerCase() };
    res.json({ engines, routing, embeddings });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load engines" });
  }
});

// ── Tools + integration status ───────────────────────────────────────
// This process sees ALL the env keys (backend-only ones included), so the
// integration status is authoritative here — no more "asks the backend" dance.
systemRouter.get("/tools", async (_req: Request, res: Response) => {
  try {
    const { registerAllTools } = await import("../tools/registerTools.ts");
    const { listTools } = await import("../tools/toolRegistry.ts");
    const { getIntegrations } = await import("../tools/integrationStatus.ts");
    registerAllTools();
    res.json({
      registered: listTools().map((t: any) => ({ name: t.name, actions: (t.actions ?? []).map((a: any) => a.name ?? a) })),
      integrations: await getIntegrations(),
      source: "backend",
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "failed" });
  }
});

// ── Traces ───────────────────────────────────────────────────────────
systemRouter.get("/traces", async (req: Request, res: Response) => {
  try {
    const { listTraceThreads, getTraceThread } = await import("../observability/traceThreads.ts");
    const id = typeof req.query.id === "string" ? req.query.id : null;
    if (id) {
      const thread = await getTraceThread(id);
      if (!thread) return res.status(404).json({ error: "thread not found" });
      return res.json({ thread });
    }
    const limit = Math.min(Number(req.query.limit ?? 25) || 25, 100);
    res.json({ threads: await listTraceThreads(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load traces" });
  }
});

// ── Scoreboard feed ──────────────────────────────────────────────────
systemRouter.get("/scoreboard", async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import("../core/db/prisma.ts");
    const { listHabits, listGoals } = await import("../productivity/service.ts");
    const now = Date.now();
    const d14 = new Date(now - 14 * 86400_000);
    const d7 = new Date(now - 7 * 86400_000);
    const [snaps, doneTasks, habits, completions, goals, acted7, undone7, pendingNow, corpusDates] = await Promise.all([
      prisma.measurementSnapshot.findMany({ where: { operatorId: null }, orderBy: { weekStart: "asc" }, take: 26 }),
      prisma.task.findMany({ where: { status: "done", completedAt: { gte: d14 } }, select: { completedAt: true } }),
      listHabits(),
      prisma.habitCompletion.findMany({ where: { completedAt: { gte: d14 } }, select: { habitId: true, completedAt: true } }),
      listGoals(),
      prisma.bridgeSignal.count({ where: { status: "acted", createdAt: { gte: d7 } } }),
      prisma.bridgeSignal.count({ where: { status: "undone", createdAt: { gte: d7 } } }),
      prisma.bridgeSignal.count({ where: { status: { in: ["pending", "surfaced"] } } }),
      prisma.corpusDocument.findMany({ select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    ]);
    res.json({
      weeks: snaps.map((s: any) => {
        const m = (s.metrics ?? {}) as Record<string, any>;
        return {
          weekStart: s.weekStart, followThrough: m.followThrough ?? null, tasksDone: m.tasksDone ?? 0,
          habitCompletions: m.habitCompletions ?? 0, earnedThisWeekCents: m.earnedThisWeekCents ?? 0,
          earnedAllTimeCents: m.earnedAllTimeCents ?? 0, leadsThisWeek: m.leadsThisWeek ?? 0,
          llmDependenceRate: m.llmDependenceRate ?? null, corpusDocsAdded: m.corpusDocsAdded ?? 0,
          patternsActive: m.patternsActive ?? null, corrections: m.corrections ?? null, staleKnowledge: m.staleKnowledge ?? null,
        };
      }),
      doneTimestamps: doneTasks.map((t: any) => t.completedAt),
      habits, habitCompletions: completions, goals,
      autonomy: { acted7, undone7, pendingNow },
      corpusDates: corpusDates.map((c: any) => c.createdAt),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load scoreboard" });
  }
});

// ── Spine health (JobRun claim table as flight recorder) ─────────────
const SPINE_WEEKLY = ["weekend_pulse", "persona_observer", "weekly_planning", "freshness_sweep", "capability_gaps", "weekly_scoreboard", "decision_curriculum", "curriculum_ingest"];
systemRouter.get("/spine", async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import("../core/db/prisma.ts");
    const { ONCE_PER_DAY } = await import("../core/schedule.ts");
    const tz = process.env.AURELIUS_TZ?.trim() || undefined;
    const days: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString("en-CA", { timeZone: tz });
    });
    const runs = await prisma.jobRun.findMany({ where: { day: { in: days } }, select: { jobName: true, day: true, status: true } });
    res.json({ days, jobs: [...ONCE_PER_DAY].map((name: string) => ({ name, weekly: SPINE_WEEKLY.includes(name) })), runs });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load spine health" });
  }
});

// ── Nav badge (how many things await Cole's ruling) ──────────────────
systemRouter.get("/nav-badges", async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import("../core/db/prisma.ts");
    const { needsDecision } = await import("../core/bridge.ts");
    const [openSignals, proposals] = await Promise.all([
      prisma.bridgeSignal.findMany({ where: { status: { in: ["pending", "surfaced"] } }, select: { kind: true, severity: true, actions: true } }),
      prisma.knowledgeProposal.count({ where: { status: "pending" } }),
    ]);
    const signals = openSignals.filter((s: any) => needsDecision({ kind: s.kind, severity: s.severity ?? undefined, actions: s.actions })).length;
    res.json({ needsYou: signals + proposals, signals, proposals });
  } catch {
    res.json({ needsYou: 0, signals: 0, proposals: 0, degraded: true });
  }
});

// ── Chat history ─────────────────────────────────────────────────────
systemRouter.get("/chat-history", async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import("../core/db/prisma.ts");
    const turns = await prisma.conversationTurn.findMany({ orderBy: { createdAt: "desc" }, take: 60, select: { role: true, content: true, createdAt: true } });
    res.json({ messages: turns.reverse().map((t: any) => ({ role: t.role === "cole" ? "user" : "aurelius", content: t.content, at: t.createdAt })) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "failed to load history" });
  }
});

// ── The Library (curriculum shelves) ─────────────────────────────────
systemRouter.get("/library", async (_req: Request, res: Response) => {
  try {
    const { getCurriculumProgress } = await import("../learning/curriculum.ts");
    const { prisma } = await import("../core/db/prisma.ts");
    const progress = await getCurriculumProgress();
    const recentDocs = await prisma.corpusDocument.findMany({ where: { title: { startsWith: "Curriculum · " } }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, title: true, domain: true, createdAt: true } });
    res.json({ progress, recent: recentDocs.map((d: any) => ({ id: d.id, title: d.title.replace(/^Curriculum · /, ""), domain: d.domain, createdAt: d.createdAt })) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "failed to load library" });
  }
});
systemRouter.post("/library", async (req: Request, res: Response) => {
  try {
    const { runCurriculumIngest } = await import("../learning/curriculum.ts");
    const domain = req.body?.domain ? String(req.body.domain) : undefined;
    const r = await runCurriculumIngest({ onlyDomain: domain, maxUnits: 1 });
    res.status(r.ok ? 200 : 400).json(r);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "study failed" });
  }
});

// ── The Promise ledger + quiet mode ──────────────────────────────────
systemRouter.get("/promises", async (_req: Request, res: Response) => {
  try {
    const { lapseSweep, listOpenPromises } = await import("../productivity/promises.ts");
    const { ensureQuietState } = await import("../planning/quiet.ts");
    await lapseSweep();
    const [promises, quiet] = await Promise.all([listOpenPromises(), ensureQuietState()]);
    res.json({
      promises: promises.map((p: any) => ({ id: p.id, direction: p.direction, counterpart: p.counterpart, text: p.text, dueAt: p.dueAt, status: p.status })),
      quiet: { active: quiet.active, until: quiet.until ?? null, reason: quiet.reason ?? null },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load the ledger" });
  }
});
systemRouter.post("/promises", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    switch (body.op) {
      case "resolve": {
        if (!body.id || !["kept", "dropped"].includes(body.status)) return res.status(400).json({ error: "resolve needs id + status kept|dropped" });
        const { resolvePromise } = await import("../productivity/promises.ts");
        const p = await resolvePromise(String(body.id), body.status);
        if (!p) return res.status(409).json({ error: "already resolved" });
        return res.json({ ok: true, promise: { id: p.id, status: p.status } });
      }
      case "add": {
        const { addPromise } = await import("../productivity/promises.ts");
        const p = await addPromise({ direction: body.direction === "waiting_on" ? "waiting_on" : "owed_by_cole", counterpart: String(body.counterpart ?? ""), text: String(body.text ?? ""), dueAt: body.due ?? undefined, sourceType: "cole" });
        return res.json({ ok: true, id: p.id });
      }
      case "quiet": {
        const ms = (Number(body.days ?? 0) || 0) * 86400_000 + (Number(body.hours ?? 0) || 0) * 3600_000;
        if (ms <= 0) return res.status(400).json({ error: "quiet needs days and/or hours > 0" });
        const { quietUntil } = await import("../planning/quiet.ts");
        const r = await quietUntil(new Date(Date.now() + ms).toISOString(), String(body.reason ?? "away"));
        if (!r.ok) return res.status(400).json({ error: r.error });
        return res.json({ ok: true, until: r.until, leadsShifted: r.leadsShifted });
      }
      case "quiet_end": {
        const { endQuietNow } = await import("../planning/quiet.ts");
        const state = await endQuietNow();
        return res.json({ ok: true, restored: !!state.restored, summary: state.summary ?? null });
      }
      default:
        return res.status(400).json({ error: `unknown op: ${body.op}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Action failed" });
  }
});

// ── The Rituals dial (schedule control) — NOW LIVE ───────────────────
// This runs in the process that actually holds the node-schedule registry, so
// unlike the old Next route (whose registry was always empty), the dials work.
systemRouter.get("/schedule", async (_req: Request, res: Response) => {
  try {
    const { listSchedules } = await import("../core/schedule.ts");
    const rituals = listSchedules();
    res.json({ live: rituals.length > 0, rituals });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to list rituals" });
  }
});
systemRouter.post("/schedule", async (req: Request, res: Response) => {
  try {
    const { listSchedules, setSchedule, setEnabled } = await import("../core/schedule.ts");
    const { op, name, time } = req.body ?? {};
    if (!["retime", "pause", "resume"].includes(op) || !name || typeof name !== "string") {
      return res.status(400).json({ error: "op (retime|pause|resume) + name required" });
    }
    if (listSchedules().length === 0) {
      return res.status(409).json({ error: "The schedule registry isn't populated in this process." });
    }
    if (op === "retime") {
      if (!time || typeof time !== "string") return res.status(400).json({ error: "time required for retime, e.g. “6:30” or “7am”" });
      const r = await setSchedule(name, time);
      if (!r.ok) return res.status(400).json({ error: r.error });
      return res.json({ ok: true, name: r.name, label: r.label, time: r.time, cadence: r.cadence });
    }
    const r = await setEnabled(name, op === "resume");
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json({ ok: true, name: r.name, label: r.label, enabled: r.enabled });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Ritual control failed" });
  }
});

// ── The Brain shelf (compiled lens) ──────────────────────────────────
function brainRuleText(sig: any): string {
  if (sig && typeof sig === "object" && typeof sig.recurringReasoningTheme === "string") return sig.recurringReasoningTheme.trim();
  return "";
}
function brainOneLine(v: any): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  try { return JSON.stringify(v); } catch { return String(v); }
}
systemRouter.get("/brain-mind", async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import("../core/db/prisma.ts");
    const FIRED_MSG = "decision:patterns_fired";
    const [patterns, personaRows, factCount, firedRows] = await Promise.all([
      prisma.compiledPattern.findMany({
        where: { status: { in: ["confirmed_heuristic", "proposed_heuristic"] }, patternType: "heuristic" },
        orderBy: [{ status: "asc" }, { confidenceScore: "desc" }],
        select: { id: true, domain: true, status: true, patternSignature: true, confidenceScore: true, supportCount: true, validatedCount: true, ratifiedCount: true, updatedAt: true },
      }),
      prisma.knowledgeEntry.findMany({ where: { scope: "persona", active: true }, orderBy: { updatedAt: "desc" }, select: { key: true, value: true, updatedAt: true } }),
      prisma.compiledPattern.count({ where: { status: "auto_factual" } }),
      prisma.logEntry.findMany({ where: { message: FIRED_MSG }, orderBy: { createdAt: "desc" }, take: 2000, select: { context: true } }),
    ]);
    const fired = new Map<string, number>();
    for (const row of firedRows) {
      const ids = (row.context as any)?.patternIds;
      if (!Array.isArray(ids)) continue;
      for (const id of ids) if (typeof id === "string") fired.set(id, (fired.get(id) ?? 0) + 1);
    }
    res.json({
      rules: patterns.map((p: any) => ({
        id: p.id, rule: brainRuleText(p.patternSignature) || "(a compiled rule with no rendered text)", domain: p.domain,
        status: p.status, trust: p.confidenceScore ?? 0, support: p.supportCount ?? 0, validated: p.validatedCount ?? 0,
        ratified: p.ratifiedCount ?? 0, fired: fired.get(p.id) ?? 0, updatedAt: p.updatedAt,
      })),
      persona: personaRows.map((e: any) => ({ key: e.key, value: brainOneLine(e.value), updatedAt: e.updatedAt })),
      factCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load the lens" });
  }
});
systemRouter.post("/brain-mind", async (req: Request, res: Response) => {
  try {
    const { prisma } = await import("../core/db/prisma.ts");
    const { op, patternId } = req.body ?? {};
    if (!["confirm", "retire"].includes(op) || !patternId || typeof patternId !== "string") {
      return res.status(400).json({ error: "op (confirm|retire) + patternId required" });
    }
    const p = await prisma.compiledPattern.findUnique({ where: { id: patternId } });
    if (!p) return res.status(404).json({ error: "no such pattern" });
    if (p.status === "discarded") return res.status(409).json({ error: "that rule is already retired" });
    if (op === "confirm" && p.status === "confirmed_heuristic") return res.status(409).json({ error: "that rule is already confirmed" });
    const rule = (brainRuleText(p.patternSignature) || "a compiled rule").slice(0, 200);
    const { executeAction } = await import("../autonomy/executor.ts");
    const result = await executeAction(
      op === "confirm"
        ? { actionClass: "pattern.confirm", sourceType: "heuristic_confirm", sourceId: `pattern:${p.id}`, prepare: async () => ({ title: "Confirm a rule from the Brain shelf", body: `You asked, from the Brain shelf, to confirm:\n\n“${rule}”\n\nConfirm and it starts grounding reasoning. Dismiss and it stays an observation, steering nothing.`, domain: "personal", payload: { patternId: p.id } }) }
        : { actionClass: "pattern.retire", sourceType: "heuristic_retire", sourceId: `pattern-retire:${p.id}`, prepare: async () => ({ title: "Retire a rule from the Brain shelf", body: `You asked, from the Brain shelf, to retire:\n\n“${rule}”\n\nConfirm and it stops loading — kept as an observation only. Dismiss and it stands.`, domain: "personal", payload: { patternId: p.id } }) }
    );
    res.json({
      ok: true, staged: true, finalized: result.finalized, bridgeSignalId: result.bridgeSignalId,
      message: op === "confirm" ? "Staged for your confirm on Decisions — the rule changes only on your tap." : "Retirement staged for your confirm on Decisions — the rule stands until your tap.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Staging failed" });
  }
});
