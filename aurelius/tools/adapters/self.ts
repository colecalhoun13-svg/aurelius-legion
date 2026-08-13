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
    {
      name: "spend",
      description:
        "WHAT AURELIUS COSTS TO RUN — month-to-date LLM spend, broken down by which job and which model spent it, against the monthly budget if one is set. Use when Cole asks what this is costing him, which job is expensive, or whether he's near budget. Figures are hand-maintained estimates, not a billing feed — say so.",
      dataSchema: '{ "days"?: number (default: month-to-date) }',
      example: '[TOOL: tool=self action=spend data={}]',
    },
    {
      name: "faith",
      description:
        "Today's faith rhythm — a short grounding reflection drawn ONLY from faith material Cole has ingested into his library (a devotional, a reading plan, scripture). Never invents or quotes scripture that isn't in the library; dormant-honest until he's added some. Use for 'faith rhythm', 'a word for today', 'devotional'.",
      dataSchema: "{}",
      example: "[TOOL: tool=self action=faith data={}]",
    },
  ],
  async run(action, data): Promise<ToolAdapterResult> {
    const { prisma } = await import("../../core/db/prisma.ts");
    if (action === "faith") {
      const { faithRhythm } = await import("../../faith/rhythm.ts");
      const fr = await faithRhythm();
      if (!fr.ok) return { ok: false, output: null, error: fr.reason };
      return { ok: true, output: { rhythm: fr.rhythm, drawnFrom: fr.drawnFrom } };
    }
    if (action === "spend") {
      try {
        const { spendSummary, monthToDate } = await import("../../measurement/spend.ts");
        const { monthlyBudgetUsd, formatUsd } = await import("../../llm/pricing.ts");
        const days = Number(data?.days);
        const summary = Number.isFinite(days) && days > 0 ? await spendSummary(days) : await monthToDate();
        const budget = monthlyBudgetUsd();
        // Efficiency made visible: the embed-once cache collapses the same
        // message being embedded by five prompt layers into one provider call.
        // Process-local (resets on redeploy), so it's "since last boot", not
        // the billing window — labeled as such.
        const { embedCacheStats } = await import("../../retrieval/embeddingAdapter.ts");
        const ec = embedCacheStats();
        return {
          ok: true,
          output: {
            window: Number.isFinite(days) && days > 0 ? `last ${days} days` : "month to date",
            cost: summary.cost,
            calls: summary.calls,
            tokensIn: summary.tokensIn,
            tokensOut: summary.tokensOut,
            tokensCachedIn: summary.tokensCachedIn,
            budget: budget ? formatUsd(budget) : null,
            pctOfBudget: budget ? Math.round((summary.costUsd / budget) * 100) : null,
            topJobs: summary.byTaskType.slice(0, 8).map((b) => ({ job: b.key, cost: formatUsd(b.costUsd), calls: b.calls })),
            topModels: summary.byModel.slice(0, 8).map((b) => ({ model: b.key, cost: formatUsd(b.costUsd), calls: b.calls })),
            unpricedCalls: summary.unpricedCalls,
            embedCache:
              ec.hits + ec.misses > 0
                ? {
                    since: "boot",
                    embedsAvoided: ec.hits,
                    provider_calls: ec.misses,
                    hitRate: `${Math.round((ec.hits / (ec.hits + ec.misses)) * 100)}%`,
                  }
                : null,
            caveat:
              `Estimated from hand-maintained prices as of ${summary.pricesAsOf} — not a billing feed. Check the provider console for the real bill.` +
              (summary.unpricedCalls > 0
                ? ` ${summary.unpricedCalls} call(s) ran on models not in the price table and contributed no dollars, so the true total is higher.`
                : ""),
          },
        };
      } catch (err: any) {
        return { ok: false, output: null, error: err?.message ?? String(err) };
      }
    }
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
