// aurelius/router/healthRouter.ts
//
// THE DOCTOR, REACHABLE. core/doctor.ts already diagnosed the whole
// "Google stopped working / Anthropic isn't coming up" class of problem —
// but only from a shell inside the container, which is the one place Cole
// isn't. These two routes put it behind the API lock, where the app, the
// phone, and a curl can all reach it.
//
//   GET /api/health/doctor       — live probe of every engine + integration
//   GET /api/health/integrations — the Tools page's status, computed HERE
//                                  (backend env), not in the frontend
//                                  container that never sees TELEGRAM_* etc.
//
// Both mount under /api, so the global x-aurelius-key lock covers them.

import { Router, type Request, type Response } from "express";

const router = Router();

router.get("/health/doctor", async (_req: Request, res: Response) => {
  try {
    const { runDoctor, formatDoctor } = await import("../core/doctor.ts");
    const result = await runDoctor();
    res.json({
      summary: result.summary,
      report: formatDoctor(result),
      checks: result.checks,
      broken: result.checks.filter((c) => c.status === "fail").length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "doctor failed to run" });
  }
});

router.get("/health/integrations", async (_req: Request, res: Response) => {
  try {
    const { registerAllTools } = await import("../tools/registerTools.ts");
    const { getIntegrations } = await import("../tools/integrationStatus.ts");
    registerAllTools(); // idempotent — the registry de-dupes
    res.json({ integrations: await getIntegrations() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "integration status failed" });
  }
});

export default router;
