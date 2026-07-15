// aurelius/learning/curriculum.ts
//
// THE CURRICULUM — auto-learning the canon AND the subject matter of every field,
// and GROWING both.
//
// Each operator studies two kinds of unit, interleaved:
//   • WORKS   — the foundational + modern literature (strategy: Sun Tzu, Musashi;
//               training: the Soviet school + modern coaches; wealth: Buffett,
//               Taleb; identity: the Stoics).
//   • TOPICS  — the actual concepts, mechanisms, and debates OF the field itself
//               (training: hypertrophy mechanisms, the fitness-fatigue model,
//               periodization theory; strategy: game theory, second-order thinking;
//               wealth: compounding, risk of ruin, valuation). So Aurelius doesn't
//               just read a book list — it learns the field.
//
// A GAP-DRIVEN self-expansion engine keeps it growing: it starts from the seed,
// and as a field runs low it looks at what it has ACTUALLY studied and ingested,
// assesses its own gaps (missing works AND uncovered concepts/debates), and queues
// those to fill. Every Sunday night it studies the next unit for each field: deep
// research (LLM + open academic sources) → four-write ingest into the second brain
// (domain-tagged) → refresh the field's living wiki (the synthesized understanding).
// The curriculum is not a separate store — it is the ENGINE that fills the second
// brain and the wiki. The only state it keeps is a per-domain cursor + gap queue.
//
// Safety/consistency: INWARD auto-ingestion (like RSS/weekend pulse) — corpus
// documents, reversible, traced. NOT Living Knowledge (still propose→confirm).
// Honest failure: no LLM engine → SKIP, never file as content, cursor doesn't
// advance. Cursor/queue live under scope="system" (never embedded, never recalled).

import { prisma } from "../core/db/prisma.ts";
import { resolveOperatorId } from "../knowledge/store.ts";
import { runResearch } from "../research/researchEngine.ts";
import { runLLM } from "../llm/runLLM.ts";
import { ingestDocument } from "../corpus/ingest.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { surfaceSignal } from "../core/bridge.ts";

export type Unit = { title: string; query: string };
type Track = { operator: string; domain: string; label: string; canon: Unit[] };

// One adaptive study frame that fits BOTH a work and a topic: extract a work's
// framework, or explain a concept's mechanisms/debates — then always translate
// into concrete decision heuristics for Cole's life.
function learnQuery(subject: string, field: string): string {
  return (
    `Develop a deep, current, practitioner-grade understanding of "${subject}" within ${field}. ` +
    `If it is a specific work or author, extract its core framework and durable principles. ` +
    `If it is a concept, method, mechanism, or sub-field, explain how it actually works, the major ` +
    `schools of thought and live debates, and the best current practice. Then translate it into concrete ` +
    `decision heuristics: how should this change how someone actually decides and acts? Be specific, ` +
    `structured, and honest about where it has limits. Avoid summary-for-summary's-sake.`
  );
}

const unit = (subject: string, field: string): Unit => ({ title: subject, query: learnQuery(subject, field) });

// Interleave works and topics so study alternates a book and a concept.
function interleave(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]!);
    if (i < b.length) out.push(b[i]!);
  }
  return out;
}

function track(operator: string, domain: string, label: string, field: string, works: string[], topics: string[]): Track {
  return { operator, domain, label, canon: interleave(works, topics).map((s) => unit(s, field)) };
}

