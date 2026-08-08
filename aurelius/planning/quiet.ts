// aurelius/planning/quiet.ts
//
// QUIET MODE — "away or sick: everything shifts, then resumes itself."
// quietUntil() pauses the PUSHY rituals (morning briefing, midday check,
// nightly debrief, outreach sweep — the ones that expect Cole to act today),
// shifts open-lead follow-ups past the window so nothing "goes overdue" while
// he's down, and records the window as system config. Restore is LAZY and
// self-healing: ensureQuietState() runs wherever the rituals themselves run
// (the briefing generator calls it, and the promises GET route calls it), so
// an expired window re-enables the rituals and announces "back — here's what
// moved" without needing an index.ts hook.
//
// PROCESS HONESTY (same caveat as app/api/tuning/rituals): the node-schedule
// registry is per-process and lives in the backend. From the backend (chat
// tool, Telegram) setEnabled pauses the live jobs immediately. From the Next
// process (settings form) the live registry is out of reach — so we ALSO
// persist the paused set (the same schedule_disabled config the backend boot
// applies), and ensureQuietState re-asserts the live pause the next time any
// ritual generator runs in the backend. Worst case one ritual fires once
// after a settings-set quiet — and fires as the minimal quiet line, because
// the briefing generator checks this module before it speaks.
//
// The paused rituals here are exactly the "pushy" set; the observability
// spine (backups, syncs, sweeps that don't page Cole) keeps running.
//
// Invokers (rule 8): productivity tool adapter `quiet` action (chat) ·
// /quiet Telegram command · settings page form (POST /api/promises op:quiet)
// · restore: rituals/engine.ts (briefing) + GET /api/promises.

import { prisma } from "../core/db/prisma.ts";
import { setEnabled, isJobEnabled, knownJobNames } from "../core/schedule.ts";

/** The pushy rituals — the ones that presume Cole is at his post today. */
export const QUIET_RITUALS = ["morning_briefing", "midday_check", "nightly_debrief", "outreach_sweep"] as const;

const SCOPE = "system";
const QUIET_KEY = "quiet_mode";
const DISABLED_KEY = "schedule_disabled"; // schedule.ts's persisted paused set

const MAX_QUIET_MS = 30 * 86400_000; // a month of silence is a decision, not a mode

type QuietRecord = {
  until: string; // ISO
  reason: string;
  setAt: string; // ISO
  /** Rituals QUIET paused (vs. ones Cole had paused himself) — the only ones restore resumes. */
  pausedByQuiet: string[];
  leadsShifted: number;
};

export type QuietState = {
  active: boolean;
  until?: string;
  reason?: string;
  /** Set on the one call that performed the restore. */
  restored?: boolean;
  summary?: string;
};

// ── Config plumbing (raw prisma — config is never embedded, hard rule 6 spirit) ──

async function globalOperatorId(): Promise<string | null> {
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  return resolveOperatorId("global").catch(() => null);
}

async function readConfig(key: string): Promise<any> {
  const row = await prisma.knowledgeEntry.findFirst({
    where: { scope: SCOPE, key, active: true },
  });
  return row?.value ?? null;
}

async function writeConfig(key: string, value: any): Promise<boolean> {
  const opId = await globalOperatorId();
  if (!opId) {
    console.warn(`[quiet] no global operator — can't persist ${key}`);
    return false;
  }
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId: opId, scope: SCOPE, key } },
    update: { value, updatedBy: "cole", active: true },
    create: {
      operatorId: opId,
      scope: SCOPE,
      key,
      value,
      sourceType: "system",
      sourceId: "quiet_mode",
      rationale: "quiet mode",
      createdBy: "cole",
      updatedBy: "cole",
      version: 1,
      active: true,
      history: [],
    },
  });
  return true;
}

async function readDisabledList(): Promise<string[]> {
  const v = await readConfig(DISABLED_KEY);
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

// ── Parse "3d" / "12h" / bare days ───────────────────────────────────

/** "3d" | "12h" | "3" (days) | number (days) → milliseconds, or null. */
export function parseQuietWindow(spec: string | number | undefined | null): number | null {
  if (spec === undefined || spec === null || spec === "") return null;
  if (typeof spec === "number") return Number.isFinite(spec) && spec > 0 ? spec * 86400_000 : null;
  const m = String(spec).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([dh])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2] === "h" ? n * 3600_000 : n * 86400_000;
}

