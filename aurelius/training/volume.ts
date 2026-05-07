// aurelius/training/volume.ts
//
// Deterministic volume analysis math. No LLM, no API calls.
// Pure functions that compute tonnage, set counts, and trends from
// session data read out of athlete sheets.
//
// Phase 4 contract: reasoning layer calls these functions, gets structured
// numbers back, then reasons ABOUT the numbers. Math is reliable; reasoning
// is creative.

export type SessionRow = {
  date: string;          // "2026-05-01" or similar
  number: string;        // "1", "2" — exercise order within session
  exercise: string;      // "Hack Squat"
  sets: string;          // "3" or "1 Warmup 3 Working"
  reps: string;          // "8,6,6" or "8" or "8/side" or "AMRAP"
  load: string;          // "155/185/185" or "185" or "BW" or "2 plates + 25"
  tempo?: string;
  rpe?: string;
  notes?: string;
};

export type ExerciseTonnage = {
  exercise: string;
  workingSets: number;
  totalReps: number;
  tonnage: number;       // sum of (load * reps) across working sets
  highestLoad: number;   // peak load in this session for this exercise
};

export type SessionVolume = {
  date: string;
  sessionTonnage: number;       // total tonnage across all exercises
  totalWorkingSets: number;     // working sets only (warmups excluded)
  exercises: ExerciseTonnage[]; // per-exercise breakdown
  unparseable: number;          // count of rows we couldn't fully parse
};

export type WeeklyVolume = {
  weekStart: string;            // "2026-04-27" (Monday)
  weekEnd: string;              // "2026-05-03" (Sunday)
  totalTonnage: number;
  sessionCount: number;
  totalWorkingSets: number;
  averagePerSession: number;
  sessionsByDate: Record<string, number>; // date → session tonnage
};

export type BlockVolume = {
  blockStart: string;           // earliest session date in window
  blockEnd: string;             // latest session date in window
  totalTonnage: number;
  totalSessions: number;
  weeklyTonnage: WeeklyVolume[]; // chronological
  weekOverWeekDeltas: number[];  // % delta per week relative to previous
};

// ═══════════════════════════════════════════════════════════════════
// PARSING HELPERS
// Real-world load/rep strings are messy. Best-effort parse.
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse a comma-separated reps string into per-set rep counts.
 * "8,6,6" → [8, 6, 6]
 * "10,8,8" → [10, 8, 8]
 * "8" → [8]
 * "8/side" → [8] (note: per-side reps; we don't double here, that's for the reasoner to flag)
 * "AMRAP" → [] (unmeasurable, returns empty)
 * "20 yds" → [] (distance-based, not reps)
 * "12" → [12]
 */
export function parseReps(repsStr: string): number[] {
  if (!repsStr) return [];
  const cleaned = repsStr.trim().toLowerCase();

  // AMRAP, max, distance-based — unmeasurable for tonnage
  if (cleaned.includes("amrap") || cleaned.includes("max")) return [];
  if (cleaned.includes("yds") || cleaned.includes("yards") || cleaned.includes("meters") || cleaned.includes("min")) return [];

  // Strip "/side" suffix — leave the number itself
  const withoutSide = cleaned.replace(/\s*\/?\s*side\s*$/, "").replace(/\s*per\s*side\s*$/, "");

  // Comma-separated list
  if (withoutSide.includes(",")) {
    return withoutSide
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
  }

  // Single number
  const n = parseInt(withoutSide, 10);
  if (!isNaN(n) && n > 0) return [n];

  return [];
}

/**
 * Parse a comma- or slash-separated load string into per-set loads.
 * "155/185/185" → [155, 185, 185]
 * "115/125/130" → [115, 125, 130]
 * "185" → [185]
 * "BW" or "bodyweight" → [] (bodyweight; tonnage isn't load*reps in the lifted-weight sense)
 * "60s DB" → [60] (best-effort numeric extraction)
 * "2 plates + 25" → [115] (45*2 + 25 = 115, plates assumed 45)
 * "3+25" → [160] (3 plates + 25 = 160)
 */
export function parseLoads(loadStr: string): number[] {
  if (!loadStr) return [];
  const cleaned = loadStr.trim().toLowerCase();

  // Bodyweight: tonnage doesn't apply in the load-times-reps sense
  if (cleaned === "bw" || cleaned === "bodyweight" || cleaned === "body weight") return [];

  // Slash- or comma-separated list of numbers
  if (cleaned.includes("/") || cleaned.includes(",")) {
    return cleaned
      .split(/[\/,]/)
      .map((s) => extractFirstNumber(s.trim()))
      .filter((n): n is number => n !== null && n > 0);
  }

  // "N plates + M" → 45*N + M (assumes 45-lb plates per side, but here it's typically TOTAL plates)
  const platesMatch = cleaned.match(/^(\d+)\s*plates?\s*(?:\+\s*(\d+))?$/);
  if (platesMatch) {
    const plates = parseInt(platesMatch[1]!, 10);
    const extra = platesMatch[2] ? parseInt(platesMatch[2]!, 10) : 0;
    // Assumption: "N plates + M" means N plates per side at 45 lb + M lb extra (e.g., on a sled)
    // This is a coaching-domain assumption that may need to be revisited.
    return [plates * 45 * 2 + extra];
  }

  // "N+M" shorthand → N plates per side at 45 + M
  const shortMatch = cleaned.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (shortMatch) {
    const plates = parseInt(shortMatch[1]!, 10);
    const extra = parseInt(shortMatch[2]!, 10);
    return [plates * 45 * 2 + extra];
  }

  // Single number with possible suffix ("60s DB", "185 lb")
  const single = extractFirstNumber(cleaned);
  return single !== null && single > 0 ? [single] : [];
}

