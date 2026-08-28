// aurelius/router/athleteRouter.ts — the Athletes roster + one athlete's view,
// plus Athlete Zero (Cole's own record). Mounted at /api/athletes. Moved here
// from the Next routes so the coaching plane runs in one process. Static /zero
// is registered BEFORE /:id so it isn't swallowed by the param route.

import { Router, type Request, type Response } from "express";

export const athleteRouter = Router();

// ── The roster (every athlete: client AND training-only) + test battery ──
athleteRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const { athleteRoster } = await import("../crm/performance.ts");
    const { BATTERY, batteryRecords } = await import("../training/battery.ts");
    const [athletes, records] = await Promise.all([athleteRoster(), batteryRecords()]);
    res.json({ athletes, battery: BATTERY, records });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load athletes" });
  }
});

athleteRouter.post("/", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const { addClient, promoteClient } = await import("../crm/service.ts");
    switch (b.action) {
      case "add": {
        const gradYearRaw = b.gradYear;
        const gradYear = gradYearRaw === undefined || gradYearRaw === null || gradYearRaw === "" ? undefined : Number(gradYearRaw);
        if (gradYear !== undefined && !Number.isInteger(gradYear)) throw new Error("Grad year must be a whole year.");
        const client = await addClient({ name: String(b.name ?? ""), kind: b.kind ? String(b.kind) : undefined, sport: b.sport ? String(b.sport) : undefined, position: b.position ? String(b.position) : undefined, gradYear, notes: b.notes ? String(b.notes) : undefined });
        return res.json({ id: client.id, name: client.name, kind: client.kind });
      }
      case "promote": {
        const id = String(b.id ?? "");
        if (!id) throw new Error("Which athlete?");
        const client = await promoteClient(id);
        return res.json({ id: client.id, name: client.name, kind: client.kind });
      }
      case "battery": {
        const clientId = String(b.clientId ?? "");
        if (!clientId) throw new Error("Which athlete?");
        const { logBattery } = await import("../training/battery.ts");
        const entries = Array.isArray(b.entries) ? b.entries.map((e: any) => ({ label: String(e?.label ?? ""), value: Number(e?.value), unit: e?.unit ? String(e.unit) : undefined })) : [];
        return res.json(await logBattery(clientId, entries));
      }
      default:
        throw new Error(`Unknown action: ${b.action}. Expected add, promote, or battery.`);
    }
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Athlete action failed" });
  }
});

// ── ATHLETE ZERO (Cole's own record) — static, BEFORE /:id ──────────────
athleteRouter.get("/zero", async (_req: Request, res: Response) => {
  try {
    const { athleteZeroSummary } = await import("../athlete/self.ts");
    const { whoopStatus } = await import("../health/whoop.ts");
    const z = await athleteZeroSummary();
    res.json({
      athlete: z.self.name, readiness: z.readiness, whoop: whoopStatus(), sheetUrl: z.sheetUrl,
      series: z.performance?.series ?? [], targets: z.performance?.targets ?? [], curves: z.curves?.curves ?? [], experiments: z.experiments ?? [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load Athlete Zero" });
  }
});

athleteRouter.post("/zero", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const self = await import("../athlete/self.ts");
    const exp = await import("../athlete/experiments.ts");
    if (b.op === "log") { const r = await self.logSelfMetric({ label: b.label, value: Number(b.value), unit: b.unit }); return r.ok ? res.json(r) : res.status(400).json({ error: r.error }); }
    if (b.op === "target") { const r = await self.setSelfTarget({ label: b.label, targetValue: Number(b.targetValue), unit: b.unit, targetDate: b.targetDate }); return r.ok ? res.json(r) : res.status(400).json({ error: r.error }); }
    if (b.op === "sheet") { const r = await self.linkSelfSheet(String(b.url ?? "")); return r.ok ? res.json(r) : res.status(400).json({ error: r.error }); }
    if (b.op === "exp_start") { const r = await exp.startExperiment({ hypothesis: b.hypothesis, metricLabel: b.metricLabel, protocol: b.protocol, endAt: b.endAt }); return r.ok ? res.json(r) : res.status(400).json({ error: r.error }); }
    if (b.op === "exp_conclude") { const r = await exp.concludeExperiment(String(b.id ?? "")); return r.ok ? res.json(r) : res.status(400).json({ error: r.error }); }
    if (b.op === "exp_abandon") { const r = await exp.abandonExperiment(String(b.id ?? "")); return r.ok ? res.json(r) : res.status(400).json({ error: r.error }); }
    return res.status(400).json({ error: "unknown zero write" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Zero write failed" });
  }
});

// ── One athlete's full performance view ─────────────────────────────────
athleteRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { athletePerformance } = await import("../crm/performance.ts");
    const view = await athletePerformance(String(req.params.id));
    if (!view) return res.status(404).json({ error: "no such athlete" });
    res.json(view);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load the athlete" });
  }
});

athleteRouter.post("/:id", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const clientId = String(req.params.id);
    switch (b.action) {
      case "setTarget": {
        const targetValue = Number(b.targetValue);
        if (!Number.isFinite(targetValue)) throw new Error("A target needs a number.");
        const { setTarget } = await import("../crm/targets.ts");
        const target = await setTarget({ clientId, label: String(b.label ?? ""), targetValue, unit: b.unit ? String(b.unit) : undefined, targetDate: b.targetDate ? String(b.targetDate) : undefined, note: b.note ? String(b.note) : undefined });
        return res.json({ id: target.id });
      }
      case "dropTarget": {
        const targetId = String(b.targetId ?? "");
        if (!targetId) throw new Error("Which target?");
        const { dropTarget } = await import("../crm/targets.ts");
        await dropTarget(targetId);
        return res.json({ ok: true });
      }
      case "linkSheet": {
        const { updateClient } = await import("../crm/service.ts");
        await updateClient(clientId, { sheetUrl: String(b.sheetUrl ?? "") });
        return res.json({ ok: true });
      }
      case "findSheet": {
        const { resolveAthleteSheet } = await import("../crm/performance.ts");
        return res.json(await resolveAthleteSheet(clientId));
      }
      case "sessionFeedback": {
        const { sessionFeedbackForAthlete } = await import("../training/sessionFeedback.ts");
        return res.json(await sessionFeedbackForAthlete(clientId));
      }
      default:
        throw new Error(`Unknown action: ${b.action}. Expected setTarget, dropTarget, linkSheet, findSheet, or sessionFeedback.`);
    }
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Athlete action failed" });
  }
});