// ── THE SEED CANON (works + topics) ──────────────────────────────────
export const CURRICULUM: Track[] = [
  track(
    "strategy", "strategy", "Strategy",
    "strategy: timing, positioning, leverage, and deciding under uncertainty",
    [
      "The Art of War — Sun Tzu",
      "The Book of Five Rings — Miyamoto Musashi",
      "The 48 Laws of Power — Robert Greene",
      "Mastery — Robert Greene",
      "The 33 Strategies of War — Robert Greene",
      "Good Strategy / Bad Strategy — Richard Rumelt",
      "On War — Carl von Clausewitz",
      "Strategy: The Indirect Approach — B.H. Liddell Hart",
      "Patterns of Conflict / the OODA loop — John Boyd",
      "The Prince — Niccolò Machiavelli",
      "The 36 Stratagems (Chinese classic)",
      "Thinking in Bets — Annie Duke",
      "Superforecasting — Philip Tetlock",
      "Seeking Wisdom / worldly mental models — Peter Bevelin",
    ],
    [
      "positioning and competitive advantage",
      "leverage and asymmetry",
      "second- and third-order thinking (consequences of consequences)",
      "game theory and incentives",
      "the OODA loop, tempo, and decision cycles",
      "opportunity cost and comparative advantage",
      "feedback loops and compounding effects",
      "base rates and Bayesian updating",
      "optionality, convexity, and the barbell",
      "the map vs. the territory (models and their limits)",
      "principal-agent problems and misaligned incentives",
      "first-principles reasoning",
      "red-teaming and pre-mortems",
      "moats and durable advantage",
    ],
  ),
  track(
    "training", "training", "Training",
    "strength & physique training: programming, adaptation, recovery, and technique",
    [
      "Science and Practice of Strength Training — Zatsiorsky & Kraemer",
      "Supertraining — Mel Siff & Yuri Verkhoshansky",
      "Special Strength Training: A Practical Manual for Coaches — Yuri Verkhoshansky",
      "A System of Multi-Year Training in Weightlifting — A.S. Medvedyev",
      "The Training of the Weightlifter — R.A. Roman",
      "Transfer of Training in Sports — Anatoliy Bondarchuk",
      "Block Periodization — Vladimir Issurin",
      "Fundamentals of Sports Training — Lev Matveyev",
      "Science and Development of Muscle Hypertrophy — Brad Schoenfeld",
      "The Muscle & Strength Training Pyramids — Eric Helms",
      "Scientific Principles of Strength Training — Israetel / Renaissance Periodization",
      "Stronger by Science — Greg Nuckols",
      "The Muscle Doc — Dr. Jordan Shallow",
      "Triphasic Training — Cal Dietz",
      "Westside / the conjugate method — Louie Simmons",
      "Base Strength — Alexander Bromley",
      "Zingler Strength — programming and coaching",
      "Pavel Tsatsouline — strength as a skill",
    ],
    [
      "mechanisms of muscular hypertrophy (mechanical tension, metabolic stress)",
      "strength vs. hypertrophy adaptations and how they differ",
      "the fitness-fatigue model and supercompensation",
      "periodization theory (linear, block, undulating)",
      "training volume landmarks (MEV, MAV, MRV)",
      "progressive overload — the methods and their limits",
      "autoregulation: RPE, reps-in-reserve, velocity-based training",
      "the SAID principle and specificity of adaptation",
      "muscle fiber types and recruitment",
      "energy systems and conditioning for the strength athlete",
      "biomechanics of the squat, bench, and deadlift",
      "tendon and connective-tissue adaptation to load",
      "the repeated-bout effect and managing soreness",
      "stimulus-to-fatigue ratio and exercise selection",
      "deloading: when, why, and how",
      "nutrition for muscle: protein, energy balance, timing",
      "motor learning and technical skill acquisition",
      "injury mechanisms and prehabilitation",
    ],
  ),
  track(
    "athlete", "athlete", "Athletic Performance",
    "athletic performance: recovery, expertise, psychology, and peaking",
    [
      "Why We Sleep — Matthew Walker",
      "Periodization: Theory and Methodology of Training — Tudor Bompa",
      "Flow — Mihaly Csikszentmihalyi",
      "The Sports Gene — David Epstein",
      "Peak: Secrets from the New Science of Expertise — Anders Ericsson",
      "Endure — Alex Hutchinson",
    ],
    [
      "energy systems (ATP-PC, glycolytic, oxidative)",
      "VO2max and building an aerobic base",
      "HRV, readiness, and monitoring fatigue",
      "sleep architecture and its role in recovery",
      "speed and power: rate of force development, plyometrics",
      "agility and change-of-direction mechanics",
      "flow states and arousal regulation under pressure",
      "tapering and peaking for competition",
      "hydration, fueling, and performance nutrition",
      "load management and injury-risk reduction",
      "mobility vs. stability and movement quality",
      "deliberate practice and the science of expertise",
    ],
  ),
  track(
    "wealth", "wealth", "Wealth & Investing",
    "wealth & investing: compounding, risk, behavior, and capital allocation",
    [
      "The Psychology of Money — Morgan Housel",
      "Poor Charlie's Almanack — Charlie Munger",
      "The Berkshire shareholder letters — Warren Buffett",
      "The Intelligent Investor — Benjamin Graham",
      "Antifragile — Nassim Taleb",
      "Fooled by Randomness — Nassim Taleb",
      "The Black Swan — Nassim Taleb",
      "The Little Book of Common Sense Investing — John Bogle",
      "Principles — Ray Dalio",
      "The Most Important Thing — Howard Marks",
      "Just Keep Buying — Nick Maggiulli",
      "Margin of Safety — Seth Klarman",
    ],
    [
      "compounding and the time value of money",
      "asset classes and how they behave",
      "diversification and correlation",
      "risk vs. volatility (they are not the same)",
      "position sizing, risk of ruin, and the Kelly criterion",
      "valuation basics (intrinsic value, margin of safety)",
      "the yield curve, interest rates, and inflation",
      "tax-advantaged accounts and tax efficiency",
      "dollar-cost averaging vs. lump sum",
      "market cycles and behavioral pitfalls",
      "expense drag and why fees dominate outcomes",
      "cash flow vs. net worth; liquidity and reserves",
      "withdrawal rates and financial independence math",
    ],
  ),
  track(
    "business", "business", "Business",
    "business: offers, strategy, operations, and building durable advantage",
    [
      "$100M Offers — Alex Hormozi",
      "$100M Leads — Alex Hormozi",
      "The Effective Executive — Peter Drucker",
      "Competitive Strategy / the five forces — Michael Porter",
      "The Innovator's Dilemma & Jobs to Be Done — Clayton Christensen",
      "The Lean Startup — Eric Ries",
      "Good to Great — Jim Collins",
      "Blue Ocean Strategy — Kim & Mauborgne",
      "Crossing the Chasm — Geoffrey Moore",
      "The E-Myth Revisited — Michael Gerber",
      "Zero to One — Peter Thiel",
    ],
    [
      "unit economics and contribution margin",
      "LTV, CAC, and payback period",
      "the offer and value proposition (the value equation)",
      "positioning and differentiation",
      "pricing strategy and value-based pricing",
      "sales funnels, conversion, and the buyer's journey",
      "market sizing (TAM / SAM / SOM)",
      "competitive advantage and moats",
      "operations, systems, and SOPs",
      "cash-flow management and runway",
      "hiring, delegation, and working ON the business",
      "product-market fit and how to recognize it",
      "distribution and channel strategy",
      "retention, churn, and lifetime value",
    ],
  ),
  track(
    "content", "content", "Content & Persuasion",
    "content & persuasion: attention, story, copy, and audience",
    [
      "Ogilvy on Advertising — David Ogilvy",
      "Breakthrough Advertising — Eugene Schwartz",
      "The Adweek Copywriting Handbook — Joseph Sugarman",
      "Influence — Robert Cialdini",
      "Made to Stick — Chip & Dan Heath",
      "Building a StoryBrand — Donald Miller",
      "The Hero with a Thousand Faces — Joseph Campbell",
      "Contagious: Why Things Catch On — Jonah Berger",
      "The War of Art — Steven Pressfield",
    ],
    [
      "attention and the hook (the first three seconds)",
      "market awareness and sophistication stages",
      "copywriting formulas (AIDA, PAS, the 4 Ps)",
      "narrative structure and storytelling",
      "emotional triggers and persuasion principles",
      "distribution mechanics and how algorithms surface content",
      "audience building and the 1000-true-fans idea",
      "content-market fit",
      "calls to action and reducing friction",
      "social proof and credibility",
      "platform norms and native format",
      "consistency, volume, and repurposing",
    ],
  ),
  track(
    "identity", "identity", "Identity & Purpose",
    "identity & purpose: self-governance, meaning, discipline, and becoming",
    [
      "Meditations — Marcus Aurelius",
      "Letters from a Stoic — Seneca",
      "The Enchiridion & Discourses — Epictetus",
      "Man's Search for Meaning — Viktor Frankl",
      "Atomic Habits — James Clear",
      "Ego Is the Enemy — Ryan Holiday",
      "The Obstacle Is the Way — Ryan Holiday",
      "Thus Spoke Zarathustra — Friedrich Nietzsche",
      "Can't Hurt Me — David Goggins",
      "Tao Te Ching — Lao Tzu",
    ],
    [
      "the dichotomy of control (what is and isn't up to us)",
      "amor fati and memento mori",
      "identity-based habits (becoming vs. achieving)",
      "the ego as the enemy of mastery",
      "meaning and purpose (logotherapy, ikigai)",
      "discipline vs. motivation",
      "the shadow and individuation (Jung)",
      "values clarification and living by them",
      "virtue ethics and character",
      "self-narrative and the stories we tell ourselves",
      "antifragility of the self (growth through adversity)",
      "comparison, envy, and their antidotes",
      "mortality awareness as a clarifier",
    ],
  ),
];

