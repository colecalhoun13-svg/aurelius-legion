// aurelius/router/crmRouter.ts
//
// Express surface for the Client Engine. Thin: every route delegates to
// aurelius/crm/service.ts. Mounted at /api/crm.
//
// ROUTE ORDER MATTERS. Express matches in registration order, so every static
// path (/pipeline, /attention, /outstanding, /leads, /clients) is declared
// BEFORE any /:id route. Registering /clients/:id first would swallow
// /clients/roster and return "no client with id roster".

import { Router, type Request, type Response } from "express";
import {
  addLead,
  listLeads,
  updateLead,
  convertLead,
  addClient,
  listClients,
  updateClient,
  addEngagement,
  listEngagements,
  updateEngagement,
  logSession,
  raiseInvoice,
  recordPayment,
  outstandingInvoices,
  whatNeedsAttention,
  pipelineSnapshot,
  clientDetail,
} from "../crm/service.ts";

export const crmRouter = Router();

/** Service errors are Cole-facing validation messages, not server faults. */
function fail(res: Response, err: any) {
  const message = err?.message ?? String(err);
  const isValidation = /must be one of|needs a|No client|No lead|No invoice|No engagement|No such target|not a valid|already been converted|already a full client|is training-only|doesn't parse|sheetUrl must be|Be more specific|isn't a payment|cannot be negative/i.test(
    message
  );
  res.status(isValidation ? 400 : 500).json({ error: message });
}

// ── static routes FIRST ──────────────────────────────────────────────

