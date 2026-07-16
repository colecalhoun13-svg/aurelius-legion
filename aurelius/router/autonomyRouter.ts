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
