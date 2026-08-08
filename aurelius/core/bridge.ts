// aurelius/core/bridge.ts
//
// Surfacing with SALIENCE. Most BridgeSignals are created with a bare
// prisma.bridgeSignal.create and just sit on the Bridge until Cole looks, or wait
// for the next ritual to mention them. surfaceSignal() adds the timing brain: it
// files the signal AND, when it's genuinely salient (urgent × high-leverage, and
// not in quiet hours), pushes it to Cole's phone in the moment. Low-salience
// signals stay quiet on the Bridge — no 3am buzz over an opportunity.
//
// Adopt this at PROACTIVE surfacing points (conflicts, risks, opportunities).
// It's additive — existing create sites keep working untouched.

import { prisma } from "./db/prisma.ts";
import { shouldPushNow } from "./salience.ts";

export type SurfaceSignalInput = {
  kind: string;
  operatorId?: string | null;
  domain?: string | null;
  sourceType: string;
  sourceId?: string | null;
  severity?: string;
  title: string;
  body: string;
  actions?: any;
  status?: string;
  dueAt?: Date | string | null; // when the underlying thing happens (feeds urgency)
  // Force the row to file WITHOUT a phone push even if it would be salient. Used
  // by callers that self-limit their own push volume (e.g. inbound-lead flood
  // capping, council R2) so a burst still lands on the Bridge — visible, badge-
  // counted — without muting the channel every outward confirm depends on.
  quiet?: boolean;
};

/**
 * THE STATUSES THAT MEAN "COLE STILL HAS TO DO SOMETHING".
 *
 * The badge, the Decisions page, the Home strip and the scoreboard all count
 * these. Exported so there is ONE definition — they had drifted into four
 * separate inline copies of `["pending","surfaced"]`.
 */
export const AWAITING_DECISION = ["pending", "surfaced"] as const;

/**
 * Does this signal actually need a decision, or is it a receipt?
 *
 * The 2026-08-06 council measured 460 "pending" signals against ONE real
 * decision. The cause was not volume — it was that `BridgeSignal.status`
 * defaults to "pending" in the schema and most writers never set it, so a
 * ritual digest, a wiki rewrite notice and a mission report all filed
 * themselves as things awaiting Cole's tap. 98% of the badge was receipts.
 *
 * A bell that means "a human decision is waiting" is worth opening. A bell
 * that means "something happened" is worth muting, and once muted the real
 * decisions are lost with it. So the distinction is drawn HERE, at the one
 * place signals are created, rather than asked of sixteen call sites:
 *
 *   DECISION — it carries an actionable button, or it is a risk/opportunity/
 *              gap/proposal that Cole is meant to rule on. Status "pending".
 *   RECEIPT  — it reports that work happened. Status "noted": visible in the
 *              feed and the digest, never counted as an outstanding decision.
 */
/**
 * How long a still-open signal absorbs repeats of itself.
 *
 * A day, because the events this protects against are standing conditions —
 * an expired token, a dropped mount, an empty pipeline — and Cole should hear
 * about each one once per day, not once per poll.
 */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function needsDecision(input: {
  kind: string;
  severity?: string;
  actions?: any;
}): boolean {
  const actionable =
    Array.isArray(input.actions) &&
    input.actions.some((a: any) => a?.action && a.action !== "dismiss" && a.action !== "acknowledge");
  if (actionable) return true;
  // A pure report is a receipt however loud it is — EXCEPT at critical, where
  // "the backup failed" genuinely is Cole's problem to act on.
  if (input.kind === "background_result") return input.severity === "critical";
  return ["risk", "opportunity", "gap_alert", "proposal_batch", "cole_steer"].includes(input.kind);
}

