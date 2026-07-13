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
  job: any; // node-schedule Job (package ships no types)
};

const registry = new Map<string, NamedJob>();

const OVERRIDES_SCOPE = "system";
const OVERRIDES_KEY = "schedule_overrides";

/**
 * Register a named scheduled job. Wraps nodeSchedule.scheduleJob so the job can
 * later be re-timed by name. Call once per job at boot; overrides are applied
 * afterward by applyScheduleOverrides().
 */
export function scheduleNamed(
  name: string,
  defaultCron: string,
  label: string,
  handler: () => void | Promise<void>
): nodeSchedule.Job {
  const job = nodeSchedule.scheduleJob(name, defaultCron, handler as any);
  registry.set(name, { name, label, defaultCron, currentCron: defaultCron, job });
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

export type ScheduleRow = { name: string; label: string; time: string; cadence: string };

/** Current times for every registered job — for "what's my schedule?". */
export function listSchedules(): ScheduleRow[] {
  return [...registry.values()]
    .map((j) => ({ name: j.name, label: j.label, time: cronToTime(j.currentCron), cadence: cadence(j.currentCron) }))
    .sort((a, b) => a.time.localeCompare(b.time));
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

/** Resolve a job by exact name or a fuzzy label match ("morning brief" → morning_briefing). */
function resolveJob(nameOrLabel: string): NamedJob | null {
  const q = nameOrLabel.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (registry.has(q)) return registry.get(q)!;
  // fuzzy: match on label words or name substring
  const bare = nameOrLabel.trim().toLowerCase();
  for (const j of registry.values()) {
    if (j.name.includes(q) || q.includes(j.name)) return j;
    if (j.label.toLowerCase().includes(bare) || bare.includes(j.label.toLowerCase())) return j;
  }
  // last try: match on the first word (e.g. "morning")
  const first = bare.split(/\s+/)[0];
  for (const j of registry.values()) {
    if (j.label.toLowerCase().includes(first) || j.name.includes(first)) return j;
  }
  return null;
}

async function readOverrides(): Promise<Record<string, string>> {
  const { prisma } = await import("./db/prisma.ts");
  const row = await prisma.knowledgeEntry.findFirst({
    where: { scope: OVERRIDES_SCOPE, key: OVERRIDES_KEY, active: true },
  });
  const v = row?.value as any;
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

async function writeOverride(name: string, cron: string): Promise<void> {
  const { resolveOperatorId, setKnowledge } = await import("../knowledge/store.ts");
  const opId = await resolveOperatorId("global");
  if (!opId) return;
  const current = await readOverrides();
  current[name] = cron;
  await setKnowledge({
    operatorId: opId,
    scope: OVERRIDES_SCOPE,
    key: OVERRIDES_KEY,
    value: current,
    sourceType: "system" as any,
    sourceId: "schedule_control",
    rationale: "Cole-set ritual time",
    updatedBy: "cole",
  });
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
  const target = resolveJob(nameOrLabel);
  if (!target) {
    return {
      ok: false,
      error: `no scheduled ritual matches "${nameOrLabel}". Known: ${[...registry.values()].map((j) => j.label).join(", ")}.`,
    };
  }
  const parsed = parseTime(time);
  if (!parsed) {
    return { ok: false, error: `couldn't read "${time}" as a time. Try "6:30", "7am", or "18:00".` };
  }

  const newCron = retimeCron(target.currentCron, parsed.hour, parsed.minute);
  const rescheduled = target.job.reschedule(newCron as any);
  if (!rescheduled) {
    return { ok: false, error: `rescheduling ${target.label} failed (invalid cron "${newCron}")` };
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

/** Boot hook — apply any Cole-set overrides on top of the registered defaults. */
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
  } catch (err) {
    console.warn("[schedule] applying overrides failed (defaults stand):", (err as any)?.message ?? err);
  }
}
