// aurelius/core/connectorFreshness.ts
//
// THE CONNECTOR-FRESHNESS LAYER — a loop should refuse to act on stale reads.
//
// Every integration read (calendar sync, inbox scan, IG insights) stamps a
// heartbeat here. A loop that's about to ACT on connector data can then ask
// "how old is what I'm about to trust?" and, if it's stale, propose-and-notify
// instead of finalizing on data that may have moved. The calendar loop already
// guards this way inside findAvailability; this generalises it so every
// connector-fed loop can, and so the doctor can show read-recency, not just
// token health (a live token over a poller that stopped is the silent failure).
//
// Backed by LogEntry (append-only, already indexed on [type, message, createdAt])
// — no schema change, no compound-unique-with-null trap. Recording is
// best-effort: freshness bookkeeping must never break the real read it observes.

import { prisma } from "./db/prisma.ts";

const READ_TYPE = "connector_read";

/** Stamp a successful read from a connector. Call it AFTER the read returns. */
export async function recordConnectorRead(connector: string): Promise<void> {
  try {
    const { resolveOperatorId } = await import("../knowledge/store.ts");
    const opId = await resolveOperatorId("strategy").catch(() => null);
    if (!opId) return; // no operator to attribute to on a bare DB — skip quietly
    await prisma.logEntry.create({
      data: { operatorId: opId, type: READ_TYPE, level: "info", message: connector },
    });
  } catch {
    /* never break a real read over a freshness stamp */
  }
}

export async function connectorLastRead(connector: string): Promise<Date | null> {
  const row = await prisma.logEntry
    .findFirst({ where: { type: READ_TYPE, message: connector }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
    .catch(() => null);
  return row?.createdAt ?? null;
}

export type Freshness = {
  connector: string;
  fresh: boolean;
  lastReadAt: Date | null;
  ageMinutes: number | null;
  reason: string;
};

/**
 * The gate a loop calls before acting. `fresh:false` means: a read this loop
 * depends on is older than maxAgeMinutes (or never happened) — the caller should
 * propose/notify rather than finalize. Never THROWS: a freshness check that
 * crashes must not be worse than no check.
 */
export async function guardFresh(connector: string, maxAgeMinutes: number): Promise<Freshness> {
  const last = await connectorLastRead(connector);
  if (!last) {
    return { connector, fresh: false, lastReadAt: null, ageMinutes: null, reason: `${connector}: no read on record — treat as stale` };
  }
  const ageMinutes = Math.round((Date.now() - last.getTime()) / 60000);
  return {
    connector,
    fresh: ageMinutes <= maxAgeMinutes,
    lastReadAt: last,
    ageMinutes,
    reason: ageMinutes <= maxAgeMinutes ? `${connector}: fresh (${ageMinutes}m)` : `${connector}: last read ${ageMinutes}m ago (> ${maxAgeMinutes}m) — stale`,
  };
}

/** For the doctor / preflight: read-recency across the connectors that stamp. */
export async function connectorFreshnessReport(connectors = ["calendar", "gmail", "instagram"]): Promise<Freshness[]> {
  return Promise.all(connectors.map((c) => guardFresh(c, 24 * 60)));
}