/**
 * Parse the sets field. We treat the working-set count as the primary signal.
 * "3" → { warmup: 0, working: 3 }
 * "1 Warmup 3 Working" → { warmup: 1, working: 3 }
 * "1W 3" → { warmup: 1, working: 3 }
 * "1 W 3" → { warmup: 1, working: 3 }
 * "2" → { warmup: 0, working: 2 }
 */
export function parseSets(setsStr: string): { warmup: number; working: number } {
  if (!setsStr) return { warmup: 0, working: 0 };
  const cleaned = setsStr.trim().toLowerCase();

  // "1 warmup 3 working" or "1 w 3" pattern
  const wwMatch = cleaned.match(/(\d+)\s*w(?:armup)?\s*(\d+)/);
  if (wwMatch) {
    return {
      warmup: parseInt(wwMatch[1]!, 10),
      working: parseInt(wwMatch[2]!, 10),
    };
  }

  // Just a number
  const n = parseInt(cleaned, 10);
  if (!isNaN(n) && n > 0) return { warmup: 0, working: n };

  return { warmup: 0, working: 0 };
}

function extractFirstNumber(str: string): number | null {
  const match = str.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]!);
  return isNaN(n) ? null : n;
}

// ═══════════════════════════════════════════════════════════════════
// PER-EXERCISE TONNAGE
// Computes working-set tonnage. Warmups excluded by convention.
// When per-set loads/reps don't align cleanly, falls back to averaging.
// ═══════════════════════════════════════════════════════════════════