type State = { index: number; cycles: number; queue: Unit[]; discoveries: number };

function defaultState(): State {
  return { index: 0, cycles: 0, queue: [], discoveries: 0 };
}

// State lives under scope="system" so it is NEVER embedded into the vector index.
async function getState(operatorId: string, domain: string): Promise<State> {
  const row = await prisma.knowledgeEntry.findUnique({
    where: { operatorId_scope_key: { operatorId, scope: "system", key: `curriculum:${domain}` } },
  });
  const v = (row?.value as any) ?? {};
  return {
    index: typeof v.index === "number" ? v.index : 0,
    cycles: typeof v.cycles === "number" ? v.cycles : 0,
    queue: Array.isArray(v.queue) ? (v.queue as Unit[]) : [],
    discoveries: typeof v.discoveries === "number" ? v.discoveries : 0,
  };
}

async function setState(operatorId: string, domain: string, state: State): Promise<void> {
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId, scope: "system", key: `curriculum:${domain}` } },
    update: { value: state as any, updatedBy: "curriculum" },
    create: {
      operatorId,
      scope: "system",
      key: `curriculum:${domain}`,
      value: state as any,
      sourceType: "curriculum_cursor",
      createdBy: "system",
    },
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Parse an LLM discovery response into new study units (works OR topics), deduped
 * against what's already on the list. PURE (no I/O) so it's unit-testable.
 */
