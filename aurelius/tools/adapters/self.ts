// aurelius/tools/adapters/self.ts
//
// Aurelius's honest mirror. The DoD's literal acceptance test — "what are you
// working on right now and why?" — had no data path in chat (final council):
// missions, receipts, grants, and trace errors were all queryable by pages but
// none by the model. Two read-only actions close it. No writes, no gates.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";

export const selfAdapter: ToolAdapter = {
  name: "self",
  description:
    "Aurelius's own state: missions in flight, recent autonomous actions and their receipts, active grants, and recent failures. Use to answer honestly what it is doing and has done.",
  actions: [
    {
      name: "status",
      description:
        "What Aurelius is doing RIGHT NOW and may do on its own: running/planned missions, active autonomy grants, pending proposals awaiting Cole, and the last few failures. Use when Cole asks what you're working on, what's running, or why something didn't happen.",
      dataSchema: "{}",
      example: "[TOOL: tool=self action=status data={}]",
    },
    {
      name: "recent_actions",
      description:
        "The receipt trail: the most recent autonomous/executed actions (acted, confirmed, undone) with timestamps. Use when Cole asks what you did today/this week without him.",
      dataSchema: '{ "limit"?: number (default 10, max 25) }',
      example: '[TOOL: tool=self action=recent_actions data={"limit": 10}]',
    },
    {
      name: "diagnose",
      description:
        "THE DOCTOR — live-probes every engine, key, and integration from inside this container and reports what is actually working (a key that is set but rejected reports BROKEN, not configured). Every failure carries its fix. Use when Cole says something 'isn't working', asks why an engine/calendar/search is dead, or wants a health check after a deploy.",
      dataSchema: "{}",
      example: "[TOOL: tool=self action=diagnose data={}]",
    },
  ],
  async run(action, data): Promise<ToolAdapterResult> {
    const { prisma } = await import("../../core/db/prisma.ts");
    if (action === "status") {
      try {
        const [missions, grants, pending, failures] = await Promise.all([
          prisma.mission.findMany({
            where: { status: { in: ["proposed", "planned", "running"] } },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { title: true, status: true, domain: true, planSummary: true, createdAt: true },
          }),
          prisma.autonomyGrant.findMany({
            where: { status: "active" },
            select: { actionClass: true, grantedAt: true },
          }),
          prisma.bridgeSignal.count({ where: { status: { in: ["pending", "surfaced"] } } }),
          prisma.logEntry.findMany({
            where: { level: "error", createdAt: { gte: new Date(Date.now() - 48 * 3600_000) } },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { type: true, message: true, createdAt: true },
          }),
        ]);
        return {
          ok: true,
          output: {
            missionsInFlight: missions,
            activeGrants: grants.map((g) => g.actionClass),
            proposalsAwaitingCole: pending,
            recentFailures: failures,
            summary: `${missions.length} mission(s) in flight, ${grants.length} grant(s) active, ${pending} item(s) awaiting Cole, ${failures.length} failure(s) in 48h`,
          },
        };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "self status failed" };
      }
    }
    if (action === "recent_actions") {
      try {
        const limit = Math.min(Math.max(Number(data?.limit) || 10, 1), 25);
        const signals = await prisma.bridgeSignal.findMany({
          where: { status: { in: ["acted", "confirmed", "undone"] } },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: { title: true, kind: true, status: true, sourceType: true, createdAt: true },
        });
        return {
          ok: true,
          output: {
            actions: signals,
            summary: `${signals.length} most recent executed action(s) — status "acted" means done under a grant, "undone" means Cole reversed it`,
          },
        };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "recent actions failed" };
      }
    }
    if (action === "diagnose") {
      try {
        const { runDoctor, formatDoctor } = await import("../../core/doctor.ts");
        const result = await runDoctor();
        return {
          ok: true,
          output: {
            summary: result.summary,
            report: formatDoctor(result),
            broken: result.checks.filter((c) => c.status === "fail"),
            // Detail + fix, not bare names. Mapping to `.name` meant that when
            // Aurelius diagnosed itself it saw a list of words with no reasons
            // and concluded nothing was wrong.
            notConfigured: result.checks
              .filter((c) => c.status === "dormant")
              .map((c) => ({ name: c.name, detail: c.detail, fix: c.fix })),
          },
        };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "diagnose failed" };
      }
    }
    return { ok: false, output: null, error: `unknown self action: ${action}` };
  },
};
