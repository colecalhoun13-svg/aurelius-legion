// aurelius/router/correctionsRouter.ts — the trust loop's front door.
// Cole flags something wrong (a signal, a knowledge entry, a compiled
// pattern, a wiki page); the correction records, applies where it can,
// and feeds recall. Mounted at /api/corrections. All routes static.

import { Router, type Request, type Response } from "express";
import { recordCorrection, listCorrections } from "../knowledge/corrections.ts";

export const correctionsRouter = Router();

correctionsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.json({ corrections: await listCorrections() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

correctionsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { targetType, targetId, correctionType, reason, after, operatorName } = req.body ?? {};
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: "targetType, targetId, and reason are required" });
    }
    const result = await recordCorrection({
      targetType,
      targetId,
      correctionType,
      reason: String(reason),
      after,
      operatorName,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