// ── Enter quiet ──────────────────────────────────────────────────────

export async function quietUntil(
  untilISO: string,
  reason: string
): Promise<{ ok: boolean; error?: string; until?: string; paused?: string[]; pausedLive?: number; leadsShifted?: number }> {
  const now = Date.now();
  const until = new Date(untilISO);
  if (Number.isNaN(until.getTime())) return { ok: false, error: `couldn't read "${untilISO}" as a time` };
  if (until.getTime() <= now) return { ok: false, error: "quiet needs a future end time" };
  const capped = new Date(Math.min(until.getTime(), now + MAX_QUIET_MS));
  const windowMs = capped.getTime() - now;

  // What was ALREADY paused (Cole's own hand) must not be resumed by restore.
  const persistedDisabled = new Set(await readDisabledList().catch(() => [] as string[]));
  const registryKnows = new Set(knownJobNames());
  const alreadyPaused = (name: string) =>
    persistedDisabled.has(name) || (registryKnows.has(name) && !isJobEnabled(name));
  const pausedByQuiet = QUIET_RITUALS.filter((n) => !alreadyPaused(n));

  // Live pause — real in the backend process, a documented miss in the Next
  // process (ensureQuietState re-asserts it from the backend within a day).
  let pausedLive = 0;
  for (const name of QUIET_RITUALS) {
    try {
      const r = await setEnabled(name, false, { persist: true });
      if (r.ok) pausedLive++;
    } catch {
      /* registry out of reach here — persistence below still holds */
    }
  }
  // Persist the paused set regardless of process, so a backend restart during
  // quiet boots with the rituals held.
  try {
    await writeConfig(DISABLED_KEY, [...new Set([...persistedDisabled, ...QUIET_RITUALS])]);
  } catch (err) {
    console.warn("[quiet] persisting paused set failed:", (err as any)?.message ?? err);
  }

  // Shift open-lead follow-ups by the window — nothing "goes cold" on paper
  // while Cole is down, and the outreach sweep finds nothing due on resume day
  // one that was actually due mid-quiet.
  let leadsShifted = 0;
  try {
    const due = await prisma.lead.findMany({
      where: {
        status: { notIn: ["won", "lost"] },
        nextActionAt: { not: null, lt: capped },
      },
      select: { id: true, nextActionAt: true },
      take: 500,
    });
    for (const l of due) {
      await prisma.lead.update({
        where: { id: l.id },
        data: { nextActionAt: new Date(l.nextActionAt!.getTime() + windowMs) },
      });
      leadsShifted++;
    }
  } catch (err) {
    console.warn("[quiet] lead shift failed (quiet still set):", (err as any)?.message ?? err);
  }

  const record: QuietRecord = {
    until: capped.toISOString(),
    reason: (reason ?? "").trim().slice(0, 200) || "away",
    setAt: new Date(now).toISOString(),
    pausedByQuiet,
    leadsShifted,
  };
  const persisted = await writeConfig(QUIET_KEY, record).catch(() => false);
  if (!persisted) return { ok: false, error: "couldn't persist quiet mode (no global operator / db unreachable) — nothing is reliably paused" };

  console.log(`[quiet] quiet until ${record.until} (${record.reason}) — ${pausedLive} live pauses, ${leadsShifted} lead follow-ups shifted`);
  return { ok: true, until: record.until, paused: [...QUIET_RITUALS], pausedLive, leadsShifted };
}

// ── Check / restore (lazy — called from the briefing generator + promises GET) ──