export async function surfaceSignal(input: SurfaceSignalInput): Promise<{ id: string; pushed: boolean }> {
  const { dueAt, quiet, ...data } = input;
  const severity = data.severity ?? "info";
  // An explicit status always wins; otherwise derive it, so a new writer that
  // forgets the field cannot silently inflate the badge (which is exactly how
  // 460 receipts came to look like 460 decisions).
  const status = data.status ?? (needsDecision({ kind: data.kind, severity, actions: data.actions }) ? "pending" : "noted");

  // ── DEDUP, AT THE ONE PLACE SIGNALS ARE CREATED ──
  //
  // The comment above this function promised signals were "surfaced once
  // (deduped by day)". Nothing did it. `syncCalendar` calls this on every
  // disconnected tick of a 15-minute poller, and a calendar disconnect scores
  // 1.0×0.35 + 0.7×0.65 = 0.805 — above the 0.72 push floor. So one expired
  // Google token produced ~96 badge rows and ~60 Telegram messages a day,
  // recurring on the ~weekly Testing-mode expiry.
  //
  // That is not merely noise: it MUTES THE CHANNEL every other fix depends on.
  // Outward publish and send confirms were just routed to Telegram so they
  // would finally ring — into a bot Cole would have muted by day eight.
  //
  // The correct guard already existed in core/backup.ts and was not copied.
  // Copying it to a second call site would have left the third and fourth, so
  // it lives HERE, where every writer gets it: same (sourceType, sourceId)
  // still open within the window collapses onto the existing row.
  //
  // Deliberately keyed on sourceId being present — a caller that doesn't
  // identify what a signal is ABOUT gets no dedup, because two anonymous
  // signals of the same type are not evidence of the same event.
  if (data.sourceId) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const existing = await prisma.bridgeSignal.findFirst({
      where: {
        // Match on KIND too (council M4): (sourceType, sourceId) can be shared by
        // a receipt and an ask, or a risk and an opportunity — collapsing across
        // kinds would let a quiet receipt absorb a real decision (or vice versa).
        // Same event = same kind.
        kind: data.kind,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        createdAt: { gte: since },
        // Only collapse onto a signal still awaiting Cole. One he already
        // handled should be allowed to recur — that's a new event, not an echo.
        status: { in: ["pending", "surfaced", "noted"] },
      },
      select: { id: true, actions: true, pushedAt: true, status: true },
    });
    if (existing) {
      // Refresh title/body/severity AND the ACTIONS payload (council M4). The old
      // code bumped only body+severity, so a collapsed ask kept the FIRST
      // surface's confirm payload: if the action was re-staged with a new payload
      // (a different amount, a fresh draft), confirming would finalize the STALE
      // one — a wrong-confirm hazard on the highest-consequence path there is.
      // Only overwrite actions when the new surface actually carries them, so an
      // actionless refresh (e.g. a plain freshness re-notice) can't wipe a live
      // confirm button off the open row.
      const nextActions = data.actions !== undefined ? data.actions : (existing.actions ?? undefined);
      // ESCALATE STATUS ON COLLAPSE (council R2). The dedup window includes
      // "noted" rows, and needsDecision keys on `actions` independently of kind —
      // so a quiet receipt filed first (no actions → noted) and a later same-key
      // surface carrying a confirm_action would collapse together, injecting a
      // real ask onto a row still marked "noted" — invisible to AWAITING_DECISION
      // (the badge, Decisions, the scoreboard). Escalate noted→pending when the
      // incoming signal is a decision; never downgrade a pending/surfaced ask.
      const nextStatus = existing.status === "noted" && (status === "pending" || status === "surfaced") ? status : existing.status;
      await prisma.bridgeSignal
        .update({ where: { id: existing.id }, data: { title: data.title, body: data.body, severity, actions: nextActions, status: nextStatus } })
        .catch(() => {});

      // Re-push ONCE if this collapse is genuinely salient and the open row was
      // never delivered (pushedAt null). A quietly-filed row that has since
      // become an outward-critical confirm must still reach the phone — otherwise
      // dedup silences exactly the ask that matters. Guarded on pushedAt so a
      // standing condition (an expired token re-noticed every poll) still can't
      // buzz more than once.
      let pushed = false;
      if (!quiet && !existing.pushedAt && shouldPushNow({ kind: data.kind, severity, domain: data.domain, dueAt })) {
        try {
          const hasAsk = Array.isArray(nextActions) && (nextActions as any[]).some((a) => a?.action === "confirm_action");
          const bot = await import("../telegram/bot.ts");
          pushed = hasAsk
            ? await bot.pushBridgeAsk({ id: existing.id, title: data.title, body: data.body, status: nextStatus, actions: nextActions })
            : await bot.sendToCole(`${data.title}\n\n${data.body}`.slice(0, 3500));
          if (pushed) await prisma.bridgeSignal.update({ where: { id: existing.id }, data: { pushedAt: new Date() } }).catch(() => {});
        } catch (err) {
          console.warn("[bridge] collapse re-push failed (row refreshed):", (err as any)?.message ?? err);
        }
      }
      return { id: existing.id, pushed };
    }
  }

  const signal = await prisma.bridgeSignal.create({
    data: {
      kind: data.kind,
      operatorId: data.operatorId ?? null,
      domain: data.domain ?? null,
      sourceType: data.sourceType,
      sourceId: data.sourceId ?? null,
      severity,
      title: data.title,
      body: data.body,
      actions: data.actions ?? undefined,
      status,
    },
  });

  let pushed = false;
  if (!quiet && shouldPushNow({ kind: signal.kind, severity: signal.severity, domain: signal.domain, dueAt })) {
    try {
      // A signal carrying a Confirm button is an ASK — push it with its buttons
      // (pushBridgeAsk) so Cole can act from his thumb; a plain notice pushes as
      // text. This is what lets the executor's gate path route through here
      // without losing the phone's Confirm/Dismiss (the dedup seam, 6.3).
      const hasAsk = Array.isArray(signal.actions) && (signal.actions as any[]).some((a) => a?.action === "confirm_action");
      const bot = await import("../telegram/bot.ts");
      pushed = hasAsk
        ? await bot.pushBridgeAsk({ id: signal.id, title: signal.title, body: signal.body, status: signal.status, actions: signal.actions })
        : await bot.sendToCole(`${signal.title}\n\n${signal.body}`.slice(0, 3500));
      // Persist delivery (6.5) — a critical ask that filed but never reached the
      // phone is now queryable (pushedAt null on a should-have-pushed signal),
      // not a lost console line.
      if (pushed) await prisma.bridgeSignal.update({ where: { id: signal.id }, data: { pushedAt: new Date() } }).catch(() => {});
    } catch (err) {
      console.warn("[bridge] salient push failed (signal still filed):", (err as any)?.message ?? err);
    }
  }
  return { id: signal.id, pushed };
}