export function computeExerciseTonnage(row: SessionRow): ExerciseTonnage {
  const sets = parseSets(row.sets);
  const reps = parseReps(row.reps);
  const loads = parseLoads(row.load);

  let tonnage = 0;
  let totalReps = 0;
  let highestLoad = 0;

  if (loads.length > 0) {
    highestLoad = Math.max(...loads);
  }

  // Best case: per-set loads and per-set reps align with working-set count
  if (loads.length === sets.working && reps.length === sets.working) {
    for (let i = 0; i < sets.working; i++) {
      tonnage += loads[i]! * reps[i]!;
      totalReps += reps[i]!;
    }
    return {
      exercise: row.exercise,
      workingSets: sets.working,
      totalReps,
      tonnage,
      highestLoad,
    };
  }

  // Per-set loads provided but reps is a single number (or vice versa)
  if (loads.length === sets.working && reps.length === 1) {
    const r = reps[0]!;
    for (const l of loads) {
      tonnage += l * r;
      totalReps += r;
    }
    return {
      exercise: row.exercise,
      workingSets: sets.working,
      totalReps,
      tonnage,
      highestLoad,
    };
  }

  if (reps.length === sets.working && loads.length === 1) {
    const l = loads[0]!;
    for (const r of reps) {
      tonnage += l * r;
      totalReps += r;
    }
    return {
      exercise: row.exercise,
      workingSets: sets.working,
      totalReps,
      tonnage,
      highestLoad,
    };
  }

  // Single load + single rep across N working sets
  if (loads.length === 1 && reps.length === 1 && sets.working > 0) {
    const l = loads[0]!;
    const r = reps[0]!;
    tonnage = l * r * sets.working;
    totalReps = r * sets.working;
    return {
      exercise: row.exercise,
      workingSets: sets.working,
      totalReps,
      tonnage,
      highestLoad,
    };
  }

  // Bodyweight or unparseable load — count sets and reps but tonnage stays 0
  if (loads.length === 0 && reps.length > 0) {
    totalReps = reps.reduce((a, b) => a + b, 0);
    if (reps.length === 1 && sets.working > 0) {
      totalReps = reps[0]! * sets.working;
    }
    return {
      exercise: row.exercise,
      workingSets: sets.working,
      totalReps,
      tonnage: 0,
      highestLoad: 0,
    };
  }

  // Last resort: just return the structure with what we have
  return {
    exercise: row.exercise,
    workingSets: sets.working,
    totalReps: reps.reduce((a, b) => a + b, 0),
    tonnage,
    highestLoad,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PER-SESSION VOLUME
// A "session" = all rows sharing the same date for a given athlete + day tab.
// ═══════════════════════════════════════════════════════════════════

export function computeSessionVolume(rows: SessionRow[]): SessionVolume {
  if (rows.length === 0) {
    return {
      date: "",
      sessionTonnage: 0,
      totalWorkingSets: 0,
      exercises: [],
      unparseable: 0,
    };
  }

  // All rows assumed to share the same date (group upstream if not)
  const date = rows[0]!.date;
  let sessionTonnage = 0;
  let totalWorkingSets = 0;
  let unparseable = 0;
  const exercises: ExerciseTonnage[] = [];

  for (const row of rows) {
    const tonnage = computeExerciseTonnage(row);
    exercises.push(tonnage);
    sessionTonnage += tonnage.tonnage;
    totalWorkingSets += tonnage.workingSets;

    // If we got 0 tonnage AND 0 reps AND 0 sets, the row was unparseable
    if (tonnage.tonnage === 0 && tonnage.totalReps === 0 && tonnage.workingSets === 0) {
      unparseable++;
    }
  }

  return {
    date,
    sessionTonnage,
    totalWorkingSets,
    exercises,
    unparseable,
  };
}

// ═══════════════════════════════════════════════════════════════════
// PER-WEEK / PER-BLOCK VOLUME
// Operates on multiple sessions, grouping by week.
// ═══════════════════════════════════════════════════════════════════

/**
 * Group session rows by date. Returns map of date → rows.
 */
export function groupSessionsByDate(rows: SessionRow[]): Map<string, SessionRow[]> {
  const map = new Map<string, SessionRow[]>();
  for (const row of rows) {
    if (!row.date) continue;
    const list = map.get(row.date) ?? [];
    list.push(row);
    map.set(row.date, list);
  }
  return map;
}

/**
 * Compute the Monday-of-week for a given ISO-style date string.
 * "2026-05-01" (Friday) → "2026-04-27" (Monday)
 */
function weekStartFor(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return dateStr; // fallback
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (dayOfWeek + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function weekEndFor(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  if (isNaN(d.getTime())) return weekStart;
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Aggregate session volumes into weekly buckets.
 */
export function computeWeeklyVolumes(rows: SessionRow[]): WeeklyVolume[] {
  const sessionsByDate = groupSessionsByDate(rows);
  const weekBuckets = new Map<string, {
    sessions: SessionVolume[];
    sessionsByDate: Record<string, number>;
  }>();

  // Group session volumes by week-start
  for (const [date, sessionRows] of sessionsByDate.entries()) {
    const weekStart = weekStartFor(date);
    const sessionVol = computeSessionVolume(sessionRows);

    const bucket = weekBuckets.get(weekStart) ?? { sessions: [], sessionsByDate: {} };
    bucket.sessions.push(sessionVol);
    bucket.sessionsByDate[date] = sessionVol.sessionTonnage;
    weekBuckets.set(weekStart, bucket);
  }

  // Build sorted weekly summaries
  const weeks: WeeklyVolume[] = [];
  const sortedStarts = Array.from(weekBuckets.keys()).sort();

  for (const weekStart of sortedStarts) {
    const bucket = weekBuckets.get(weekStart)!;
    const totalTonnage = bucket.sessions.reduce((a, s) => a + s.sessionTonnage, 0);
    const totalWorkingSets = bucket.sessions.reduce((a, s) => a + s.totalWorkingSets, 0);
    const sessionCount = bucket.sessions.length;
    weeks.push({
      weekStart,
      weekEnd: weekEndFor(weekStart),
      totalTonnage,
      sessionCount,
      totalWorkingSets,
      averagePerSession: sessionCount > 0 ? Math.round(totalTonnage / sessionCount) : 0,
      sessionsByDate: bucket.sessionsByDate,
    });
  }

  return weeks;
}

/**
 * Compute block-level summary across all sessions in input.
 */
export function computeBlockVolume(rows: SessionRow[]): BlockVolume {
  const weeks = computeWeeklyVolumes(rows);
  const sessionsByDate = groupSessionsByDate(rows);

  const dates = Array.from(sessionsByDate.keys()).sort();
  const blockStart = dates[0] ?? "";
  const blockEnd = dates[dates.length - 1] ?? "";

  const totalTonnage = weeks.reduce((a, w) => a + w.totalTonnage, 0);
  const totalSessions = weeks.reduce((a, w) => a + w.sessionCount, 0);

  // Week-over-week deltas (% change from previous week)
  const weekOverWeekDeltas: number[] = [];
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1]!.totalTonnage;
    const curr = weeks[i]!.totalTonnage;
    const delta = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
    weekOverWeekDeltas.push(delta);
  }

  return {
    blockStart,
    blockEnd,
    totalTonnage,
    totalSessions,
    weeklyTonnage: weeks,
    weekOverWeekDeltas,
  };
}