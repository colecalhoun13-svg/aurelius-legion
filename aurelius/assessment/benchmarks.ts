// aurelius/assessment/benchmarks.ts
//
// "THE STANDARD" — the assessment that is also the lead magnet.
//
// Cole's proven hook is a dichotomy that names the reader's mistake: training
// like a bodybuilder (aesthetics) is not training like an athlete (athletics).
// This turns that hook into a two-minute self-assessment: an athlete enters a
// few honest numbers and gets told, plainly, where they stand against the
// athletic standard — and where the gap is. It is the value that earns the
// email, delivered before the ask.
//
// EVERYTHING HERE IS STATIC AND PURE. No model runs in the hot path: a landing
// page that waits on an LLM (or bills for one on every bot hit) is a landing
// page that fails. The bands below are provisional defaults — deliberately
// conservative, general-athlete numbers — and are meant to be replaced with
// Cole's real per-sport bands (the [CFG] the checklist names). They are honest
// about being a standard, never a guarantee.

export type StandardInput = {
  sport?: string;
  bodyweightLbs?: number;
  squatLbs?: number; // best full squat, one rep
  verticalInches?: number; // standing/approach vertical
  gradYear?: number;
};

type Band = "below" | "approaching" | "at" | "above";

// Per-sport standard thresholds. Default covers "general athlete"; a handful of
// sports skew the emphasis (a lineman needs strength, a guard needs hops). These
// are STARTING numbers, not gospel — see the header.
type SportStandard = { relSquat: [number, number, number]; vertical: [number, number, number] };
const DEFAULT_STANDARD: SportStandard = { relSquat: [1.0, 1.5, 2.0], vertical: [18, 24, 30] };
const BENCHMARKS: Record<string, SportStandard> = {
  basketball: { relSquat: [1.0, 1.4, 1.8], vertical: [22, 28, 34] },
  volleyball: { relSquat: [1.0, 1.4, 1.8], vertical: [20, 26, 32] },
  football: { relSquat: [1.2, 1.7, 2.2], vertical: [20, 26, 32] },
  soccer: { relSquat: [1.0, 1.5, 2.0], vertical: [18, 24, 30] },
  baseball: { relSquat: [1.0, 1.4, 1.8], vertical: [18, 24, 30] },
  track: { relSquat: [1.1, 1.6, 2.1], vertical: [22, 28, 34] },
  wrestling: { relSquat: [1.3, 1.8, 2.3], vertical: [18, 24, 30] },
  hockey: { relSquat: [1.1, 1.6, 2.1], vertical: [20, 26, 32] },
};

function normalizeSport(sport?: string): { key: string; std: SportStandard } {
  const s = (sport ?? "").trim().toLowerCase();
  for (const key of Object.keys(BENCHMARKS)) if (s.includes(key)) return { key, std: BENCHMARKS[key]! };
  return { key: "general", std: DEFAULT_STANDARD };
}

function band(value: number, [lo, mid, hi]: [number, number, number]): Band {
  if (value >= hi) return "above";
  if (value >= mid) return "at";
  if (value >= lo) return "approaching";
  return "below";
}

const RANK: Record<Band, number> = { below: 0, approaching: 1, at: 2, above: 3 };

export type StandardResult = {
  sport: string;
  overall: Band;
  headline: string; // the dichotomy hook, in Cole's voice
  metrics: Array<{ label: string; value: string; band: Band; line: string }>;
  cta: string;
  provisional: true; // always — these bands are defaults until Cole sets his
};

/**
 * Pure: numbers in, a standard card out. Missing numbers are simply skipped —
 * an athlete who only knows their squat still gets a squat verdict. With no
 * usable number at all, it says so rather than inventing a grade.
 */
