// aurelius/router/productivityRouter.ts
//
// Express surface for the productivity plane. Thin: every route delegates
// to aurelius/productivity/service.ts. Mounted at /api/productivity.

import { Router, type Request, type Response } from "express";
import {
  createTask,
  updateTask,
  completeTask,
  listTasks,
  quickCapture,
  createHabit,
  completeHabit,
  listHabits,
  upsertTodayPlan,
  getToday,
  ackBridgeSignal,
} from "../productivity/service.ts";

export const productivityRouter = Router();

// ── Today ────────────────────────────────────────────────────────────

productivityRouter.get("/today", async (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json(await getToday(date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/plan", async (req: Request, res: Response) => {
  try {
    res.json(await upsertTodayPlan(req.body ?? {}));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Tasks ────────────────────────────────────────────────────────────

productivityRouter.get("/tasks", async (req: Request, res: Response) => {
  try {
    res.json(
      await listTasks({
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        domain: typeof req.query.domain === "string" ? req.query.domain : undefined,
      })
    );
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/tasks", async (req: Request, res: Response) => {
  try {
    if (!req.body?.title || typeof req.body.title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }
    res.json(await createTask(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    res.json(await updateTask(String(req.params.id), req.body ?? {}));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/tasks/:id/complete", async (req: Request, res: Response) => {
  try {
    res.json(await completeTask(String(req.params.id)));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Capture ──────────────────────────────────────────────────────────

productivityRouter.post("/capture", async (req: Request, res: Response) => {
  try {
    if (!req.body?.content || typeof req.body.content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }
    res.json(await quickCapture(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Habits ───────────────────────────────────────────────────────────

productivityRouter.get("/habits", async (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json(await listHabits(date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/habits", async (req: Request, res: Response) => {
  try {
    if (!req.body?.name || typeof req.body.name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    res.json(await createHabit(req.body));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

productivityRouter.post("/habits/:id/complete", async (req: Request, res: Response) => {
  try {
    res.json(await completeHabit(String(req.params.id), req.body?.date));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── Bridge ───────────────────────────────────────────────────────────

productivityRouter.post("/bridge/:id/ack", async (req: Request, res: Response) => {
  try {
    const status = req.body?.status ?? "acknowledged";
    if (!["acknowledged", "acted", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "invalid status" });
    }
    res.json(await ackBridgeSignal(String(req.params.id), status));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
