/**
 * router/autonomyRouter.ts
 * Aurelius OS v3.4 — Autonomy tick route (Phase 3)
 */

import express, { Request, Response } from "express";
import { loadAutonomyState, saveAutonomyState } from "../autonomy/stateStore";
import { runAutonomyLoop } from "../autonomy/loop";

export const autonomyRouter = express.Router();

autonomyRouter.post("/tick", async (req: Request, res: Response) => {
  try {
    const state = loadAutonomyState();

    const ctx = {
      requestId: req.headers["x-request-id"]?.toString() || "autonomy-" + Date.now(),
      operatorId: "strategy",
      timestamp: new Date().toISOString()
    };

    const updated = await runAutonomyLoop(state, ctx);
    saveAutonomyState(updated);

    return res.json({
      status: "ok",
      state: {
        currentGoal: updated.currentGoal,
        goals: updated.goals,
        history: updated.history.slice(-20)
      }
    });
  } catch (err) {
    console.error("Autonomy tick error:", err);
    return res.status(500).json({ error: "Autonomy loop failed." });
  }
});