crmRouter.get("/pipeline", async (_req: Request, res: Response) => {
  try {
    res.json(await pipelineSnapshot());
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.get("/attention", async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 14;
    res.json(await whatNeedsAttention(days));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.get("/outstanding", async (_req: Request, res: Response) => {
  try {
    const rows = await outstandingInvoices();
    res.json({ count: rows.length, totalCents: rows.reduce((s, r) => s + r.outstandingCents, 0), invoices: rows });
  } catch (err) {
    fail(res, err);
  }
});

// ── lead acquisition ─────────────────────────────────────────────────

/** Bulk-add the people Cole already knows. */
crmRouter.post("/warm-list", async (req: Request, res: Response) => {
  try {
    const { importWarmList } = await import("../crm/leadEngine.ts");
    const body = req.body ?? {};
    res.json(await importWarmList(Array.isArray(body.entries) ? body.entries : [], { source: body.source }));
  } catch (err) {
    fail(res, err);
  }
});

/** Draft outreach for every lead whose follow-up is due. */
crmRouter.post("/outreach/sweep", async (req: Request, res: Response) => {
  try {
    const { runOutreachSweep } = await import("../crm/leadEngine.ts");
    res.json(await runOutreachSweep({ max: Number(req.body?.max) || undefined }));
  } catch (err) {
    fail(res, err);
  }
});

// ── leads ────────────────────────────────────────────────────────────

crmRouter.get("/leads", async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const source = typeof req.query.source === "string" ? req.query.source : undefined;
    res.json({ leads: await listLeads({ status, source }) });
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/leads", async (req: Request, res: Response) => {
  try {
    res.json(await addLead(req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.patch("/leads/:id", async (req: Request, res: Response) => {
  try {
    res.json(await updateLead(String(req.params.id), req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

/** Draft a personal message to one lead. Inward — writes a Gmail draft only. */
crmRouter.post("/leads/:id/draft", async (req: Request, res: Response) => {
  try {
    const { draftOutreach } = await import("../crm/leadEngine.ts");
    const out = await draftOutreach(String(req.params.id));
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json(out);
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/leads/:id/convert", async (req: Request, res: Response) => {
  try {
    res.json(await convertLead(String(req.params.id), req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

// ── clients ──────────────────────────────────────────────────────────

crmRouter.get("/clients", async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    res.json({ clients: await listClients({ status, kind }) });
  } catch (err) {
    fail(res, err);
  }
});

// STATIC BEFORE :param (see header) — /clients/roster must precede /clients/:id.
crmRouter.get("/clients/roster", async (_req: Request, res: Response) => {
  try {
    const { athleteRoster } = await import("../crm/performance.ts");
    res.json({ athletes: await athleteRoster() });
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/clients", async (req: Request, res: Response) => {
  try {
    res.json(await addClient(req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.get("/clients/:id", async (req: Request, res: Response) => {
  try {
    const detail = await clientDetail(String(req.params.id));
    if (!detail) return res.status(404).json({ error: "No such client." });
    res.json(detail);
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.patch("/clients/:id", async (req: Request, res: Response) => {
  try {
    res.json(await updateClient(String(req.params.id), req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

// The one door from the training roster into the business machinery.
crmRouter.post("/clients/:id/promote", async (req: Request, res: Response) => {
  try {
    const { promoteClient } = await import("../crm/service.ts");
    const client = await promoteClient(String(req.params.id));
    res.json({ clientId: client.id, name: client.name, kind: client.kind });
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.get("/clients/:id/performance", async (req: Request, res: Response) => {
  try {
    const { athletePerformance } = await import("../crm/performance.ts");
    const view = await athletePerformance(String(req.params.id));
    if (!view) return res.status(404).json({ error: "No such athlete." });
    res.json(view);
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/clients/:id/targets", async (req: Request, res: Response) => {
  try {
    const { setTarget } = await import("../crm/targets.ts");
    res.json(await setTarget({ ...(req.body ?? {}), clientId: String(req.params.id), targetValue: Number(req.body?.targetValue) }));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.delete("/targets/:id", async (req: Request, res: Response) => {
  try {
    const { dropTarget } = await import("../crm/targets.ts");
    res.json(await dropTarget(String(req.params.id)));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/clients/:id/sheet/find", async (req: Request, res: Response) => {
  try {
    const { resolveAthleteSheet } = await import("../crm/performance.ts");
    res.json(await resolveAthleteSheet(String(req.params.id)));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/clients/:id/battery", async (req: Request, res: Response) => {
  try {
    const { logBattery } = await import("../training/battery.ts");
    res.json(await logBattery(String(req.params.id), Array.isArray(req.body?.entries) ? req.body.entries : []));
  } catch (err) {
    fail(res, err);
  }
});

// STATIC route — but it lives under /battery, not /clients/:id, so order is safe.
crmRouter.get("/battery/records", async (_req: Request, res: Response) => {
  try {
    const { batteryRecords, BATTERY } = await import("../training/battery.ts");
    res.json({ battery: BATTERY, records: await batteryRecords() });
  } catch (err) {
    fail(res, err);
  }
});

// The pass-2 review engine, reachable from the Athletes tab: most recent
// session in their sheet → reasoned feedback → written to the Feedback tab.
crmRouter.post("/clients/:id/session-feedback", async (req: Request, res: Response) => {
  try {
    const { sessionFeedbackForAthlete } = await import("../training/sessionFeedback.ts");
    res.json(await sessionFeedbackForAthlete(String(req.params.id)));
  } catch (err) {
    fail(res, err);
  }
});

// ── engagements ──────────────────────────────────────────────────────

crmRouter.get("/engagements", async (req: Request, res: Response) => {
  try {
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const shape = typeof req.query.shape === "string" ? req.query.shape : undefined;
    res.json({ engagements: await listEngagements({ clientId, status, shape }) });
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/engagements", async (req: Request, res: Response) => {
  try {
    res.json(await addEngagement(req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.patch("/engagements/:id", async (req: Request, res: Response) => {
  try {
    res.json(await updateEngagement(String(req.params.id), req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

// ── sessions + money ─────────────────────────────────────────────────

crmRouter.post("/sessions", async (req: Request, res: Response) => {
  try {
    res.json(await logSession(req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/invoices", async (req: Request, res: Response) => {
  try {
    res.json(await raiseInvoice(req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});

crmRouter.post("/payments", async (req: Request, res: Response) => {
  try {
    res.json(await recordPayment(req.body ?? {}));
  } catch (err) {
    fail(res, err);
  }
});
