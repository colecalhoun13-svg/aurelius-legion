// aurelius/knowledge/foundationalTrainingKnowledge.ts
//
// Phase 4.5a — Foundational Training Knowledge (founding defaults).
//
// These are the SEED VALUES Aurelius starts with. They get inserted into
// the KnowledgeEntry table on first run. After that, the DB is the source
// of truth. These constants are kept for reproducibility, fresh deploys,
// and as a reference for what the founding state looked like.
//
// IMPORTANT — once seeded, the DB IS THE TRUTH. If Cole updates rep bands
// via conversation, the DB changes but this file does NOT. This file
// represents the snapshot at deploy time, not Aurelius's current understanding.
//
// To re-seed (rare): run the seed script with --force flag (impl in Block 3).
//
// Authored by Cole's coaching philosophy as of v0.

// ═══════════════════════════════════════════════════════════════════
// REP BANDS — Cole's coaching definition of training intent by avg reps
// 1-3   power
// 4-5   strength
// 6-7   strength_endurance
// 8-14  hypertrophy
// 15+   endurance
// ═══════════════════════════════════════════════════════════════════

export type RepBandIntent =
  | "power"
  | "strength"
  | "strength_endurance"
  | "hypertrophy"
  | "endurance"
  | "warmup_or_assessment"
  | "conditioning"
  | "mixed_or_unclear";

export type RepBandEntry = {
  intent: RepBandIntent;
  lowerReps: number;       // inclusive lower bound (avg reps)
  upperReps: number;       // inclusive upper bound (avg reps)
  rationale: string;
};

