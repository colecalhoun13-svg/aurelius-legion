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

// ═══ Business-page surfaces (moved here from the Next routes so the whole
// business plane runs in one process). Static paths, registered before the
// /:param routes below. Dynamic imports keep the module graph flat. ═══

// The Business dashboard — everything the page needs in one round trip.
crmRouter.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const { pipelineSnapshot, whatNeedsAttention, listClients, listLeads } = await import("../crm/service.ts");
    const { anglePerformance } = await import("../business/marketing.ts");
    const { listOffers, offerReadiness, offerProbeStanding } = await import("../business/offers.ts");
    const { listDrafts, queueState } = await import("../content/queue.ts");
    const { moneyLedger } = await import("../crm/ledger.ts");
    const { listTrackLinks } = await import("../crm/trackLinks.ts");
    const { businessAnalystRead } = await import("../business/analyst.ts");
    const [pipeline, attention, clients, leads, marketing, offers, offerState, drafts, contentState, ledger, probe, trackLinks, analyst] = await Promise.all([
      pipelineSnapshot(), whatNeedsAttention(14), listClients({ kind: "client" }), listLeads({ limit: 200 }),
      anglePerformance(), listOffers(), offerReadiness(), listDrafts({}), queueState(), moneyLedger(), offerProbeStanding(), listTrackLinks({ limit: 20 }), businessAnalystRead(),
    ]);
    res.json({ pipeline, attention, clients, leads, marketing, offers, offerState, drafts, contentState, ledger, probe, trackLinks, analyst });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load the business" });
  }
});

// Content queue (inward keep/edit/discard/plan; publish stages a Bridge confirm).
crmRouter.get("/content", async (_req: Request, res: Response) => {
  try {
    const { listDrafts, queueState, cadenceTruth } = await import("../content/queue.ts");
    const [drafts, state, cadence] = await Promise.all([listDrafts({}), queueState(), cadenceTruth()]);
    res.json({ drafts, state, cadence });
  } catch (err: any) { res.status(500).json({ error: err?.message ?? "Failed to load the queue" }); }
});
crmRouter.post("/content", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const q = await import("../content/queue.ts");
    switch (b.kind) {
      case "keep": { const out = await q.saveDraft(b); if (!out.ok) throw new Error(out.error ?? "Could not keep that"); return res.json(out); }
      case "edit": { if (!b.draftId) throw new Error("Which draft?"); const out = await q.updateDraft(String(b.draftId), b); if (!out.ok) throw new Error(out.error ?? "Could not update"); return res.json(out); }
      case "discard": { if (!b.draftId) throw new Error("Which draft?"); const out = await q.discardDraft(String(b.draftId)); if (!out.ok) throw new Error(out.error ?? "Could not discard"); return res.json(out); }
      case "publish": { if (!b.draftId) throw new Error("Which draft?"); const out = await q.stageForPublish(String(b.draftId)); if (!out.ok) throw new Error(out.error ?? "Could not stage"); return res.json(out); }
      case "plan_slots": return res.json(await q.planSlots(b.perWeek != null ? Number(b.perWeek) : undefined));
      default: throw new Error(`Unknown kind: ${b.kind}. Expected keep, edit, discard, publish, or plan_slots.`);
    }
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Content action failed" }); }
});

// Growth (integration status + paid boost + partnerships).
crmRouter.get("/growth", async (_req: Request, res: Response) => {
  try {
    const { stripeConfigured } = await import("../crm/selfRecord.ts");
    const { twilioConfigured } = await import("../crm/sms.ts");
    const { paidAdsConfigured, boostStanding } = await import("../business/paidBoost.ts");
    const { retentionAnalytics } = await import("../crm/retention.ts");
    const [boost, analytics] = await Promise.all([boostStanding(), retentionAnalytics()]);
    res.json({ integrations: { stripe: stripeConfigured(), twilio: twilioConfigured(), paidAds: paidAdsConfigured() }, boost, analytics });
  } catch (err: any) { res.status(500).json({ error: err?.message ?? "Failed to load growth" }); }
});
crmRouter.post("/growth", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    switch (b.kind) {
      case "research_partners": { const { researchPartners } = await import("../business/partnership.ts"); return res.json(await researchPartners()); }
      case "partner_intro": { const { draftPartnerIntro } = await import("../business/partnership.ts"); const out = await draftPartnerIntro({ name: String(b.name ?? ""), handle: b.handle, angle: b.angle }); if (!out.ok) throw new Error(out.error ?? "Could not draft an intro"); return res.json(out); }
      case "propose_boost": { const { proposeBoost } = await import("../business/paidBoost.ts"); return res.json(await proposeBoost({ budgetCents: b.budgetCents, killCplCents: b.killCplCents })); }
      case "stage_boost": { const { stageBoost } = await import("../business/paidBoost.ts"); const out = await stageBoost({ budgetCents: b.budgetCents, killCplCents: b.killCplCents }); if (!out.ok) throw new Error(out.reason); return res.json(out); }
      default: throw new Error(`Unknown kind: ${b.kind}.`);
    }
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Growth action failed" }); }
});

