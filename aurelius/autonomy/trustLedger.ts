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
