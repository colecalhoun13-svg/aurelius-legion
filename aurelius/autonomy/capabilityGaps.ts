// aurelius/autonomy/capabilityGaps.ts
//
// CAPABILITY GAP DETECTION — Aurelius notices what it keeps failing at.
//
// Every tool call already lands in memory (toolEngine.persistToolMemory,
// category "tool_result", metadata { tool, action, status, error }). This
// sweep mines the recent failures, and when the same capability has failed
// repeatedly it files ONE deduped Bridge signal: "I keep failing you here —
// here's the fix" (a missing config key, a dead integration, or a tool that
// doesn't exist at all and might be worth building).
//
// Deterministic — no LLM in the loop. Finding gaps is automatic; ACQUIRING a
// capability is never: the signal proposes, Cole decides (hard rule 1 —
// autonomy never escalates its own autonomy). A dismissed gap stays quiet
// for a cooldown instead of nagging.

import { prisma } from "../core/db/prisma.ts";

const WINDOW_DAYS = 14;      // how far back failures count
const THRESHOLD = 3;         // same capability failing this often = a gap
const COOLDOWN_DAYS = 30;    // respect a dismissal — don't re-file for a month

type GapKind = "missing_tool" | "needs_config" | "failing";

function classify(error: string): GapKind {
  if (/tool not found/i.test(error)) return "missing_tool";
  if (/not configured|missing .*_?api[_ ]?key|api key|authorize|auth at \/api|credential|token/i.test(error)) {
    return "needs_config";
  }
  return "failing";
}

function gapAdvice(kind: GapKind, capability: string, lastError: string): string {
  switch (kind) {
    case "missing_tool":
      return `This capability doesn't exist yet — I reached for it and it isn't built. If you want it, say the word and it becomes a build proposal.`;
    case "needs_config":
      return `The capability is built but blocked on setup. The error names the fix:\n> ${lastError.slice(0, 300)}\nThe Tools page shows the same unlock for ${capability}.`;
    default:
      return `It's configured but keeps breaking:\n> ${lastError.slice(0, 300)}\nWorth a look before it costs you a real moment.`;
  }
}

export async function sweepCapabilityGaps(): Promise<{ scanned: number; gaps: number; filed: number }> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600_000);
  const failures = await prisma.memory.findMany({
    where: {
      category: "tool_result",
      createdAt: { gte: since },
      metadata: { path: ["status"], equals: "failed" },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { metadata: true, createdAt: true },
  });

  // Group by capability. "Tool not found" failures group by the phantom tool
  // name inside the error; real tools group by tool.action.
  const groups = new Map<string, { count: number; lastError: string; kind: GapKind }>();
  for (const f of failures) {
    const md = (f.metadata ?? {}) as any;
    const error = String(md.error ?? "");
    if (!error) continue;
    const kind = classify(error);
    const phantom = error.match(/Tool not found: "([^"]+)"/)?.[1];
    const capability = kind === "missing_tool" && phantom ? phantom : `${md.tool ?? "unknown"}.${md.action ?? "?"}`;
    const g = groups.get(capability);
    if (g) {
      g.count++;
    } else {
      // failures are newest-first, so the first error seen is the latest one
      groups.set(capability, { count: 1, lastError: error, kind });
    }
  }

  let filed = 0;
  let gaps = 0;
  for (const [capability, g] of groups) {
    if (g.count < THRESHOLD) continue;
    gaps++;

    // Dedup + dismissal respect: one signal per capability per cooldown,
    // and never a second while one is still awaiting Cole.
    const sourceId = `gap:${capability}`;
    const existing = await prisma.bridgeSignal.findFirst({
      where: {
        sourceType: "capability_gap",
        sourceId,
        OR: [
          { status: { in: ["pending", "surfaced", "acknowledged"] } },
          { createdAt: { gte: new Date(Date.now() - COOLDOWN_DAYS * 24 * 3600_000) } },
        ],
      },
    });
    if (existing) continue;

    await prisma.bridgeSignal.create({
      data: {
        kind: "gap_alert",
        sourceType: "capability_gap",
        sourceId,
        severity: "notice",
        title: `Capability gap: ${capability} failed ${g.count}× in ${WINDOW_DAYS} days`,
        body:
          `I keep failing you on **${capability}** — ${g.count} failures in the last ${WINDOW_DAYS} days.\n\n` +
          gapAdvice(g.kind, capability, g.lastError) +
          `\n\nFinding the gap is my job; closing it is your call. Dismiss to silence this for ${COOLDOWN_DAYS} days.`,
      },
    });
    filed++;
  }

  if (filed > 0) console.log(`[gaps] filed ${filed} capability gap signal(s) (${gaps} gaps over threshold)`);
  return { scanned: failures.length, gaps, filed };
}
