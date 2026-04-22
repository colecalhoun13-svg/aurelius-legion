/**
 * Aurelius OS v3.4 — Engine Router Test Endpoint
 */

import { Router, type Request, type Response } from "express";
import { routeTask } from "../core/engineRouter";
import type {
  EngineContext,
  Logger,
  MemoryAdapter,
  ToolRegistry,
  Config,
  RoutedTask,
} from "../core/engineTypes";

const router = Router();

// Simple logger
const logger: Logger = {
  info: (m, c) => console.log("[INFO]", m, c || {}),
  warn: (m, c) => console.warn("[WARN]", m, c || {}),
  error: (m, c) => console.error("[ERROR]", m, c || {}),
};

// Stub memory
const memory: MemoryAdapter = {
  read: async (q) => ({ q, result: "stub-read" }),
  write: async (e) => ({ e, result: "stub-write" }),
  search: async (q) => ({ q, result: "stub-search" }),
};

// Stub tools
const tools: ToolRegistry = {
  runTool: async (name, args) => ({ name, args, result: "stub-tool" }),
};

const config: Config = {
  environment: (process.env.NODE_ENV as any) || "dev",
};

router.post("/engine/test", async (req: Request, res: Response) => {
  try {
    const { type, payload, source, priority } = req.body;

    if (!type) return res.status(400).json({ error: "Missing 'type'" });

    const task: RoutedTask = {
      id: `test-${Date.now()}`,
      type,
      payload: payload ?? {},
      source: source ?? "operator",
      priority: priority ?? "normal",
    };

    const ctx: EngineContext = {
      requestId: `req-${Date.now()}`,
      operatorId: "operator-cole",
      timestamp: new Date().toISOString(),
      logger,
      memory,
      tools,
      config,
    };

    const result = await routeTask(task, ctx);

    return res.json({ task, result });
  } catch (err: any) {
    console.error("engineTest error:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

export default router;
