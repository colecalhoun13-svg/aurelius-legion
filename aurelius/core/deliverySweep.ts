// aurelius/core/deliverySweep.ts
//
// DELIVERY-VERIFIED NOTIFICATIONS (NORTH_STAR #65) — "done" must mean it
// actually reached Cole, not "the send didn't throw."
//
// surfaceSignal() stamps BridgeSignal.pushedAt only when sendToCole returns
// true. So a should-have-pushed row with pushedAt IS NULL is a delivery that
// FAILED — Telegram was down, the chat wasn't bound yet, the network blipped.
// Nothing retried it, so a critical ask could file, never reach the phone, and
// sit silently forever. That's the exact silent failure that kills trust in a
// second operator: he assumes "if it mattered, it would've buzzed."
//
// This sweep closes the loop. It re-evaluates the SAME push predicate
// (shouldPushNow) on undelivered rows and re-sends the ones that still qualify,
// stamping pushedAt on success. Self-healing: the moment Telegram comes back, a
// held critical ask lands on the next tick. Honest when dormant: sendToCole
// returns false with no token, so the sweep simply reports "still pending" and
// never spams errors or invents a delivery.

import { prisma } from "./db/prisma.ts";

// Don't chase ancient rows — a two-day-old undelivered notice is stale news,
// and re-pushing it would be noise, not rescue. The window is generous enough
// to cover an overnight Telegram outage.
const RETRY_WINDOW_MS = 2 * 86400_000;
const MAX_PER_SWEEP = 30;

export type DeliverySweepResult = {
  eligible: number; // undelivered rows that STILL qualify to push right now
  delivered: number; // re-sent successfully this pass
  stillPending: number; // qualified but the send didn't land (Telegram down/dormant)
  scanned: number;
};

export async function retryUndeliveredPushes(now = new Date()): Promise<DeliverySweepResult> {
  const result: DeliverySweepResult = { eligible: 0, delivered: 0, stillPending: 0, scanned: 0 };

  const candidates = await prisma.bridgeSignal.findMany({
    where: {
      pushedAt: null, // never delivered
      status: { in: ["pending", "surfaced"] }, // still awaiting a decision
      createdAt: { gte: new Date(now.getTime() - RETRY_WINDOW_MS) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], // not expired
    },
    orderBy: { createdAt: "asc" }, // oldest undelivered first — fairness
    take: MAX_PER_SWEEP,
    select: { id: true, kind: true, severity: true, domain: true, title: true, body: true },
  });
  result.scanned = candidates.length;
  if (candidates.length === 0) return result;

  const { shouldPushNow } = await import("./salience.ts");
  const bot = await import("../telegram/bot.ts");

  for (const s of candidates) {
    // Re-ask the same question surfaceSignal asked: does this deserve the phone
    // RIGHT NOW? (This also respects quiet hours — a non-critical held overnight
    // waits for morning rather than buzzing at 3am.) If it no longer qualifies,
    // leave it: it'll be seen in the app, it just won't chase him.
    if (!shouldPushNow({ kind: s.kind, severity: s.severity ?? undefined, domain: s.domain ?? undefined })) continue;
    result.eligible++;

    const pushed = await bot.sendToCole(`${s.title}\n\n${s.body}`.slice(0, 3500));
    if (pushed) {
      result.delivered++;
      // Same stamp surfaceSignal writes — now the phone actually has it, and the
      // row stops qualifying for retry.
      await prisma.bridgeSignal.update({ where: { id: s.id }, data: { pushedAt: new Date() } }).catch(() => {});
    } else {
      // sendToCole returned false: Telegram dormant / half-wired / a transient
      // failure. Leave pushedAt null so the NEXT sweep tries again. No error
      // spam — the honest state is "still pending", reported below.
      result.stillPending++;
    }
  }

  if (result.eligible > 0) {
    console.log(
      `[deliverySweep] scanned ${result.scanned} · re-delivered ${result.delivered} · still pending ${result.stillPending}`
    );
  }
  return result;
}
