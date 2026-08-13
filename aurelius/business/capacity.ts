// aurelius/business/capacity.ts
//
// CAPACITY / ROSTER HEALTH (NORTH_STAR #10) — the honest answer to "how full am
// I, and how many more can I take?" Remote coaching is Cole's SECOND job on top
// of the gym, so the binding constraint isn't demand, it's his hours — an offer
// that outruns them is a promise he can't keep.
//
// The capacity ceiling is Cole's own number (the `remote_capacity` fact). Until
// he's set it, this refuses to invent one — it reports the roster it CAN count
// (paying clients + gym athletes) and says plainly that headroom is unknown
// until he answers. Business machinery counts only `kind:"client"`; gym athletes
// are reported separately as a coaching load, never as business capacity.

import { prisma } from "../core/db/prisma.ts";

export type CapacityHealth = {
  activeClients: number; // paying remote clients (the business ceiling applies to these)
  trainingOnly: number; // gym athletes — a coaching load, not a business slot
  capacityAnswer: string | null; // Cole's stated capacity, verbatim, if answered
  capacityCeiling: number | null; // a parsed number if his answer contains one
  headroom: number | null; // ceiling − activeClients, when the ceiling is known
  utilizationPct: number | null;
  headline: string;
};

/** Pull the first plain integer out of Cole's free-text capacity answer
 *  ("about 10 athletes, 12 hrs/wk" → 10). Null when there's no number to trust. */
function parseCeiling(answer: string | null): number | null {
  if (!answer) return null;
  const m = answer.match(/\b(\d{1,3})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function capacityHealth(): Promise<CapacityHealth> {
  const [activeClients, trainingOnly, facts] = await Promise.all([
    prisma.client.count({ where: { kind: "client", status: "active" } }),
    prisma.client.count({ where: { kind: "training_only", status: "active" } }),
    import("./positioning.ts").then((m) => m.knownFacts()).catch(() => [] as Array<{ key: string; value: string }>),
  ]);

  const capacityAnswer = facts.find((f) => f.key === "remote_capacity")?.value?.trim() || null;
  const capacityCeiling = parseCeiling(capacityAnswer);
  const headroom = capacityCeiling != null ? capacityCeiling - activeClients : null;
  const utilizationPct = capacityCeiling != null && capacityCeiling > 0 ? Math.round((activeClients / capacityCeiling) * 100) : null;

  let headline: string;
  if (capacityCeiling == null) {
    headline =
      `${activeClients} paying client${activeClients === 1 ? "" : "s"}${trainingOnly ? ` (plus ${trainingOnly} gym athlete${trainingOnly === 1 ? "" : "s"} you coach)` : ""}. ` +
      `Remote capacity isn't set — tell me how many remote athletes you can actually handle on top of the gym job and I'll track your headroom so an offer never outruns your hours.`;
  } else if (headroom! <= 0) {
    headline =
      `You're at ${activeClients}/${capacityCeiling} — full (or over). Any new client means dropping one, raising the price, or expanding the hours; don't sell a slot you can't staff.`;
  } else {
    headline =
      `${activeClients}/${capacityCeiling} slots filled — ${headroom} open (${utilizationPct}% full). Room to grow without overpromising.`;
  }

  return { activeClients, trainingOnly, capacityAnswer, capacityCeiling, headroom, utilizationPct, headline };
}