export function parseDiscoveries(text: string, field: string, existing: Unit[]): Unit[] {
  const knownNorms = existing.map((u) => norm(u.title));
  const out: Unit[] = [];
  const seen = new Set<string>();
  for (const rawLine of (text ?? "").split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    line = line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim();
    const title = line.split(/\s+[—–\-:]\s+/)[0]!.trim().replace(/^["'“]|["'”]$/g, "");
    if (!title || title.length < 3 || title.length > 140) continue;
    const n = norm(title);
    if (!n || seen.has(n)) continue;
    if (knownNorms.some((k) => k === n || k.includes(n) || n.includes(k))) continue;
    seen.add(n);
    out.push(unit(title, field));
  }
  return out;
}

const EXPAND_WHEN_REMAINING = 4;
const MAX_DISCOVERIES_PER_EXPAND = 12;
const MAX_QUEUE = 400;

/**
 * GAP-DRIVEN self-expansion. Rather than blindly appending "more of the field,"
 * this grounds the search in what Aurelius has ACTUALLY studied and ingested for
 * the domain (its real corpus coverage), then asks: given this, what are my
 * biggest remaining gaps — the works, authors, schools, and core concepts/
 * mechanisms/debates that would most increase real mastery? It queues those.
 * This is the metacognition Cole asked for: start from the seed, then see its own
 * gaps and research to fill them. Returns [] on any failure (keyless included).
 */
async function fillKnowledgeGaps(track: Track, planned: Unit[]): Promise<Unit[]> {
  // What has this field ACTUALLY ingested? (the studied units, most recent first)
  let coveredTitles: string[] = [];
  try {
    const docs = await prisma.corpusDocument.findMany({
      where: { domain: track.domain },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    coveredTitles = docs.map((d) => d.title.replace(/^Curriculum · [^:]+:\s*/, "").trim());
  } catch {
    /* corpus read failed — fall back to the planned list only */
  }
  const covered = coveredTitles.slice(0, 160).join("; ") || "(nothing studied yet)";
  const onDeck = planned.map((u) => u.title).slice(-80).join("; ");

  const prompt =
    `You are directing self-education to become DEEPLY versed in ${track.label} — its literature AND its actual ` +
    `subject matter. Here is what has already been STUDIED and ingested:\n${covered}\n\n` +
    (onDeck ? `Already planned (don't repeat): ${onDeck}\n\n` : "") +
    `Assess the coverage honestly and identify the most important GAPS: essential works/authors/schools that are ` +
    `missing (including foundational classics, the Soviet/Eastern-bloc and international traditions where relevant, ` +
    `and the strongest current thinkers), AND core concepts, mechanisms, or live debates of the field that are ` +
    `absent or under-covered. Rank by how much each would increase real mastery. ` +
    `Return the top ${MAX_DISCOVERIES_PER_EXPAND} as ONE per line: "Work, author, or topic — why it's a gap". ` +
    `No preamble, no numbering, nothing else.`;

  let text = "";
  try {
    const r = await runLLM({ taskType: "curriculum_gap_analysis", operator: track.operator, input: prompt });
    text = r?.text ?? "";
  } catch {
    return [];
  }
  if (!text || engineUnavailableText(text)) return [];
  // Dedup against BOTH the planned list and what's already been ingested.
  const against: Unit[] = [...planned, ...coveredTitles.map((t) => ({ title: t, query: "" }))];
  return parseDiscoveries(text, track.label, against).slice(0, MAX_DISCOVERIES_PER_EXPAND);
}

const UNITS_PER_DOMAIN_PER_WEEK = 1;
const MAX_UNITS_PER_RUN = 8;

export type CurriculumResult = {
  ok: boolean;
  studied: { domain: string; title: string }[];
  skipped: { domain: string; title: string; reason: string }[];
  discovered: { domain: string; count: number }[];
  error?: string;
};

/**
 * Study the next curriculum unit for each field (or one, for testing), expanding
 * the list first when a field runs low. Sequential — one deep run at a time.
 */
export async function runCurriculumIngest(opts?: {
  onlyDomain?: string;
  maxUnits?: number;
}): Promise<CurriculumResult> {
  const globalId = await resolveOperatorId("global");
  if (!globalId) return { ok: false, studied: [], skipped: [], discovered: [], error: "no global operator" };

  const tracks = opts?.onlyDomain ? CURRICULUM.filter((t) => t.domain === opts.onlyDomain) : CURRICULUM;
  const cap = opts?.maxUnits ?? MAX_UNITS_PER_RUN;

  const studied: { domain: string; title: string }[] = [];
  const skipped: { domain: string; title: string; reason: string }[] = [];
  const discovered: { domain: string; count: number }[] = [];
  const touched = new Set<string>();
  let count = 0;

  for (const trk of tracks) {
    if (count >= cap) break;
    for (let u = 0; u < UNITS_PER_DOMAIN_PER_WEEK && count < cap; u++) {
      let state = await getState(globalId, trk.domain);
      let list = [...trk.canon, ...state.queue];

      if (list.length - state.index <= EXPAND_WHEN_REMAINING && state.queue.length < MAX_QUEUE) {
        const added = await fillKnowledgeGaps(trk, list);
        if (added.length > 0) {
          state = { ...state, queue: [...state.queue, ...added].slice(0, MAX_QUEUE), discoveries: state.discoveries + 1 };
          await setState(globalId, trk.domain, state);
          list = [...trk.canon, ...state.queue];
          discovered.push({ domain: trk.domain, count: added.length });
        }
      }

      const done = state.index >= list.length;
      const studyUnit: Unit = done
        ? {
            title: `Staying current — ${trk.label} (cycle ${state.cycles + 1})`,
            query:
              `What are the most important recent developments, refinements, or debates in ${trk.label} ` +
              `that a serious practitioner should absorb now? Focus on what has genuinely changed or sharpened, ` +
              `and connect it to how it should change real decisions. Be specific and actionable.`,
          }
        : list[state.index]!;

      try {
        const res = await runResearch({ query: studyUnit.query, operator: trk.operator, depth: "deep" });
        const body = [res.synthesis, ...(res.insights ?? [])].filter(Boolean).join("\n\n");

        if (!body || body.trim().length < 80 || engineUnavailableText(body) || engineUnavailableText(res.synthesis ?? "")) {
          skipped.push({ domain: trk.domain, title: studyUnit.title, reason: "no research engine / empty synthesis" });
          continue;
        }

        await ingestDocument({
          title: `Curriculum · ${trk.label}: ${studyUnit.title}`,
          content: `# ${studyUnit.title}\n\n${body}`,
          sourceType: "research",
          domain: trk.domain,
          operatorName: trk.operator,
          triggeredBy: "self_directed",
          dedupKey: `curriculum:${trk.domain}:${done ? `maint:${state.cycles}` : `idx:${state.index}`}`,
        });

        studied.push({ domain: trk.domain, title: studyUnit.title });
        touched.add(trk.domain);
        count++;
        await setState(globalId, trk.domain, done ? { ...state, cycles: state.cycles + 1 } : { ...state, index: state.index + 1 });
      } catch (err: any) {
        skipped.push({ domain: trk.domain, title: studyUnit.title, reason: err?.message ?? String(err) });
      }
    }
  }

  if (touched.size > 0) {
    try {
      const { synthesizeWikiPage } = await import("../wiki/engine.ts");
      for (const d of touched) {
        try {
          await synthesizeWikiPage(d, "curriculum");
        } catch (err) {
          console.warn(`[curriculum] wiki refresh failed for ${d}:`, (err as any)?.message ?? err);
        }
      }
    } catch { /* wiki engine unavailable — the reading is still ingested */ }
  }

  if (studied.length > 0) {
    try {
      await surfaceSignal({
        kind: "background_result",
        domain: "personal",
        sourceType: "curriculum",
        severity: "info",
        title: `Studied ${studied.length} unit${studied.length === 1 ? "" : "s"} this week`,
        body:
          studied.map((s) => `• ${labelFor(s.domain)}: ${s.title}`).join("\n") +
          (discovered.length ? `\n\n(+${discovered.reduce((n, d) => n + d.count, 0)} new works/topics added to the plan.)` : "") +
          `\n\nAbsorbed into the second brain and each field's wiki — grounding future decisions.`,
      });
    } catch (err) {
      console.warn("[curriculum] summary signal failed:", (err as any)?.message ?? err);
    }
  }

  console.log(
    `[curriculum] studied ${studied.length}, skipped ${skipped.length}, discovered ${discovered.reduce((n, d) => n + d.count, 0)}`
  );
  return { ok: true, studied, skipped, discovered };
}

function labelFor(domain: string): string {
  return CURRICULUM.find((t) => t.domain === domain)?.label ?? domain;
}

/** How far through each field's (seed + discovered) plan Aurelius has studied. */
export async function getCurriculumProgress(): Promise<
  { domain: string; label: string; read: number; total: number; discovered: number; cycles: number }[]
> {
  const globalId = await resolveOperatorId("global");
  const out: { domain: string; label: string; read: number; total: number; discovered: number; cycles: number }[] = [];
  for (const trk of CURRICULUM) {
    const state = globalId ? await getState(globalId, trk.domain) : defaultState();
    const total = trk.canon.length + state.queue.length;
    out.push({
      domain: trk.domain,
      label: trk.label,
      read: Math.min(state.index, total),
      total,
      discovered: state.queue.length,
      cycles: state.cycles,
    });
  }
  return out;
}
