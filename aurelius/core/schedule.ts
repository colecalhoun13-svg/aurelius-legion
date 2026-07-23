// aurelius/core/schedule.ts
//
// THE SCHEDULE CONTROL PLANE. The scheduled spine (morning briefing, midday
// check, nightly debrief, the Sunday sweeps) used to be hardcoded crons in
// index.ts with no way for Cole to change a time — "move my brief to 6:30" had
// no tool, so Aurelius refused. This registry fixes that:
//
//   • Every scheduled job registers here by NAME (scheduleNamed).
//   • Per-ritual time OVERRIDES persist in Living Knowledge (system scope), so a
//     change survives restarts.
//   • Changing a time reschedules the LIVE node-schedule job (Job.reschedule) —
//     it takes effect immediately, not just next boot.
//   • Only the time-of-day changes; the job's frequency/day-of-week (daily vs
//     Sunday-only) is preserved from its default cron.
//
// The scheduler runs in the backend Express process (index.ts); the web chat
// proxies there and Telegram lives there too, so a tool call from either surface
// reschedules the real job.

import nodeSchedule from "node-schedule";

type NamedJob = {
  name: string;
  label: string; // human phrase, e.g. "morning briefing"
  defaultCron: string;
  currentCron: string;
  job: any; // node-schedule Job (package ships no types); null while paused
  handler: () => void | Promise<void>; // kept so a paused job can be re-created
  enabled: boolean;
};

const registry = new Map<string, NamedJob>();

const OVERRIDES_SCOPE = "system";
const OVERRIDES_KEY = "schedule_overrides";
const DISABLED_KEY = "schedule_disabled";

/**
 * Register a named scheduled job. Wraps nodeSchedule.scheduleJob so the job can
 * later be re-timed OR paused by name. Call once per job at boot; overrides and
 * pauses are applied afterward by applyScheduleOverrides().
 */
export function scheduleNamed(
  name: string,
  defaultCron: string,
  label: string,
  handler: () => void | Promise<void>
): any {
  const job = nodeSchedule.scheduleJob(name, defaultCron, handler as any);
  registry.set(name, { name, label, defaultCron, currentCron: defaultCron, job, handler, enabled: true });
  return job;
}

/** Parse a time Cole typed into 24h {hour, minute}. Accepts:
 *  "7", "07", "7:30", "07:30", "7am", "7 pm", "6:30pm", "13:00", "1330".
 *  Returns null if it can't be read as a time. */
export function parseTime(input: string): { hour: number; minute: number } | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const ampm = /(am|pm)\s*$/.exec(raw)?.[1];
  const body = raw.replace(/\s*(am|pm)\s*$/, "").trim();

  let hour: number;
  let minute = 0;

  if (/^\d{1,2}:\d{2}$/.test(body)) {
    const [h, m] = body.split(":");
    hour = Number(h);
    minute = Number(m);
  } else if (/^\d{3,4}$/.test(body)) {
    // military-ish "1330" / "930"
    const s = body.padStart(4, "0");
    hour = Number(s.slice(0, 2));
    minute = Number(s.slice(2));
  } else if (/^\d{1,2}$/.test(body)) {
    hour = Number(body);
  } else {
    return null;
  }

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Replace only the minute+hour of a 5-field cron, preserving DOM/MON/DOW so a
 *  daily job stays daily and a Sunday job stays Sunday. */
function retimeCron(cron: string, hour: number, minute: number): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`can't retime non-standard cron: "${cron}"`);
  parts[0] = String(minute);
  parts[1] = String(hour);
  return parts.join(" ");
}

