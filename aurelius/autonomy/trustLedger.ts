// aurelius/autonomy/trustLedger.ts
//
// THE TRUST LEDGER (master-class #4). The acting layer's whole premise is "earn
// trust → grant more," but there was no instrument: no "acted 24 times, 0 undos"
// surface, so Cole had no evidence base to widen a keyhole. This aggregates that
// track record from the action traces runTraced already writes:
//   runTraced("action", "<class>")          → act-now (granted)   → message action:<class>
//   runTraced("action", "confirm:<class>")  → Cole confirmed      → message action:confirm:<class>
//   runTraced("action", "undo:<class>")     → Cole undid          → message action:undo:<class>
// context.status is "ok" | "error".

import { prisma } from "../core/db/prisma.ts";
import { listGrantableClasses } from "./actionClasses.ts";
import { isActionGranted } from "./grants.ts";

export type LedgerRow = {
  actionClass: string;
  acted: number;      // finalized on its own (granted)
  confirmed: number;  // finalized after Cole's Bridge tap
  undone: number;     // Cole reversed it
  failed: number;     // finalizer/inverse errored
  lastActedAt: Date | null;
};

export async function getTrustLedger(): Promise<LedgerRow[]> {
  const traces = await prisma.logEntry.findMany({
    where: { type: "trace", message: { startsWith: "action:" } },
    orderBy: { createdAt: "desc" },
    take: 3000,
  });

  const map = new Map<string, LedgerRow>();
  for (const t of traces) {
    let name = t.message.slice("action:".length);
    let kind: "act" | "confirm" | "undo" = "act";
    if (name.startsWith("undo:")) { kind = "undo"; name = name.slice(5); }
    else if (name.startsWith("confirm:")) { kind = "confirm"; name = name.slice(8); }
    const cls = name;
    if (!cls) continue;

    const status = (t.context as any)?.status;
    const row = map.get(cls) ?? { actionClass: cls, acted: 0, confirmed: 0, undone: 0, failed: 0, lastActedAt: null };
    if (status === "error") row.failed++;
    else if (kind === "undo") row.undone++;
    else {
      if (kind === "confirm") row.confirmed++;
      else row.acted++;
      if (!row.lastActedAt) row.lastActedAt = t.createdAt; // desc order → most recent
    }
    map.set(cls, row);
  }
  return [...map.values()].sort((a, b) => b.acted + b.confirmed - (a.acted + a.confirmed));
}

export type GrantSuggestion = { actionClass: string; reason: string };

/**
 * Suggest a keyhole worth granting: an inward class Cole has repeatedly CONFIRMED
 * on the Bridge (≥3) with no undos, but hasn't granted standing autonomy for —
 * evidence he trusts it, so offer to let Aurelius just handle it. Never suggests
 * outward/ungrantable classes (checkGrantable already refuses those on grant).
 */
export async function suggestNextGrant(): Promise<GrantSuggestion[]> {
  const ledger = await getTrustLedger();
  const grantable = new Set(listGrantableClasses().map((c) => c.key));
  const out: GrantSuggestion[] = [];
  for (const row of ledger) {
    if (!grantable.has(row.actionClass)) continue;
    if (row.confirmed < 3 || row.undone > 0) continue;
    if (await isActionGranted(row.actionClass)) continue;
    out.push({
      actionClass: row.actionClass,
      reason: `You've confirmed "${row.actionClass}" ${row.confirmed}× with no undos — want me to just handle it? Grant it and I'll act, reversibly.`,
    });
  }
  return out;
}

// ── THE FLYWHEEL PUSH (check-in council PR4) ────────────────────────────
// suggestNextGrant was pull-only: it computed, but nothing ever carried a
// suggestion to Cole, so grants plateaued at whatever he remembered to flip.
// These two helpers let the morning briefing and the Sunday scoreboard PUSH
// suggestions — with a cooldown ledger so the same suggestion surfaces at
// most once per window across every channel. Suggestion only, never a nag:
// the switch stays Cole's hand on the Autonomy tab.

const SUGGESTION_COOLDOWN_DAYS = 14;

/** Suggestions not surfaced anywhere in the last cooldown window. */
export async function freshGrantSuggestions(
  cooldownDays = SUGGESTION_COOLDOWN_DAYS
): Promise<GrantSuggestion[]> {
  const all = await suggestNextGrant();
  if (all.length === 0) return [];
  const since = new Date(Date.now() - cooldownDays * 86400_000);
  const fresh: GrantSuggestion[] = [];
  for (const s of all) {
    const recent = await prisma.logEntry.findFirst({
      where: { type: "trace", message: `grant_suggestion:${s.actionClass}`, createdAt: { gte: since } },
      select: { id: true },
    });
    if (!recent) fresh.push(s);
  }
  return fresh;
}

/** Start the cooldown clock for suggestions a channel just carried. */
export async function markSuggestionsSurfaced(suggestions: GrantSuggestion[]): Promise<void> {
  if (suggestions.length === 0) return;
  try {
    const { resolveOperatorId } = await import("../knowledge/store.ts");
    const opId = await resolveOperatorId("global");
    if (!opId) return;
    await prisma.logEntry.createMany({
      data: suggestions.map((s) => ({
        operatorId: opId,
        type: "trace",
        level: "info",
        message: `grant_suggestion:${s.actionClass}`,
        context: { surfaced: true } as any,
      })),
    });
  } catch (err) {
    console.warn("[trustLedger] cooldown mark failed (suggestion may resurface early):", (err as any)?.message ?? err);
  }
}
