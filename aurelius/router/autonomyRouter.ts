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