/** HH:MM display of a cron's fire time (assumes numeric minute/hour). */
function cronToTime(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  const h = Number(parts[1]);
  const m = Number(parts[0]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return cron;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Sunday-only jobs carry "0" in the DOW field; used for a friendlier listing. */
function cadence(cron: string): string {
  const dow = cron.trim().split(/\s+/)[4];
  if (dow === "0") return "Sundays";
  if (dow === "*") return "daily";
  return `cron ${dow}`;
}

export type ScheduleRow = { name: string; label: string; time: string; cadence: string; enabled: boolean };

/** Current times for every registered job — for "what's my schedule?". */
export function listSchedules(): ScheduleRow[] {
  return [...registry.values()]
    .map((j) => ({ name: j.name, label: j.label, time: cronToTime(j.currentCron), cadence: cadence(j.currentCron), enabled: j.enabled }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Whether a named job is currently active (not paused). catchUp uses this so a
 *  paused ritual is neither fired live nor caught up. Unknown name → true (don't
 *  suppress a job we don't track). */
export function isJobEnabled(name: string): boolean {
  return registry.get(name)?.enabled ?? true;
}

export function knownJobNames(): string[] {
  return [...registry.keys()];
}

/** The effective fire time for a named job (after overrides), or null if unknown.
 *  catchUp.ts uses this so a re-timed ritual is "caught up" at its NEW time, not
 *  the hardcoded default. */
export function getEffectiveTime(name: string): { hour: number; minute: number } | null {
  const j = registry.get(name);
  if (!j) return null;
  const parts = j.currentCron.trim().split(/\s+/);
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

/**
 * Resolve a job by exact name/label, else fuzzy. Returns `{ job }` for a single
 * hit, `{ job: null, candidates }` when a loose query matches MORE THAN ONE
 * (e.g. "weekly" → weekly_planning + weekly_scoreboard, "pulse" → market/weekend/
 * initiative) so the caller can ask Cole to disambiguate instead of silently
 * mutating the first-registered sibling. `{ job: null, candidates: [] }` = none.
 */
function resolveJob(nameOrLabel: string): { job: NamedJob | null; candidates: NamedJob[] } {
  // Strip leading stop-words so "pause the debrief" / "my morning brief" resolve.
  const normalized = nameOrLabel.trim().toLowerCase().replace(/\b(the|my|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
  const q = normalized.replace(/[\s-]+/g, "_");
  if (registry.has(q)) return { job: registry.get(q)!, candidates: [] };

  const bare = normalized;
  // Exact label match is unambiguous even if a substring would match others.
  const exactLabel = [...registry.values()].filter((j) => j.label.toLowerCase() === bare);
  if (exactLabel.length === 1) return { job: exactLabel[0], candidates: [] };

  const matches = new Set<NamedJob>();
  for (const j of registry.values()) {
    if (j.name.includes(q) || q.includes(j.name)) matches.add(j);
    if (j.label.toLowerCase().includes(bare) || bare.includes(j.label.toLowerCase())) matches.add(j);
  }
  if (matches.size === 0) {
    // last resort: first word (e.g. "morning")
    const first = bare.split(/\s+/)[0];
    for (const j of registry.values()) {
      if (j.label.toLowerCase().includes(first) || j.name.includes(first)) matches.add(j);
    }
  }
  const arr = [...matches];
  if (arr.length === 1) return { job: arr[0], candidates: [] };
  return { job: null, candidates: arr };
}

/** Shared error for a resolve miss/ambiguity. */
function resolveError(nameOrLabel: string, candidates: NamedJob[]): string {
  if (candidates.length > 1) {
    return `"${nameOrLabel}" matches ${candidates.length} rituals: ${candidates.map((c) => c.label).join(", ")}. Which one?`;
  }
  return `no scheduled ritual matches "${nameOrLabel}". Known: ${[...registry.values()].map((j) => j.label).join(", ")}.`;
}

async function readOverrides(): Promise<Record<string, string>> {
  const { prisma, withDb } = await import("./db/prisma.ts");
  // withDb: this runs at boot, possibly racing a cold Neon — retry instead of
  // throwing, or a paused/re-timed ritual silently reverts to its default.
  // 5 attempts (same depth as warmupDb): 3 wasn't enough for a cold pooler.
  const row = await withDb(
    () => prisma.knowledgeEntry.findFirst({ where: { scope: OVERRIDES_SCOPE, key: OVERRIDES_KEY, active: true } }),
    5
  );
  const v = row?.value as any;
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

// Schedule config is CONFIG, not knowledge — write it with raw prisma so it
// never lands in the vector index (setKnowledge embeds its value, which would
// spray cron JSON into semantic recall). Same spirit as hard rule 6 for creds.
async function writeConfig(key: string, value: any): Promise<void> {
  const { prisma } = await import("./db/prisma.ts");
  const { resolveOperatorId } = await import("../knowledge/store.ts");
  const opId = await resolveOperatorId("global");
  if (!opId) {
    console.warn(`[schedule] no global operator — can't persist ${key} (live change stands, won't survive restart)`);
    return;
  }
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId: opId, scope: OVERRIDES_SCOPE, key } },
    update: { value, updatedBy: "cole", active: true },
    create: {
      operatorId: opId,
      scope: OVERRIDES_SCOPE,
      key,
      value,
      sourceType: "system",
      sourceId: "schedule_control",
      rationale: "schedule control",
      createdBy: "cole",
      updatedBy: "cole",
      version: 1,
      active: true,
      history: [],
    },
  });
}

async function writeOverride(name: string, cron: string): Promise<void> {
  const current = await readOverrides();
  current[name] = cron;
  await writeConfig(OVERRIDES_KEY, current);
}

async function readDisabled(): Promise<string[]> {
  const { prisma, withDb } = await import("./db/prisma.ts");
  const row = await withDb(
    () => prisma.knowledgeEntry.findFirst({ where: { scope: OVERRIDES_SCOPE, key: DISABLED_KEY, active: true } }),
    5
  );
  const v = row?.value as any;
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

async function writeDisabled(names: string[]): Promise<void> {
  await writeConfig(DISABLED_KEY, [...new Set(names)]);
}

export type SetEnabledResult = { ok: boolean; error?: string; name?: string; label?: string; enabled?: boolean };

/**
 * Pause or resume a ritual. Pausing cancels the live node-schedule job; resuming
 * re-creates it at its current time. Persists the paused set so it survives a
 * restart. `persist=false` is used by applyScheduleOverrides() at boot.
 */
export async function setEnabled(
  nameOrLabel: string,
  enabled: boolean,
  opts: { persist?: boolean } = {}
): Promise<SetEnabledResult> {
  const persist = opts.persist ?? true;
  const { job: target, candidates } = resolveJob(nameOrLabel);
  if (!target) {
    return { ok: false, error: resolveError(nameOrLabel, candidates) };
  }

  if (enabled && !target.enabled) {
    // Resume: re-create the job at its current time (a cancelled Job is spent).
    target.job = nodeSchedule.scheduleJob(target.name, target.currentCron as any, target.handler as any);
    target.enabled = true;
  } else if (!enabled && target.enabled) {
    // Pause: cancel all pending invocations. The handler is kept for resume.
    if (target.job?.cancel) target.job.cancel();
    target.job = null;
    target.enabled = false;
  }

  if (persist) {
    try {
      const disabled = [...registry.values()].filter((j) => !j.enabled).map((j) => j.name);
      await writeDisabled(disabled);
    } catch (err) {
      console.warn(`[schedule] persisting paused set failed (live change stands):`, (err as any)?.message ?? err);
    }
  }

  console.log(`[schedule] ${target.name} ${target.enabled ? "resumed" : "paused"}`);
  return { ok: true, name: target.name, label: target.label, enabled: target.enabled };
}

// Flat (non-discriminated) shape on purpose: this project runs tsc with
// strict:false, where discriminated-union narrowing on a boolean `ok` is
// unreliable at call sites. Optional fields + an explicit `ok` are simplest.
export type SetScheduleResult = {
  ok: boolean;
  error?: string;
  name?: string;
  label?: string;
  time?: string;
  cadence?: string;
};

/**
 * Change a ritual's time-of-day. `time` is anything parseTime accepts. Reschedules
 * the live job AND persists the override so it survives restart. `persist=false`
 * is used by applyScheduleOverrides() (already persisted → just re-time the job).
 */
export async function setSchedule(
  nameOrLabel: string,
  time: string,
  opts: { persist?: boolean } = {}
): Promise<SetScheduleResult> {
  const persist = opts.persist ?? true;
  const { job: target, candidates } = resolveJob(nameOrLabel);
  if (!target) {
    return { ok: false, error: resolveError(nameOrLabel, candidates) };
  }
  const parsed = parseTime(time);
  if (!parsed) {
    return { ok: false, error: `couldn't read "${time}" as a time. Try "6:30", "7am", or "18:00".` };
  }

  const newCron = retimeCron(target.currentCron, parsed.hour, parsed.minute);
  // A paused job has no live node-schedule job to reschedule — just record the
  // new time so it takes effect when resumed.
  if (target.enabled && target.job) {
    const rescheduled = target.job.reschedule(newCron as any);
    if (!rescheduled) {
      return { ok: false, error: `rescheduling ${target.label} failed (invalid cron "${newCron}")` };
    }
  }
  target.currentCron = newCron;

  if (persist) {
    try {
      await writeOverride(target.name, newCron);
    } catch (err) {
      console.warn(`[schedule] persisted override failed for ${target.name} (live change stands):`, (err as any)?.message ?? err);
    }
  }

  console.log(`[schedule] ${target.name} → ${cronToTime(newCron)} (${cadence(newCron)})`);
  return { ok: true, name: target.name, label: target.label, time: cronToTime(newCron), cadence: cadence(newCron) };
}

/** Boot hook — apply Cole-set time overrides AND paused rituals over the defaults. */
export async function applyScheduleOverrides(): Promise<void> {
  try {
    const overrides = await readOverrides();
    let applied = 0;
    for (const [name, cron] of Object.entries(overrides)) {
      const job = registry.get(name);
      if (!job || typeof cron !== "string") continue;
      const time = cronToTime(cron);
      const r = await setSchedule(name, time, { persist: false });
      if (r.ok) applied++;
    }
    if (applied > 0) console.log(`[schedule] applied ${applied} Cole-set time override(s)`);

    const disabled = await readDisabled();
    let paused = 0;
    for (const name of disabled) {
      if (!registry.has(name)) continue;
      const r = await setEnabled(name, false, { persist: false });
      if (r.ok) paused++;
    }
    if (paused > 0) console.log(`[schedule] re-applied ${paused} paused ritual(s)`);
  } catch (err) {
    console.warn("[schedule] applying overrides failed (defaults stand):", (err as any)?.message ?? err);
  }
}
