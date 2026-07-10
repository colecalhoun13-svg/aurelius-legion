// aurelius/router/ritualsRouter.ts — the push, on demand. Mounted at /api/rituals.

import { Router, type Request, type Response } from "express";
import {
  generateMorningBriefing,
  generateNightlyDebrief,
  getLatestRituals,
} from "../rituals/engine.ts";

export const ritualsRouter = Router();

ritualsRouter.get("/latest", async (_req: Request, res: Response) => {
  try {
    res.json(await getLatestRituals());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

ritualsRouter.post("/morning/run", async (req: Request, res: Response) => {
  try {
    const { instance, briefing } = await generateMorningBriefing(req.body?.date);
    res.json({ instanceId: instance.id, briefing });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

ritualsRouter.post("/nightly/run", async (req: Request, res: Response) => {
  try {
    const { instance, debrief } = await generateNightlyDebrief(req.body?.date);
    res.json({ instanceId: instance.id, debrief });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
