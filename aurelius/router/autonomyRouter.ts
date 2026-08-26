import { Router, Request, Response } from "express";
import { routeTask } from "../core/engineRouter.ts";
import type { RoutedTask } from "../core/engineTypes.ts";

export const autonomyRouter = Router();

autonomyRouter.post("/tick", async (req: Request, res: Response) => {
  try {
    const task: RoutedTask = {
      id: `autonomy-${Date.now()}`,
      type: "autonomy",
      payload: req.body || {},
      source: "system",
    };

    const result = await routeTask(task);
    res.json(result);
  } catch (err) {
    console.error("Autonomy tick error:", err);
    res.status(500).json({ error: "Autonomy tick failed" });
  }
});

autonomyRouter.get("/status", (req: Request, res: Response) => {
  res.json({ status: "autonomy router active" });
});

// ── The acting layer: autonomy grants (NORTH_STAR §2.5) ──────────────
// GET  /api/autonomy/grants          — active grants + the full grantable menu
// POST /api/autonomy/grants          — { actionClass, note? }  grant a keyhole
// POST /api/autonomy/grants/revoke   — { actionClass }         revoke a keyhole

autonomyRouter.get("/grants", async (_req: Request, res: Response) => {
  try {
    const { listActiveGrants } = await import("../autonomy/grants.ts");
    const { listAllActionClasses } = await import("../autonomy/actionClasses.ts");
    res.json({ active: await listActiveGrants(), classes: listAllActionClasses() });
  } catch (err: any) {
    console.error("[autonomy] list grants error:", err);
    res.status(500).json({ error: err?.message ?? "failed to list grants" });
  }
});

autonomyRouter.post("/grants", async (req: Request, res: Response) => {
  const { actionClass, note } = req.body ?? {};
  if (!actionClass || typeof actionClass !== "string") {
    return res.status(400).json({ error: "actionClass is required" });
  }
  try {
    const { grantAutonomy } = await import("../autonomy/grants.ts");
    const grant = await grantAutonomy({ actionClass, note });
    res.json({ ok: true, grant });
  } catch (err: any) {
    // A refusal (outward / training / autonomy / unknown) is a 400, not a 500 —
    // it's Cole asking for something non-grantable, answered honestly.
    res.status(400).json({ ok: false, error: err?.message ?? "grant refused" });
  }
});

autonomyRouter.post("/grants/revoke", async (req: Request, res: Response) => {
  const { actionClass } = req.body ?? {};
  if (!actionClass || typeof actionClass !== "string") {
    return res.status(400).json({ error: "actionClass is required" });
  }
  try {
    const { revokeAutonomy } = await import("../autonomy/grants.ts");
    const revoked = await revokeAutonomy(actionClass);
    res.json({ ok: true, revoked: revoked !== null });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "revoke failed" });
  }
});