// Marketing writes (inward: propose angles / draft asset / record outcome).
crmRouter.post("/marketing", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const m = await import("../business/marketing.ts");
    switch (b.kind) {
      case "propose": { const out = await m.proposeAngles({ count: Number(b.count) || undefined, audience: b.audience }); if (!out.ok) throw new Error(out.error ?? "Could not propose angles"); return res.json(out); }
      case "draft": { if (!b.angleId) throw new Error("Which angle?"); const out = await m.draftAsset(String(b.angleId), b.format); if (!out.ok) throw new Error(out.error ?? "Draft failed"); return res.json(out); }
      case "outcome": { if (!b.angleId) throw new Error("Which angle?"); const out = await m.recordOutcome(b); if (!out.ok) throw new Error(out.error ?? "Could not record that"); return res.json(await m.anglePerformance()); }
      default: throw new Error(`Unknown kind: ${b.kind}. Expected propose, draft, or outcome.`);
    }
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Marketing action failed" }); }
});

// Money (spend side read; inward book-entry writes).
crmRouter.get("/money", async (_req: Request, res: Response) => {
  try {
    const { expenseSummary, listExpenses } = await import("../business/expenses.ts");
    const { profitAndLoss } = await import("../business/pnl.ts");
    const [expenses, recent, pnl] = await Promise.all([expenseSummary(), listExpenses({ limit: 10 }), profitAndLoss().catch(() => null)]);
    res.json({ expenses, recent, pnl });
  } catch (err: any) { res.status(500).json({ error: err?.message ?? "Failed to load expenses" }); }
});
crmRouter.post("/money", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const s = await import("../crm/service.ts");
    switch (b.kind) {
      case "engagement": return res.json(await s.addEngagement(b));
      case "invoice": return res.json(await s.raiseInvoice(b));
      case "payment": return res.json(await s.recordPayment(b));
      case "session": { if (!b.clientId) throw new Error("Which client?"); const { kind, sessionKind, ...rest } = b; return res.json(await s.logSession({ ...rest, kind: sessionKind })); }
      case "client_patch": { if (!b.clientId) throw new Error("Which client?"); const { kind, clientId, ...patch } = b; return res.json(await s.updateClient(String(clientId), patch)); }
      case "engagement_patch": { if (!b.engagementId) throw new Error("Which engagement?"); const { kind, engagementId, ...patch } = b; return res.json(await s.updateEngagement(String(engagementId), patch)); }
      default: throw new Error(`Unknown kind: ${b.kind}. Expected engagement, invoice, payment, session, client_patch, or engagement_patch.`);
    }
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Failed to record that" }); }
});

