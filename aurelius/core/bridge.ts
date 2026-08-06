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
  const { dueAt, ...data } = input;
  const severity = data.severity ?? "info";
  // An explicit status always wins; otherwise derive it, so a new writer that
  // forgets the field cannot silently inflate the badge (which is exactly how
  // 460 receipts came to look like 460 decisions).
  const status = data.status ?? (needsDecision({ kind: data.kind, severity, actions: data.actions }) ? "pending" : "noted");
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
  if (shouldPushNow({ kind: signal.kind, severity: signal.severity, domain: signal.domain, dueAt })) {
    try {
      const { sendToCole } = await import("../telegram/bot.ts");
      pushed = await sendToCole(`${signal.title}\n\n${signal.body}`.slice(0, 3500));
    } catch (err) {
      console.warn("[bridge] salient push failed (signal still filed):", (err as any)?.message ?? err);
    }
  }
  return { id: signal.id, pushed };
}
