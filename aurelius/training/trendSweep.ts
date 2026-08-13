// aurelius/training/trendSweep.ts
//
// THE MONDAY TREND SWEEP — Aurelius speaking unprompted about training, which
// is exactly the domain it's allowed to push signals in. Reads the SAME
// momentum flags and pace verdicts the Athletes page renders (crm/performance)
// so the signal and the screen can never disagree. One deduped signal per
// athlete per week, naming everything at once — never a per-series flood.
//
// Training domain, BOTH athlete kinds: a stalled gym athlete is a coaching
// fact. No business machinery is touched or implied.

import { prisma } from "../core/db/prisma.ts";
import { athletePerformance } from "../crm/performance.ts";

export async function trainingTrendSweep(now = new Date()): Promise<{ ran: boolean; reason: string; flagged: number }> {
  const { COACHED_KINDS } = await import("../athlete/self.ts");
  const athletes = await prisma.client.findMany({
    // Coached athletes only — never the self record (Athlete Zero is Cole).
    where: { status: "active", kind: { in: [...COACHED_KINDS] } },
    select: { id: true, name: true },
  });
  if (athletes.length === 0) {
    return { ran: false, reason: "no athletes on the roster — nothing to watch", flagged: 0 };
  }

  const { surfaceSignal } = await import("../core/bridge.ts");
  const week = `${now.getUTCFullYear()}-w${Math.ceil(((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400_000 + 1) / 7)}`;
  let flagged = 0;

  for (const a of athletes) {
    const perf = await athletePerformance(a.id).catch(() => null);
    if (!perf || perf.series.length === 0) continue;

    const lines: string[] = [];
    for (const s of perf.series) {
      const u = s.unit ?? "";
      if (s.regressing) lines.push(`• ${s.label}: sliding — last 3 entries each worse (now ${s.latest.value}${u}, best ${s.best.value}${u})`);
      else if (s.stalled) {
        const weeks = Math.round((s.latest.achievedAt.getTime() - s.best.achievedAt.getTime()) / (7 * 86400_000));
        lines.push(`• ${s.label}: stalled — best (${s.best.value}${u}) untouched ~${weeks}w while still training it`);
      }
    }
    for (const t of perf.targets) {
      if (t.pace === "behind" && t.latestValue != null) {
        lines.push(`• ${t.label} target ${t.targetValue}${t.unit ?? ""} (${t.targetDate ? `due ${t.targetDate.toISOString().slice(0, 10)}` : "open"}): behind pace — at ${t.latestValue}${t.unit ?? ""}, ${t.remaining}${t.unit ?? ""} to go`);
      } else if (t.pace === "past_due") {
        lines.push(`• ${t.label} target ${t.targetValue}${t.unit ?? ""}: date passed, not reached (${t.remaining}${t.unit ?? ""} short) — re-set or retire it`);
      }
    }
    if (lines.length === 0) continue;

    flagged++;
    await surfaceSignal({
      kind: "opportunity",
      domain: "training",
      sourceType: "trend_sweep",
      sourceId: `trend:${a.id}:${week}`,
      severity: "notice",
      title: `${a.name} — training watch (${lines.length})`,
      body: lines.join("\n") + `\n\nObservations only — the coaching call is yours. Full trends on the Athletes page.`,
    }).catch(() => {});
  }

  return { ran: true, reason: "swept", flagged };
}