export const FOUNDING_REP_BANDS: Record<string, RepBandEntry> = {
  power: {
    intent: "power",
    lowerReps: 1,
    upperReps: 3,
    rationale: "Cole: 1-3 reps is power / max-strength territory.",
  },
  strength: {
    intent: "strength",
    lowerReps: 4,
    upperReps: 5,
    rationale: "Cole: 4-5 reps is pure strength.",
  },
  strength_endurance: {
    intent: "strength_endurance",
    lowerReps: 6,
    upperReps: 7,
    rationale: "Cole: 6-7 reps is strength / strength-endurance bridge.",
  },
  hypertrophy: {
    intent: "hypertrophy",
    lowerReps: 8,
    upperReps: 14,
    rationale: "Cole: 8-14 reps is hypertrophy zone (high-rep hypertrophy included).",
  },
  endurance: {
    intent: "endurance",
    lowerReps: 15,
    upperReps: 999,
    rationale: "Cole: 15+ reps is muscular endurance.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// REP INTENT (movement-of-load patterns within a session)
// Captures what Cole is testing with descending/ascending rep schemes.
// ═══════════════════════════════════════════════════════════════════

export type RepPatternIntent =
  | "capacity_test"        // descending reps + ascending load — testing strength ceiling
  | "fatigue_resilience"   // ascending reps + flat load — testing output under fatigue
  | "volume_accumulation"  // flat reps + flat load — doing the work
  | "ramp_to_top_set"      // flat reps + ascending load — warming to a heavy set
  | "back_off_volume"      // ascending reps + descending load — heavy then volume
  | "unclear";

export type RepPatternEntry = {
  intent: RepPatternIntent;
  rationale: string;
};

export const FOUNDING_REP_PATTERNS: Record<string, RepPatternEntry> = {
  capacity_test: {
    intent: "capacity_test",
    rationale: "Cole: descending reps with ascending load — checking if athlete can handle progressive intensity.",
  },
  fatigue_resilience: {
    intent: "fatigue_resilience",
    rationale: "Cole: ascending reps with consistent load — observing how the muscle holds up under early fatigue.",
  },
  volume_accumulation: {
    intent: "volume_accumulation",
    rationale: "Consistent reps and load across sets — accumulating work at a target stimulus.",
  },
  ramp_to_top_set: {
    intent: "ramp_to_top_set",
    rationale: "Consistent rep count with ascending load — warming progressively toward a heavy set.",
  },
  back_off_volume: {
    intent: "back_off_volume",
    rationale: "Heavy top set followed by lighter higher-rep volume — strength + hypertrophy combo.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// INTENSITY ZONES — load as % of est 1RM
// ═══════════════════════════════════════════════════════════════════

export type IntensityZoneEntry = {
  zone: string;
  lowerPct: number;
  upperPct: number;
  rationale: string;
};

export const FOUNDING_INTENSITY_ZONES: Record<string, IntensityZoneEntry> = {
  recovery: {
    zone: "recovery",
    lowerPct: 0,
    upperPct: 49,
    rationale: "Below 50% of est 1RM — recovery and movement-quality work.",
  },
  accumulation: {
    zone: "accumulation",
    lowerPct: 50,
    upperPct: 69,
    rationale: "50-69% of est 1RM — accumulation / base volume zone.",
  },
  intensification: {
    zone: "intensification",
    lowerPct: 70,
    upperPct: 84,
    rationale: "70-84% of est 1RM — working strength zone.",
  },
  peak: {
    zone: "peak",
    lowerPct: 85,
    upperPct: 94,
    rationale: "85-94% of est 1RM — peak intensity.",
  },
  max_or_near_max: {
    zone: "max_or_near_max",
    lowerPct: 95,
    upperPct: 110,
    rationale: "95%+ of est 1RM — max or near-max work.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// MOVEMENT PATTERNS — exercise name keywords → pattern family
// ═══════════════════════════════════════════════════════════════════

export type MovementPatternEntry = {
  pattern: string;
  keywords: string[];
  priority: number;       // higher priority matches first (resolves "split squat" → lunge_unilateral, not squat_pattern)
  rationale: string;
};

export const FOUNDING_MOVEMENT_PATTERNS: Record<string, MovementPatternEntry> = {
  olympic_or_explosive: {
    pattern: "olympic_or_explosive",
    keywords: ["clean", "snatch", "jerk", "power clean", "hang clean", "high pull", "jump", "box jump", "broad jump"],
    priority: 100,
    rationale: "Explosive olympic and plyometric movements.",
  },
  lunge_unilateral: {
    pattern: "lunge_unilateral",
    keywords: ["lunge", "step-up", "step up", "single leg", "split squat", "bulgarian", "skater"],
    priority: 90,
    rationale: "Unilateral lower-body work. Split squats live here, not in squat_pattern.",
  },
  horizontal_pull: {
    pattern: "horizontal_pull",
    keywords: ["row", "barbell row", "db row", "dumbbell row", "seated row", "cable row", "chest supported row", "t-bar"],
    priority: 80,
    rationale: "Horizontal pulling movements.",
  },
  horizontal_push: {
    pattern: "horizontal_push",
    keywords: ["bench press", "bench", "push-up", "pushup", "push up", "dip", "db press flat", "incline press", "decline press"],
    priority: 80,
    rationale: "Horizontal pushing movements.",
  },
  vertical_pull: {
    pattern: "vertical_pull",
    keywords: ["pull-up", "pullup", "pull up", "chin-up", "chinup", "lat pulldown", "pulldown", "neutral grip pulldown"],
    priority: 75,
    rationale: "Vertical pulling movements.",
  },
  vertical_push: {
    pattern: "vertical_push",
    keywords: ["overhead press", "ohp", "shoulder press", "military press", "push press", "jerk press"],
    priority: 75,
    rationale: "Vertical pushing movements.",
  },
  hinge_pattern: {
    pattern: "hinge_pattern",
    keywords: ["deadlift", "rdl", "romanian deadlift", "good morning", "hip thrust", "glute bridge", "hyper", "back extension"],
    priority: 70,
    rationale: "Hip-hinge dominant movements.",
  },
  squat_pattern: {
    pattern: "squat_pattern",
    keywords: ["squat", "hack squat", "front squat", "goblet squat", "leg press"],
    priority: 60,
    rationale: "Bilateral squat-pattern movements. Lower priority so split squats route to unilateral first.",
  },
  carry_or_loaded: {
    pattern: "carry_or_loaded",
    keywords: ["farmer", "carry", "suitcase", "yoke", "sled push", "sled drag", "prowler"],
    priority: 50,
    rationale: "Loaded carries and sled work.",
  },
  core_anti_rotation: {
    pattern: "core_anti_rotation",
    keywords: ["pallof", "anti-rotation", "side plank", "deadbug", "dead bug", "bird dog", "plank", "hollow"],
    priority: 50,
    rationale: "Core anti-rotation and stabilization.",
  },
  isolation_or_accessory: {
    pattern: "isolation_or_accessory",
    keywords: ["curl", "tricep", "extension", "fly", "raise", "pulldown rope", "kickback", "calf"],
    priority: 40,
    rationale: "Isolation and accessory movements.",
  },
  conditioning: {
    pattern: "conditioning",
    keywords: ["row erg", "bike", "assault", "echo", "treadmill", "ski erg", "burpee", "shuttle"],
    priority: 30,
    rationale: "Conditioning and metabolic work.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// BLOCK CONTEXTS — season / phase categories
// ═══════════════════════════════════════════════════════════════════

export type BlockContextEntry = {
  context: string;
  matchKeywords: string[];   // keywords that infer this context from athlete metadata
  rationale: string;
};

export const FOUNDING_BLOCK_CONTEXTS: Record<string, BlockContextEntry> = {
  off_season: {
    context: "off_season",
    matchKeywords: ["off-season", "off season", "offseason", "base", "base building"],
    rationale: "Longest runway; foundational work.",
  },
  in_season: {
    context: "in_season",
    matchKeywords: ["in-season", "in season", "competitive", "competitive season"],
    rationale: "Maintenance during competition.",
  },
  pre_camp: {
    context: "pre_camp",
    matchKeywords: ["pre-camp", "pre camp", "precamp", "camp prep", "training camp", "pre-season"],
    rationale: "Ramping into camp or competition prep.",
  },
  peaking: {
    context: "peaking",
    matchKeywords: ["peak", "peaking", "taper"],
    rationale: "Peaking for an event.",
  },
  deload: {
    context: "deload",
    matchKeywords: ["deload", "deloading", "down week", "recovery week"],
    rationale: "Intentional deload week.",
  },
  transition: {
    context: "transition",
    matchKeywords: ["transition", "post-season", "decompression"],
    rationale: "Post-season decompression.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// FATIGUE / DELOAD SIGNALS
// SIGNALS ONLY. Aurelius does NOT decide deloads. Cole does. These are
// the markers Aurelius watches for and surfaces — what they MEAN is
// Cole's call.
// ═══════════════════════════════════════════════════════════════════

export type FatigueSignalEntry = {
  signal: string;
  description: string;
  thresholdValue?: number;     // numeric threshold where applicable
  thresholdUnit?: string;      // "percent" | "weeks" | "rpe_points" | etc.
  rationale: string;
};

export const FOUNDING_FATIGUE_SIGNALS: Record<string, FatigueSignalEntry> = {
  weekly_tonnage_spike: {
    signal: "weekly_tonnage_spike",
    description: "Week-over-week tonnage increase that may indicate cumulative load",
    thresholdValue: 10,
    thresholdUnit: "percent",
    rationale: "Cole watches for sustained 10%+ tonnage jumps as a fatigue marker. Surface only.",
  },
  rpe_drift_at_constant_load: {
    signal: "rpe_drift_at_constant_load",
    description: "RPE creeping up on the same loads session-over-session",
    thresholdValue: 1,
    thresholdUnit: "rpe_points",
    rationale: "If RPE rises 1+ point at the same loads, athlete may be accumulating fatigue.",
  },
  consecutive_high_volume_weeks: {
    signal: "consecutive_high_volume_weeks",
    description: "Number of consecutive weeks above an athlete's typical volume baseline",
    thresholdValue: 3,
    thresholdUnit: "weeks",
    rationale: "After 3+ weeks above baseline, deload window may be approaching. Cole judges.",
  },
  bar_speed_drop: {
    signal: "bar_speed_drop",
    description: "Reported or perceived drop in bar speed at submaximal loads",
    rationale: "Subjective signal — Cole may flag if athlete reports it. No numeric threshold yet.",
  },
  athlete_subjective_report: {
    signal: "athlete_subjective_report",
    description: "Athlete reports of unusual fatigue, soreness, or recovery struggle",
    rationale: "Always surfaces. Athlete-reported context that Cole interprets.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// COMBINED EXPORT — used by Block 3's seeder to bootstrap the DB
// ═══════════════════════════════════════════════════════════════════

export type FoundingDefaultsBundle = {
  scope: string;
  entries: Record<string, any>;
};

export const FOUNDING_DEFAULTS: FoundingDefaultsBundle[] = [
  { scope: "rep_bands", entries: FOUNDING_REP_BANDS },
  { scope: "rep_patterns", entries: FOUNDING_REP_PATTERNS },
  { scope: "intensity_zones", entries: FOUNDING_INTENSITY_ZONES },
  { scope: "movement_patterns", entries: FOUNDING_MOVEMENT_PATTERNS },
  { scope: "block_contexts", entries: FOUNDING_BLOCK_CONTEXTS },
  { scope: "fatigue_signals", entries: FOUNDING_FATIGUE_SIGNALS },
];