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
    {
      name: "board",
      description:
        "Convene the BOARD OF DIRECTORS on a real decision — multiple independent operator lenses deliberate it and synthesize into one call. Aim it at anything genuinely weighty (a pricing move, a big commitment, a fork). Use this yourself when Cole is clearly weighing a real decision, not just chatting — that's the point of the board. Returns the deliberation; Cole still decides.",
      dataSchema: "{ decision: string }",
      example: '[TOOL: tool=self action=board data={"decision":"should I drop the gym to part-time and go all-in on remote?"}]',
    },
    {
      name: "voice",
      description:
        "Turn Cole's APPROVED words into an audio clip in his voice (ElevenLabs cloned voice if configured, else OpenAI TTS; dormant with neither). Voices ONLY the text it's given — approved content, a briefing, words Cole hands over — never an autonomous answer. Produces a file for Cole to use/share; it does not post anything. Use for 'voice this', 'read this in my voice', 'make an audio of this'.",
      dataSchema: "{ text: string, filename?: string }",
      example: '[TOOL: tool=self action=voice data={"text":"<approved words>"}]',
    },
    {
      name: "zero",
      description:
        "ATHLETE ZERO — Cole's OWN training picture: his performance series, development curves, and latest WHOOP readiness (recovery/HRV). His data, kept separate from the athletes he coaches. Use for 'how am I trending', 'my recovery', 'my numbers', 'athlete zero'.",
      dataSchema: "{}",
      example: "[TOOL: tool=self action=zero data={}]",
    },
    {
      name: "log",
      description:
        "Log one of COLE'S OWN numbers (a lift, a test, bodyweight) onto Athlete Zero — this is how his training gets IN, resolving to his self record automatically. Use for 'log my vertical 30in', 'my squat is 405', 'log my bodyweight 185'.",
      dataSchema: '{ label: string, value: number, unit?: string }',
      example: '[TOOL: tool=self action=log data={"label":"vertical","value":30,"unit":"in"}]',
    },
    {
      name: "set_target",
      description:
        "Set one of COLE'S OWN targets on Athlete Zero (his goal for a lift/test, with an optional date). Use for 'my goal is a 32in vertical by December', 'target 315 bench'.",
      dataSchema: '{ label: string, targetValue: number, unit?: string, targetDate?: string }',
      example: '[TOOL: tool=self action=set_target data={"label":"vertical","targetValue":32,"unit":"in","targetDate":"2026-12-01"}]',
    },
    {
      name: "link_sheet",
      description:
        "Link Cole's OWN workout Google Sheet to Athlete Zero (the program-delivery layer his athletes use, pointed at himself). Must be a Google Sheets URL, or empty to clear. Use for 'link my training sheet', 'here's my workout log <url>'.",
      dataSchema: "{ url: string }",
      example: '[TOOL: tool=self action=link_sheet data={"url":"https://docs.google.com/spreadsheets/d/…"}]',
    },
    {
      name: "start_experiment",
      description:
        "Start an n=1 self-experiment: a hypothesis + the metric to watch (captures Cole's current value as the baseline). Use for 'test creatine on my vertical for 6 weeks', 'experiment: 8h sleep → recovery'.",
      dataSchema: '{ hypothesis: string, metricLabel: string, protocol?: string, endAt?: string }',
      example: '[TOOL: tool=self action=start_experiment data={"hypothesis":"creatine raises my vertical","metricLabel":"vertical","endAt":"2026-10-01"}]',
    },
    {
      name: "conclude_experiment",
      description:
        "Conclude a running self-experiment — reads the metric now, computes the change, and gives an HONEST n=1 verdict (a signal, not proof). Use for 'wrap up my creatine experiment'.",
      dataSchema: "{ id: string }",
      example: '[TOOL: tool=self action=conclude_experiment data={"id":"abc"}]',
    },
    {
      name: "experiments",
      description: "List Cole's self-experiments (running + concluded), with baselines, results, and verdicts. Use for 'my experiments', 'what am I testing'.",
      dataSchema: '{ status?: "running"|"concluded"|"abandoned" }',
      example: "[TOOL: tool=self action=experiments data={}]",
    },
    {
      name: "abandon_experiment",
      description:
        "Abandon a running self-experiment without concluding it (Cole changed the plan or the protocol slipped). Marks it abandoned — no verdict, no fabricated result. Use for 'drop my creatine experiment', 'scrap that test'.",
      dataSchema: "{ id: string }",
      example: '[TOOL: tool=self action=abandon_experiment data={"id":"abc"}]',
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
    if (action === "board") {
      const decision = String(data?.decision ?? "").trim();
      if (!decision) return { ok: false, output: null, error: "The board needs a decision to deliberate — what's Cole weighing?" };
      const { deliberate, formatDeliberation } = await import("../../council/deliberate.ts");
      const result = await deliberate(decision);
      // Trust the council's own honesty gate: it filters engine-error seats and
      // returns ok:false when it couldn't actually convene, so a keyless run
      // yields an honest refusal here rather than error text dressed as a verdict.
      if (!result.ok) {
        return { ok: false, output: null, error: result.error ?? "The board couldn't convene (no engine?). Nothing fabricated." };
      }
      return { ok: true, output: { deliberation: formatDeliberation(result), note: "The board informs; the call stays yours." } };
    }
    if (action === "voice") {
      const { synthesizeSpeech } = await import("../../voice/tts.ts");
      const out = await synthesizeSpeech(String(data?.text ?? ""), { filename: data?.filename ? String(data.filename) : undefined });
      if (!out.ok) return { ok: false, output: null, error: out.error };
      return { ok: true, output: { url: out.url, provider: out.provider, cloned: out.cloned, bytes: out.bytes, note: "Audio of your approved words — open the url to play or share it. I don't post it anywhere." } };
    }
    if (action === "log") {
      const { logSelfMetric } = await import("../../athlete/self.ts");
      const res = await logSelfMetric({ label: String(data?.label ?? ""), value: Number(data?.value), unit: data?.unit ? String(data.unit) : undefined });
      if (!res.ok) return { ok: false, output: null, error: res.error };
      return { ok: true, output: { logged: true, isPR: res.isPR, message: res.isPR ? "Logged — that's a PR." : "Logged to Athlete Zero." } };
    }
    if (action === "set_target") {
      const { setSelfTarget } = await import("../../athlete/self.ts");
      const res = await setSelfTarget({ label: String(data?.label ?? ""), targetValue: Number(data?.targetValue), unit: data?.unit ? String(data.unit) : undefined, targetDate: data?.targetDate ? String(data.targetDate) : undefined });
      if (!res.ok) return { ok: false, output: null, error: res.error };
      return { ok: true, output: { message: "Target set on Athlete Zero." } };
    }
    if (action === "link_sheet") {
      const { linkSelfSheet } = await import("../../athlete/self.ts");
      const url = String(data?.url ?? "");
      const res = await linkSelfSheet(url);
      if (!res.ok) return { ok: false, output: null, error: res.error };
      return { ok: true, output: { message: url.trim() ? "Your workout sheet is linked to Athlete Zero." : "Cleared the workout-sheet link." } };
    }
    if (action === "start_experiment") {
      const { startExperiment } = await import("../../athlete/experiments.ts");
      const res = await startExperiment({
        hypothesis: String(data?.hypothesis ?? ""),
        metricLabel: String(data?.metricLabel ?? ""),
        protocol: data?.protocol ? String(data.protocol) : undefined,
        endAt: data?.endAt ? String(data.endAt) : undefined,
      });
      if (!res.ok) return { ok: false, output: null, error: res.error };
      return {
        ok: true,
        output: {
          id: res.id,
          baseline: res.baseline,
          message:
            res.baseline != null
              ? `Experiment running. Baseline captured at ${res.baseline}. Log the metric through the window, then conclude it.`
              : `Experiment running — but no baseline exists for that metric yet. Log it now so the start point is real, or the verdict can only show where you land, not the change.`,
        },
      };
    }
    if (action === "conclude_experiment") {
      const { concludeExperiment } = await import("../../athlete/experiments.ts");
      const res = await concludeExperiment(String(data?.id ?? ""));
      if (!res.ok) return { ok: false, output: null, error: res.error };
      return { ok: true, output: { verdict: res.verdict, delta: res.delta } };
    }
    if (action === "abandon_experiment") {
      const { abandonExperiment } = await import("../../athlete/experiments.ts");
      const res = await abandonExperiment(String(data?.id ?? ""));
      if (!res.ok) return { ok: false, output: null, error: res.error };
      return { ok: true, output: { message: "Experiment abandoned — no verdict filed." } };
    }
    if (action === "experiments") {
      const { listExperiments } = await import("../../athlete/experiments.ts");
      const status = data?.status ? String(data.status) : undefined;
      const rows = await listExperiments(status);
      return {
        ok: true,
        output: {
          count: rows.length,
          experiments: rows.map((e: any) => ({
            id: e.id,
            hypothesis: e.hypothesis,
            metric: e.metricLabel,
            status: e.status,
            baseline: e.baselineValue,
            result: e.resultValue,
            verdict: e.verdict,
            startedAt: e.startAt,
          })),
        },
      };
    }
    if (action === "zero") {
      const { athleteZeroSummary } = await import("../../athlete/self.ts");
      const { whoopStatus } = await import("../../health/whoop.ts");
      const z = await athleteZeroSummary();
      return {
        ok: true,
        output: {
          athlete: z.self.name,
          readiness: z.readiness,
          whoop: whoopStatus(),
          sheetUrl: z.sheetUrl,
          measures: z.performance?.series?.length ?? 0,
          series: z.performance?.series ?? [],
          curves: z.curves?.curves ?? [],
          experiments: (z.experiments ?? []).map((e: any) => ({
            id: e.id, hypothesis: e.hypothesis, metric: e.metricLabel, status: e.status,
            baseline: e.baselineValue, result: e.resultValue, verdict: e.verdict,
          })),
        },
      };
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
