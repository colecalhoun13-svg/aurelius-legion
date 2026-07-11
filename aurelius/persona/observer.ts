// aurelius/persona/observer.ts
//
// AMBIENT PERSONA OBSERVATION — the one-voice calibration layer learns
// from watching, not just from being told. Weekly (Sun 17:00), Aurelius
// reads HOW Cole actually communicated — message length, cadence, hours,
// correction rate — and files persona.* PROPOSALS for anything the
// signals support. Propose, never impose: nothing calibrates the voice
// until Cole confirms it on the bench, and confirmed entries flow into
// Layer 1.5 through the machinery that already exists.
//
// Deterministic by design: signals are counted, not vibed. No LLM in
// this path, so it learns from day one, keyless.

import { prisma } from "../core/db/prisma.ts";
import { createProposal } from "../knowledge/proposals.ts";

const WINDOW_DAYS = 7;
const MIN_TURNS = 10;          // below this the signals are noise — stay silent
const MAX_PROPOSALS_PER_RUN = 2;

type Observation = { key: string; value: string; rationale: string };

export async function observeCommunicationStyle() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000);
  const turns = await prisma.conversationTurn.findMany({
    where: { role: "cole", createdAt: { gte: since } },
    select: { content: true, createdAt: true },
  });
  if (turns.length < MIN_TURNS) {
    return { skipped: true as const, reason: `only ${turns.length} turns in ${WINDOW_DAYS}d (need ${MIN_TURNS})` };
  }

  const observations: Observation[] = [];

  // Signal 1 — message length → reply calibration
  const avgLen = Math.round(turns.reduce((n, t) => n + t.content.length, 0) / turns.length);
  if (avgLen < 80) {
    observations.push({
      key: "reply_length",
      value: `Cole writes in short bursts (avg ${avgLen} chars this week). Keep replies tight and skimmable — lead with the answer, no preamble.`,
      rationale: `${turns.length} messages averaged ${avgLen} chars over ${WINDOW_DAYS} days.`,
    });
  } else if (avgLen > 300) {
    observations.push({
      key: "reply_length",
      value: `Cole writes in detail (avg ${avgLen} chars this week). Match his depth — full reasoning is welcome, don't over-compress.`,
      rationale: `${turns.length} messages averaged ${avgLen} chars over ${WINDOW_DAYS} days.`,
    });
  }

  // Signal 2 — active hours → when pushes land vs when to stay async
  const hourCounts = new Array(24).fill(0);
  for (const t of turns) hourCounts[t.createdAt.getHours()]++;
  const peak = hourCounts.indexOf(Math.max(...hourCounts));
  const peakShare = hourCounts[peak] / turns.length;
  if (peakShare >= 0.3) {
    const block = `${String(peak).padStart(2, "0")}:00–${String((peak + 3) % 24).padStart(2, "0")}:00`;
    observations.push({
      key: "active_hours",
      value: `Cole is most active around ${block} (${Math.round(peakShare * 100)}% of this week's messages). Time-sensitive pushes land best there; elsewhere, queue quietly.`,
      rationale: `${hourCounts[peak]} of ${turns.length} messages in the ${block} window.`,
    });
  }

  // Signal 3 — correction rate → assumption-checking posture
  const corrections = await prisma.correction.count({ where: { createdAt: { gte: since } } });
  if (corrections >= 3) {
    observations.push({
      key: "assumption_checking",
      value: `Cole corrected ${corrections} things this week. Before long outputs, state key assumptions in one line so he can redirect early.`,
      rationale: `${corrections} corrections in ${WINDOW_DAYS} days — the trust loop is active; meet it halfway.`,
    });
  }

  // File as proposals — capped, deduped against the bench and current state.
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  const globalId = await resolveOperatorId("global");
  if (!globalId) return { skipped: true as const, reason: "global operator missing" };

  let proposed = 0;
  for (const obs of observations) {
    if (proposed >= MAX_PROPOSALS_PER_RUN) break;
    const [pending, current] = await Promise.all([
      prisma.knowledgeProposal.findFirst({
        where: { operatorId: globalId, scope: "persona", key: obs.key, status: "pending" },
      }),
      prisma.knowledgeEntry.findFirst({
        where: { operatorId: globalId, scope: "persona", key: obs.key, active: true },
      }),
    ]);
    if (pending) continue;                                  // already on the bench
    if (current && current.value === obs.value) continue;   // already how it speaks

    await createProposal({
      operatorId: globalId,
      operatorName: "global",
      intentClassId: "persona_calibration",
      scope: "persona",
      key: obs.key,
      proposedValue: obs.value,
      rationale: `Observed, not assumed: ${obs.rationale}`,
      coleNaturalLanguage: "(weekly persona observation — no conversation trigger)",
    });
    proposed++;
  }

  if (proposed > 0) console.log(`[persona] ${proposed} calibration proposal(s) on the bench`);
  return { skipped: false as const, turns: turns.length, observations: observations.length, proposed };
}