export async function ensureQuietState(): Promise<QuietState> {
  let record: QuietRecord | null = null;
  try {
    const v = await readConfig(QUIET_KEY);
    if (v && typeof v === "object" && typeof v.until === "string") record = v as QuietRecord;
  } catch {
    return { active: false };
  }
  if (!record) return { active: false };

  const until = new Date(record.until);
  if (Number.isNaN(until.getTime())) {
    await clearQuietEntry();
    return { active: false };
  }

  if (until.getTime() > Date.now()) {
    // Still quiet. Re-assert the live pause for any quiet ritual this process
    // can see running (heals a settings-set quiet the first time a ritual
    // generator runs in the backend).
    for (const name of record.pausedByQuiet ?? []) {
      try {
        if (knownJobNames().includes(name) && isJobEnabled(name)) {
          await setEnabled(name, false, { persist: false });
        }
      } catch { /* best-effort */ }
    }
    return { active: true, until: record.until, reason: record.reason };
  }

  // Expired → exactly ONE caller performs the restore (the deactivate is the claim).
  const claimed = await clearQuietEntry();
  if (!claimed) return { active: false };

  for (const name of record.pausedByQuiet ?? []) {
    try {
      await setEnabled(name, true, { persist: true });
    } catch { /* registry out of reach — persisted list cleanup below still holds */ }
  }
  try {
    const disabled = await readDisabledList();
    const keep = disabled.filter((n) => !(record!.pausedByQuiet ?? []).includes(n));
    if (keep.length !== disabled.length) await writeConfig(DISABLED_KEY, keep);
  } catch (err) {
    console.warn("[quiet] cleaning persisted paused set failed:", (err as any)?.message ?? err);
  }

  const summary = await whatMovedSince(new Date(record.setAt)).catch(
    () => "the window passed; the ledgers are intact."
  );
  try {
    const { surfaceSignal } = await import("../core/bridge.ts");
    await surfaceSignal({
      kind: "background_result",
      domain: "personal",
      sourceType: "quiet_mode",
      sourceId: `quiet_restored:${record.until}`,
      severity: "notice",
      title: "Back — here's what moved while you were quiet",
      body: `Quiet (${record.reason}) ended. ${summary}`,
    });
  } catch {
    /* the restore stands even if the signal can't file */
  }
  console.log(`[quiet] quiet expired — rituals restored (${(record.pausedByQuiet ?? []).join(", ") || "none were quiet-paused"})`);
  return { active: false, restored: true, summary };
}

/** End quiet immediately ("I'm back"). Restores via the same path. */
export async function endQuietNow(): Promise<QuietState> {
  try {
    const v = await readConfig(QUIET_KEY);
    if (v && typeof v === "object" && typeof v.until === "string") {
      await writeConfig(QUIET_KEY, { ...v, until: new Date(Date.now() - 1000).toISOString() });
    }
  } catch { /* fall through — ensureQuietState answers honestly either way */ }
  return ensureQuietState();
}

/** Deactivate the quiet entry; true = this caller made the flip (the claim). */
async function clearQuietEntry(): Promise<boolean> {
  try {
    const r = await prisma.knowledgeEntry.updateMany({
      where: { scope: SCOPE, key: QUIET_KEY, active: true },
      data: { active: false },
    });
    return r.count > 0;
  } catch {
    return false;
  }
}

/** One deterministic line: what accumulated during the window. */
async function whatMovedSince(since: Date): Promise<string> {
  const now = new Date();
  const [signalsWaiting, overdueTasks, leadsDueSoon] = await Promise.all([
    prisma.bridgeSignal.count({
      where: { createdAt: { gte: since }, status: { in: ["pending", "surfaced"] } },
    }),
    prisma.task.count({
      where: { dueDate: { gte: since, lt: now }, status: { notIn: ["done", "abandoned"] } },
    }),
    prisma.lead.count({
      where: { status: { notIn: ["won", "lost"] }, nextActionAt: { lte: new Date(now.getTime() + 86400_000) } },
    }),
  ]);
  const parts: string[] = [];
  parts.push(signalsWaiting > 0 ? `${signalsWaiting} signal${signalsWaiting === 1 ? "" : "s"} waiting on the Bridge` : "nothing waiting on the Bridge");
  if (overdueTasks > 0) parts.push(`${overdueTasks} task${overdueTasks === 1 ? "" : "s"} came due`);
  if (leadsDueSoon > 0) parts.push(`${leadsDueSoon} lead follow-up${leadsDueSoon === 1 ? "" : "s"} land${leadsDueSoon === 1 ? "s" : ""} in the next day`);
  return parts.join(" · ") + ".";
}
