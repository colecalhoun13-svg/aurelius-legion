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