// ── The Autonomy DIAL (Tuning Room) ──────────────────────────────────
// GET  /api/autonomy/dial  — active grants + the grantable menu with each
//   keyhole's trust track record, the locked dials with their refusal reason,
//   the "want me to handle it?" suggestions, recent undoable actions, and the
//   14-day autonomy flow. Moved here from the Next route so the composite runs
//   in the one process that owns the registry + DB, not a second copy.
autonomyRouter.get("/dial", async (req: Request, res: Response) => {
  try {
    const { listActiveGrants } = await import("../autonomy/grants.ts");
    const { listGrantableClasses, listAllActionClasses } = await import("../autonomy/actionClasses.ts");
    const { getTrustLedger, suggestNextGrant } = await import("../autonomy/trustLedger.ts");
    const { prisma } = await import("../core/db/prisma.ts");

    const [active, ledger, suggestions] = await Promise.all([listActiveGrants(), getTrustLedger(), suggestNextGrant()]);
    const grantable = listGrantableClasses();
    const activeKeys = new Set(active.map((g: any) => g.actionClass));
    const ledgerBy = new Map(ledger.map((r: any) => [r.actionClass, r]));

    const classes = grantable.map((c: any) => {
      const l: any = ledgerBy.get(c.key);
      return {
        key: c.key,
        description: c.description,
        on: activeKeys.has(c.key),
        trackRecord: l ? { acted: l.acted, confirmed: l.confirmed, undone: l.undone, failed: l.failed } : null,
      };
    });
    const locked = listAllActionClasses()
      .filter((c: any) => !c.grantable)
      .map((c: any) => ({ key: c.key, description: c.description, reason: c.grantReason }));

    const daysParam = Number(new URL(req.url, "http://x").searchParams.get("days"));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 7;
    const acted = await prisma.bridgeSignal.findMany({
      where: { status: "acted", createdAt: { gte: new Date(Date.now() - days * 24 * 3600 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const recentActions = acted
      .filter((s: any) => ((s.actions as any[]) ?? []).some((a) => a?.action === "undo_action"))
      .slice(0, days > 7 ? 50 : 10)
      .map((s: any) => ({
        id: s.id,
        title: s.title,
        kind: s.kind,
        createdAt: s.createdAt,
        actionClass: ((s.actions as any[]) ?? []).find((a) => a?.action === "undo_action")?.payload?.actionClass ?? null,
      }));

    const flow = await prisma.bridgeSignal.findMany({
      where: { status: { in: ["acted", "confirmed", "undone"] }, createdAt: { gte: new Date(Date.now() - 14 * 24 * 3600 * 1000) } },
      select: { status: true, createdAt: true },
    });

    res.json({
      active: active.map((g: any) => ({ actionClass: g.actionClass, grantedAt: g.grantedAt })),
      classes,
      locked,
      suggestions,
      recentActions,
      flow,
    });
  } catch (err: any) {
    console.error("[autonomy] dial error:", err);
    res.status(500).json({ error: err?.message ?? "failed to load autonomy dial" });
  }
});

// POST /api/autonomy/dial  — { op: "grant" | "revoke", actionClass }. Cole's own
// hand on the switch (a UI click is his explicit action; the model-invoked tool
// gates instead). grantAutonomy refuses a non-grantable class with an honest 400.
autonomyRouter.post("/dial", async (req: Request, res: Response) => {
  const { op, actionClass } = req.body ?? {};
  if (!actionClass || typeof actionClass !== "string") {
    return res.status(400).json({ error: "actionClass is required" });
  }
  try {
    if (op === "grant") {
      const { grantAutonomy } = await import("../autonomy/grants.ts");
      const grant = await grantAutonomy({ actionClass, grantedBy: "cole", note: "granted from the Autonomy dial" });
      return res.json({ ok: true, grant });
    }
    if (op === "revoke") {
      const { revokeAutonomy } = await import("../autonomy/grants.ts");
      const revoked = await revokeAutonomy(actionClass);
      return res.json({ ok: true, revoked: revoked !== null });
    }
    return res.status(400).json({ error: `unknown op "${op}"` });
  } catch (err: any) {
    // grant refusal (outward/training/autonomy/unknown) → honest 400.
    return res.status(400).json({ ok: false, error: err?.message ?? "action failed" });
  }
});

// Cole confirms a gated proposal from the Bridge → commit it now.
autonomyRouter.post("/confirm", async (req: Request, res: Response) => {
  const { signalId } = req.body ?? {};
  if (!signalId || typeof signalId !== "string") {
    return res.status(400).json({ error: "signalId is required" });
  }
  try {
    const { confirmAction } = await import("../autonomy/executor.ts");
    const result = await confirmAction(signalId);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "confirm failed" });
  }
});

// Reverse an executed action — the real "undo" (master-class #4). Given a
// bridgeSignalId that carries an undo_action, runs the registered inverse.
autonomyRouter.post("/undo", async (req: Request, res: Response) => {
  const { signalId } = req.body ?? {};
  if (!signalId || typeof signalId !== "string") {
    return res.status(400).json({ error: "signalId is required" });
  }
  try {
    const { undoAction } = await import("../autonomy/executor.ts");
    const { registerAllActions } = await import("../autonomy/registerActions.ts");
    registerAllActions(); // inverses live in the registry; ensure it's populated
    const result = await undoAction(signalId);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "undo failed" });
  }
});

// Run the first acting workflow on demand — schedule-protection.
// Acts if granted, proposes on the Bridge if not.
autonomyRouter.post("/schedule-protection/run", async (req: Request, res: Response) => {
  try {
    const { runScheduleProtection } = await import("../autonomy/workflows/scheduleProtection.ts");
    const result = await runScheduleProtection(req.body ?? {});
    res.json({ ok: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "schedule-protection failed" });
  }
});

// Run inbox triage on demand — drafts replies, acts if granted else proposes.
autonomyRouter.post("/inbox-triage/run", async (req: Request, res: Response) => {
  try {
    const { runInboxTriage } = await import("../autonomy/workflows/inboxTriage.ts");
    const result = await runInboxTriage(req.body ?? {});
    res.json({ ok: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "inbox-triage failed" });
  }
});
