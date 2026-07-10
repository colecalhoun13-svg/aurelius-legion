// aurelius/router/missionsRouter.ts — the autonomy surface. Mounted at /api/missions.

import { Router, type Request, type Response } from "express";
import {
  launchMission,
  listMissions,
  getMission,
  cancelMission,
  runMission,
} from "../missions/engine.ts";

export const missionsRouter = Router();

missionsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.json({ missions: await listMissions() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

missionsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    if (!b.objective || typeof b.objective !== "string") {
      return res.status(400).json({ error: "objective required" });
    }
    // Launches in the background; the mission row returns immediately
    // and the Aurelius page watches it move.
    const mission = await launchMission({
      title: b.title,
      objective: b.objective,
      domain: b.domain,
      operatorName: b.operatorName,
      priority: b.priority,
    });
    res.json({ mission });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// Static route BEFORE /:id — Express matches in order.
missionsRouter.post("/initiative/run", async (_req: Request, res: Response) => {
  try {
    const { runInitiativePulse } = await import("../autonomy/initiative.ts");
    res.json(await runInitiativePulse());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

missionsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const mission = await getMission(String(req.params.id));
    if (!mission) return res.status(404).json({ error: "not found" });
    res.json({ mission });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

missionsRouter.post("/:id/run", async (req: Request, res: Response) => {
  try {
    res.json({ mission: await runMission(String(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

missionsRouter.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    res.json({ mission: await cancelMission(String(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