export function assessStandard(input: StandardInput): StandardResult {
  const { key, std } = normalizeSport(input.sport);
  const sportLabel = key === "general" ? "your sport" : key;
  const metrics: StandardResult["metrics"] = [];

  const bw = num(input.bodyweightLbs);
  const squat = num(input.squatLbs);
  const vertical = num(input.verticalInches);

  let relBand: Band | null = null;
  if (bw && squat && bw > 0) {
    const rel = squat / bw;
    relBand = band(rel, std.relSquat);
    metrics.push({
      label: "Relative strength (squat ÷ bodyweight)",
      value: `${rel.toFixed(2)}×`,
      band: relBand,
      line:
        relBand === "above"
          ? `You move serious weight for your size — ${rel.toFixed(2)}× bodyweight is past the standard.`
          : relBand === "at"
            ? `${rel.toFixed(2)}× bodyweight clears the bar. Strength isn't what's holding you back.`
            : relBand === "approaching"
              ? `${rel.toFixed(2)}× bodyweight is on the way, not there. The standard for ${sportLabel} is ${std.relSquat[1]}×.`
              : `${rel.toFixed(2)}× bodyweight is under the standard (${std.relSquat[1]}×). This is the first number to move.`,
    });
  }

  let vertBand: Band | null = null;
  if (vertical) {
    vertBand = band(vertical, std.vertical);
    metrics.push({
      label: "Vertical jump",
      value: `${vertical}"`,
      band: vertBand,
      line:
        vertBand === "above"
          ? `A ${vertical}" vertical is explosive — you turn strength into speed.`
          : vertBand === "at"
            ? `${vertical}" clears the standard for ${sportLabel}. That's an athletic number.`
            : vertBand === "approaching"
              ? `${vertical}" is close. The standard is ${std.vertical[1]}" — that gap is trainable fast.`
              : `${vertical}" is under the ${std.vertical[1]}" standard. Power, not muscle, is the missing piece.`,
    });
  }

  // The dichotomy hook — the thing that names the mistake. Strong-but-can't-jump
  // is the exact "you trained like a bodybuilder, not an athlete" story.
  let headline: string;
  if (relBand && vertBand) {
    if (RANK[relBand] >= 2 && RANK[vertBand] <= 1) {
      headline =
        "You've built a gym number, not an athletic one. Strong in the rack, slow off the floor — that's training like a bodybuilder, not an athlete. The strength is done; now it has to move.";
    } else if (RANK[relBand] <= 1 && RANK[vertBand] >= 2) {
      headline =
        "You're springy but under-built. The explosiveness is there — put real strength under it and the vertical goes up with it.";
    } else if (RANK[relBand] >= 2 && RANK[vertBand] >= 2) {
      headline =
        "You already move like an athlete. Strength and power both clear the bar — the ceiling now is skill, speed and staying healthy, not more grinding.";
    } else {
      headline =
        "There's a standard, and right now you're under it — in both strength and power. That's not an insult, it's the work. It's also completely trainable.";
    }
  } else if (metrics.length > 0) {
    headline = "Here's where you stand against the athletic standard — and the honest gap to close.";
  } else {
    headline = "Give me two or three honest numbers and I'll tell you exactly where you stand against the standard.";
  }

  const overall: Band =
    metrics.length === 0
      ? "below"
      : (["below", "approaching", "at", "above"] as Band[])[
          Math.round(metrics.reduce((s, m) => s + RANK[m.band], 0) / metrics.length)
        ]!;

  return {
    sport: sportLabel,
    overall,
    headline,
    metrics,
    cta:
      metrics.length === 0
        ? "Enter your numbers to see your standard."
        : overall === "above"
          ? "You're ahead of most. If you want to train like it's your job, Cole builds the program — leave your email."
          : "Cole coaches athletes to close exactly this gap. Want the full breakdown and a plan? Leave your email.",
    provisional: true,
  };
}

function num(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** A compact one-line summary of the numbers, for the lead's notes. */
export function summarizeStandard(input: StandardInput, result: StandardResult): string {
  const bits = [
    input.sport ? `sport ${input.sport}` : null,
    input.bodyweightLbs ? `bw ${input.bodyweightLbs}` : null,
    input.squatLbs ? `squat ${input.squatLbs}` : null,
    input.verticalInches ? `vert ${input.verticalInches}"` : null,
    input.gradYear ? `class ${input.gradYear}` : null,
  ].filter(Boolean);
  return `Took The Standard (${result.overall} vs standard): ${bits.join(", ")}`;
}