// Offers (draft inward; activate is Cole's decision + a real price).
crmRouter.get("/offers", async (_req: Request, res: Response) => {
  try {
    const { listOffers, offerReadiness, offerProbeStanding } = await import("../business/offers.ts");
    const [offers, readiness, probe] = await Promise.all([listOffers(), offerReadiness(), offerProbeStanding()]);
    res.json({ offers, readiness, probe });
  } catch (err: any) { res.status(500).json({ error: err?.message ?? "Failed to load offers" }); }
});
crmRouter.post("/offers", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const o = await import("../business/offers.ts");
    switch (b.kind) {
      case "draft": { const out = await o.draftOffer({ shape: b.shape }); if (!out.ok) throw new Error(out.error ?? "Could not draft an offer"); return res.json(out); }
      case "activate": { if (!b.offerId) throw new Error("Which offer?"); const cents = Math.round(Number(b.price) * 100); if (!Number.isFinite(cents) || cents <= 0) throw new Error("Enter the price you'd actually charge."); const out = await o.activateOffer(String(b.offerId), { priceCents: cents }); if (!out.ok) throw new Error(out.error ?? "Could not activate"); return res.json(out); }
      case "retire": { if (!b.offerId) throw new Error("Which offer?"); const out = await o.retireOffer(String(b.offerId)); if (!out.ok) throw new Error(out.error ?? "Could not retire"); return res.json(out); }
      case "probe": { const out = await o.probeOffer({ variants: b.variants }); if (!out.ok) throw new Error(out.error ?? "Could not start a probe"); return res.json(out); }
      default: throw new Error(`Unknown kind: ${b.kind}. Expected draft, activate, retire, or probe.`);
    }
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Offer action failed" }); }
});

// Retention (per-client view + inward drafts). ?clientId= on GET.
crmRouter.get("/retention", async (req: Request, res: Response) => {
  try {
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
    if (!clientId) return res.status(400).json({ error: "clientId is required" });
    const { clientRetentionView } = await import("../crm/retention.ts");
    const view = await clientRetentionView(clientId);
    if (!view) return res.status(404).json({ error: "no such client" });
    res.json(view);
  } catch (err: any) { res.status(500).json({ error: err?.message ?? "Failed to load retention" }); }
});
crmRouter.post("/retention", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const clientId = String(b.clientId ?? "");
    if (!clientId) throw new Error("Which client?");
    const r = await import("../crm/retention.ts");
    switch (b.kind) {
      case "metric": { const value = Number(b.value); if (!b.label || !Number.isFinite(value)) throw new Error("A metric needs a label and a number."); return res.json(await r.logMetric({ clientId, label: String(b.label), value, unit: b.unit ? String(b.unit) : undefined, source: "coach" })); }
      case "proof": { const out = await r.draftProofContent(clientId); if (!out.ok) throw new Error(out.error ?? "Could not draft proof"); return res.json(out); }
      case "checkin": case "resign": case "referral": { const out = await r.draftClientMessage(clientId, b.kind); if (!out.ok) throw new Error(out.error ?? "Could not draft"); return res.json(out); }
      default: throw new Error(`Unknown kind: ${b.kind}. Expected metric, proof, checkin, resign, or referral.`);
    }
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Retention action failed" }); }
});

// Lead writes from the page: POST { action:"convert" | (new lead) }, PATCH update.
crmRouter.post("/leads-save", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const { addLead, convertLead } = await import("../crm/service.ts");
    if (b.action === "convert") { if (!b.id) throw new Error("Converting needs the lead's id."); return res.json(await convertLead(String(b.id), b)); }
    res.json(await addLead(b));
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Failed to save the lead" }); }
});
crmRouter.patch("/leads-save", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    if (!b.id) throw new Error("Updating needs the lead's id.");
    const { updateLead } = await import("../crm/service.ts");
    res.json(await updateLead(String(b.id), b));
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Failed to update the lead" }); }
});

// Lead acquisition: POST { kind: "warm_list" | "sweep" | "draft" }.
crmRouter.post("/leads-acquire", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const { draftOutreach, runOutreachSweep, importWarmList } = await import("../crm/leadEngine.ts");
    switch (b.kind) {
      case "warm_list": { if (!Array.isArray(b.entries) || b.entries.length === 0) throw new Error("Paste at least one person — a name per line is enough."); return res.json(await importWarmList(b.entries, { source: b.source })); }
      case "sweep": return res.json(await runOutreachSweep({ max: Number(b.max) || undefined }));
      case "draft": { if (!b.leadId) throw new Error("Which lead?"); const out = await draftOutreach(String(b.leadId)); if (!out.ok) throw new Error(out.error ?? "Draft failed"); return res.json(out); }
      default: throw new Error(`Unknown kind: ${b.kind}`);
    }
  } catch (err: any) { res.status(400).json({ error: err?.message ?? "Failed" }); }
});


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
