// aurelius/learning/curriculum.ts
//
// THE CURRICULUM — auto-learning the canon of every field, and GROWING it.
//
// Two halves:
//   1. A large SEED CANON per operator — the foundational + modern literature of
//      its field (strategy: Sun Tzu, Musashi, …; training: the Soviet school,
//      Zatsiorsky, Verkhoshansky, plus modern coaches like Israetel, Nuckols,
//      Jordan Shallow; wealth: Buffett, Munger, Taleb; identity: the Stoics).
//   2. A SELF-EXPANSION engine — as Aurelius nears the end of a field's list, it
//      RESEARCHES what else a serious practitioner should read (classics it's
//      missing, the Eastern-bloc/international traditions, and the best current
//      thinkers) and APPENDS those works to a persistent per-domain queue. So the
//      reading list is never a fixed ceiling: it keeps growing ahead of the
//      cursor, the way a scholar's does. When even the discovery pass runs dry it
//      shifts to "stay current" (recent developments).
//
// Every Sunday night it studies the next unit for each field: deep research
// (LLM + open academic sources) → four-write ingest into the second brain
// (domain-tagged) → refresh the field's living wiki. A per-domain cursor advances
// so nothing is re-read.
//
// Safety/consistency: INWARD auto-ingestion into the brain (like RSS/weekend
// pulse) — corpus documents, reversible, traced. It does NOT write Living
// Knowledge (persona/facts), which still goes through propose→confirm. Honest
// failure (hard rule 3): no LLM engine → the unit is SKIPPED, never filed as
// content, and the cursor does NOT advance. The cursor/queue live under
// scope="system" (never embedded, never in recall).

import { prisma } from "../core/db/prisma.ts";
import { resolveOperatorId } from "../knowledge/store.ts";
import { runResearch } from "../research/researchEngine.ts";
import { runLLM } from "../llm/runLLM.ts";
import { ingestDocument } from "../corpus/ingest.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { surfaceSignal } from "../core/bridge.ts";

export type Unit = { title: string; query: string };
type Track = { operator: string; domain: string; label: string; canon: Unit[] };

// One shared prompt frame so every synthesis is grounded AND applied to Cole's
// life, not an abstract book report.
function studyQuery(work: string, field: string): string {
  return (
    `Study "${work}". Extract its core framework and the specific, durable principles a serious ` +
    `practitioner should internalize. Then translate them into concrete decision heuristics for ` +
    `${field}: how would these ideas change how someone actually decides and acts? Be specific, ` +
    `structured, and honest about where the ideas have limits. Avoid summary-for-summary's-sake.`
  );
}

function unit(work: string, field: string): Unit {
  return { title: work, query: studyQuery(work, field) };
}

// ── THE SEED CANON ───────────────────────────────────────────────────
// Ordered, deep, but NOT a ceiling — the self-expansion engine grows each list.
export const CURRICULUM: Track[] = [
  {
    operator: "strategy",
    domain: "strategy",
    label: "Strategy",
    canon: [
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
      "Hagakure — Yamamoto Tsunetomo",
      "The Art of Worldly Wisdom — Baltasar Gracián",
      "Thinking in Bets — Annie Duke",
      "Superforecasting — Philip Tetlock",
      "The Prize / grand strategy & geopolitics",
      "Naval Ravikant — leverage, specific knowledge, judgment",
      "Seeking Wisdom / worldly mental models — Peter Bevelin",
    ].map((w) => unit(w, "strategy: timing, positioning, leverage, and deciding under uncertainty")),
  },
  {
    operator: "training",
    domain: "training",
    label: "Training",
    canon: [
      // The Soviet / Eastern-bloc school
      "Science and Practice of Strength Training — Zatsiorsky & Kraemer",
      "Supertraining — Mel Siff & Yuri Verkhoshansky",
      "Special Strength Training: A Practical Manual for Coaches — Yuri Verkhoshansky",
      "Fundamentals of Special Strength Training in Sport — Verkhoshansky",
      "A System of Multi-Year Training in Weightlifting — A.S. Medvedyev",
      "The Training of the Weightlifter — R.A. Roman",
      "Transfer of Training in Sports — Anatoliy Bondarchuk",
      "Block Periodization — Vladimir Issurin",
      "Fundamentals of Sports Training — Lev Matveyev",
      "Managing the Training of Weightlifters — Laputin & Oleshko",
      // Modern strength & hypertrophy science
      "Science and Development of Muscle Hypertrophy — Brad Schoenfeld",
      "The Muscle & Strength Training Pyramids — Eric Helms",
      "Scientific Principles of Strength Training — Mike Israetel / Renaissance Periodization",
      "Stronger by Science (volume, intensity, frequency) — Greg Nuckols",
      "The Muscle Doc — Dr. Jordan Shallow (biomechanics, pre-hab, resilient lifting)",
      "Triphasic Training — Cal Dietz",
      "The Juggernaut Method / powerlifting programming — Chad Wesley Smith",
      "Base Strength / Peak Strength — Alexander Bromley",
      "Westside / the conjugate method — Louie Simmons",
      "Practical Programming for Strength Training — Rippetoe & Baker",
      "Periodization models: linear, block, and daily undulating (DUP)",
      "Autoregulation: RPE and reps-in-reserve (RIR)",
      "Prilepin's chart and intensity/volume management",
      "Tendon and connective-tissue adaptation to loading",
      "Pavel Tsatsouline — strength as a skill, greasing the groove",
      "Christian Thibaudeau — neurotyping and advanced hypertrophy methods",
    ].map((w) => unit(w, "strength & physique training: programming, adaptation, recovery, and technique")),
  },
  {
    operator: "athlete",
    domain: "athlete",
    label: "Athletic Performance",
    canon: [
      "Why We Sleep — Matthew Walker",
      "Periodization: Theory and Methodology of Training — Tudor Bompa",
      "Flow — Mihaly Csikszentmihalyi",
      "The Sports Gene — David Epstein",
      "Peak: Secrets from the New Science of Expertise — Anders Ericsson",
      "Endure — Alex Hutchinson (the limits of performance)",
      "recovery science: HRV, monitoring fatigue, and deloading",
      "speed & power development: rate of force development, plyometrics",
      "movement & mobility: the Kelly Starrett / FRC approaches",
      "sport psychology & mental toughness under pressure",
      "peaking and tapering for competition",
      "return-to-play and injury-prevention frameworks",
    ].map((w) => unit(w, "athletic performance: recovery, expertise, psychology, and peaking")),
  },
  {
    operator: "wealth",
    domain: "wealth",
    label: "Wealth & Investing",
    canon: [
      "The Psychology of Money — Morgan Housel",
      "Poor Charlie's Almanack (mental models) — Charlie Munger",
      "The Berkshire Hathaway shareholder letters — Warren Buffett",
      "The Intelligent Investor — Benjamin Graham",
      "Antifragile — Nassim Taleb",
      "Fooled by Randomness — Nassim Taleb",
      "The Black Swan — Nassim Taleb",
      "Skin in the Game — Nassim Taleb",
      "The Little Book of Common Sense Investing — John Bogle",
      "Principles — Ray Dalio",
      "The Most Important Thing — Howard Marks",
      "Just Keep Buying — Nick Maggiulli",
      "The Millionaire Next Door — Stanley & Danko",
      "Margin of Safety — Seth Klarman",
      "risk of ruin, position sizing, and the Kelly criterion",
      "compounding, time value, and the mathematics of wealth",
    ].map((w) => unit(w, "wealth & investing: compounding, risk, behavior, and capital allocation")),
  },
  {
    operator: "business",
    domain: "business",
    label: "Business",
    canon: [
      "$100M Offers — Alex Hormozi",
      "$100M Leads — Alex Hormozi",
      "The Effective Executive — Peter Drucker",
      "Management (essentials) — Peter Drucker",
      "Competitive Strategy / the five forces — Michael Porter",
      "The Innovator's Dilemma & Jobs to Be Done — Clayton Christensen",
      "The Lean Startup — Eric Ries",
      "Good to Great — Jim Collins",
      "Built to Last — Collins & Porras",
      "Blue Ocean Strategy — Kim & Mauborgne",
      "Crossing the Chasm — Geoffrey Moore",
      "The E-Myth Revisited (systems & SOPs) — Michael Gerber",
      "Zero to One — Peter Thiel",
      "The Hard Thing About Hard Things — Ben Horowitz",
      "Traction / EOS — Gino Wickman",
      "Purple Cow / remarkable marketing — Seth Godin",
    ].map((w) => unit(w, "business: offers, strategy, operations, and building durable advantage")),
  },
  {
    operator: "content",
    domain: "content",
    label: "Content & Persuasion",
    canon: [
      "Ogilvy on Advertising — David Ogilvy",
      "Breakthrough Advertising — Eugene Schwartz",
      "The Adweek Copywriting Handbook — Joseph Sugarman",
      "Influence — Robert Cialdini",
      "Made to Stick — Chip & Dan Heath",
      "Building a StoryBrand — Donald Miller",
      "The Hero with a Thousand Faces — Joseph Campbell",
      "Contagious: Why Things Catch On — Jonah Berger",
      "Everybody Writes — Ann Handley",
      "The War of Art — Steven Pressfield",
      "short-form video: hooks, retention, and platform mechanics",
      "the psychology of attention and the first three seconds",
      "Gary Vaynerchuk — jab, jab, jab, right hook (give before ask)",
    ].map((w) => unit(w, "content & persuasion: attention, story, copy, and audience")),
  },
  {
    operator: "identity",
    domain: "identity",
    label: "Identity & Purpose",
    canon: [
      "Meditations — Marcus Aurelius",
      "Letters from a Stoic — Seneca",
      "The Enchiridion & Discourses — Epictetus",
      "Man's Search for Meaning — Viktor Frankl",
      "Atomic Habits (identity-based habits) — James Clear",
      "Ego Is the Enemy — Ryan Holiday",
      "The Obstacle Is the Way — Ryan Holiday",
      "individuation and the shadow — Carl Jung",
      "Thus Spoke Zarathustra / amor fati — Friedrich Nietzsche",
      "The Way of the Superior Man — David Deida",
      "Can't Hurt Me — David Goggins",
      "Ikigai and the search for purpose",
      "Tao Te Ching — Lao Tzu",
    ].map((w) => unit(w, "identity & purpose: self-governance, meaning, discipline, and becoming")),
  },
];

type State = { index: number; cycles: number; queue: Unit[]; discoveries: number };

function defaultState(): State {
  return { index: 0, cycles: 0, queue: [], discoveries: 0 };
}

// State lives under scope="system" so it is NEVER embedded into the vector index
// (backfill/freshness both exclude scope="system") — it's control state.
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
 * Parse an LLM discovery response into new study units, deduped against what's
 * already on the list. PURE (no I/O) so it's unit-testable. Each line is
 * expected as "Work or Author — why"; we take the part before the dash as title.
 */
export function parseDiscoveries(text: string, field: string, existing: Unit[]): Unit[] {
  const knownNorms = existing.map((u) => norm(u.title));
  const out: Unit[] = [];
  const seen = new Set<string>();
  for (const rawLine of (text ?? "").split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    // strip leading bullets / numbering ("1.", "-", "•", "*")
    line = line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim();
    // title = the part before an em/en/hyphen or colon separator
    const title = line.split(/\s+[—–\-:]\s+/)[0]!.trim().replace(/^["'“]|["'”]$/g, "");
    if (!title || title.length < 3 || title.length > 140) continue;
    const n = norm(title);
    if (!n || seen.has(n)) continue;
    // dedup vs existing: skip if either contains the other (loose title match)
    if (knownNorms.some((k) => k === n || k.includes(n) || n.includes(k))) continue;
    seen.add(n);
    out.push(unit(title, field));
  }
  return out;
}

const EXPAND_WHEN_REMAINING = 4;    // discover more once a field is within 4 of the end
const MAX_DISCOVERIES_PER_EXPAND = 12;
const MAX_QUEUE = 300;              // hard ceiling so the list can't grow unbounded

/**
 * Ask an LLM for the next works a serious practitioner in this field should read —
 * classics still missing, the Eastern-bloc/international traditions, and the best
 * current thinkers — excluding everything already on the list. Returns [] on any
 * failure (keyless included), so the caller just carries on.
 */
async function expandCanon(track: Track, existing: Unit[]): Promise<Unit[]> {
  const known = existing.map((u) => u.title).slice(-120).join("; ");
  const prompt =
    `You are curating a lifelong reading list to make someone DEEPLY well-read in ${track.label}. ` +
    `List ${MAX_DISCOVERIES_PER_EXPAND} more essential or influential works/authors/schools a serious ` +
    `practitioner should study — include foundational classics still missing, the Soviet/Eastern-bloc ` +
    `and international traditions where relevant, and the strongest CURRENT thinkers. ` +
    `Do NOT repeat anything already on this list: ${known}. ` +
    `Return ONE per line as "Work or Author — one-line why". No preamble, no numbering, nothing else.`;
  let text = "";
  try {
    const r = await runLLM({ taskType: "curriculum_discovery", operator: track.operator, input: prompt });
    text = r?.text ?? "";
  } catch {
    return [];
  }
  if (!text || engineUnavailableText(text)) return [];
  return parseDiscoveries(text, track.label, existing).slice(0, MAX_DISCOVERIES_PER_EXPAND);
}

// Cost guard: each unit is a DEEP research run. One per domain per week keeps the
// Sunday burst bounded (plus at most one discovery call per domain when near the end).
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
 * the reading list first when a field is running low. Sequential — at most one
 * deep-research run in flight at a time.
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

  for (const track of tracks) {
    if (count >= cap) break;
    for (let u = 0; u < UNITS_PER_DOMAIN_PER_WEEK && count < cap; u++) {
      let state = await getState(globalId, track.domain);
      let list = [...track.canon, ...state.queue];

      // Grow the reading list before it runs out, so the syllabus stays ahead
      // of the cursor (Cole's ask: "read way more as it grows").
      if (list.length - state.index <= EXPAND_WHEN_REMAINING && state.queue.length < MAX_QUEUE) {
        const added = await expandCanon(track, list);
        if (added.length > 0) {
          state = { ...state, queue: [...state.queue, ...added].slice(0, MAX_QUEUE), discoveries: state.discoveries + 1 };
          await setState(globalId, track.domain, state);
          list = [...track.canon, ...state.queue];
          discovered.push({ domain: track.domain, count: added.length });
        }
      }

      const done = state.index >= list.length;
      const studyUnit: Unit = done
        ? {
            title: `Staying current — ${track.label} (cycle ${state.cycles + 1})`,
            query:
              `What are the most important recent developments, refinements, or debates in ${track.label} ` +
              `that a serious practitioner should absorb now? Focus on what has genuinely changed or sharpened, ` +
              `and connect it to how it should change real decisions. Be specific and actionable.`,
          }
        : list[state.index]!;

      try {
        const res = await runResearch({ query: studyUnit.query, operator: track.operator, depth: "deep" });
        const body = [res.synthesis, ...(res.insights ?? [])].filter(Boolean).join("\n\n");

        // Honest failure: no engine / empty → SKIP, don't ingest, don't advance.
        if (!body || body.trim().length < 80 || engineUnavailableText(body) || engineUnavailableText(res.synthesis ?? "")) {
          skipped.push({ domain: track.domain, title: studyUnit.title, reason: "no research engine / empty synthesis" });
          continue;
        }

        await ingestDocument({
          title: `Curriculum · ${track.label}: ${studyUnit.title}`,
          content: `# ${studyUnit.title}\n\n${body}`,
          sourceType: "research",
          domain: track.domain,
          operatorName: track.operator,
          triggeredBy: "self_directed",
          dedupKey: `curriculum:${track.domain}:${done ? `maint:${state.cycles}` : `idx:${state.index}`}`,
        });

        studied.push({ domain: track.domain, title: studyUnit.title });
        touched.add(track.domain);
        count++;
        await setState(globalId, track.domain, done
          ? { ...state, cycles: state.cycles + 1 }
          : { ...state, index: state.index + 1 });
      } catch (err: any) {
        skipped.push({ domain: track.domain, title: studyUnit.title, reason: err?.message ?? String(err) });
      }
    }
  }

  // Let each studied field's living wiki absorb the new reading now.
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

  // One quiet, low-salience note of the week's study (surfaced, not pushed at 10pm).
  if (studied.length > 0) {
    try {
      await surfaceSignal({
        kind: "background_result",
        domain: "personal",
        sourceType: "curriculum",
        severity: "info",
        title: `Studied ${studied.length} work${studied.length === 1 ? "" : "s"} this week`,
        body:
          studied.map((s) => `• ${labelFor(s.domain)}: ${s.title}`).join("\n") +
          (discovered.length ? `\n\n(+${discovered.reduce((n, d) => n + d.count, 0)} new works added to the reading list.)` : "") +
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

/** How far through each field's (seed + discovered) list Aurelius has read. */
export async function getCurriculumProgress(): Promise<
  { domain: string; label: string; read: number; total: number; discovered: number; cycles: number }[]
> {
  const globalId = await resolveOperatorId("global");
  const out: { domain: string; label: string; read: number; total: number; discovered: number; cycles: number }[] = [];
  for (const track of CURRICULUM) {
    const state = globalId ? await getState(globalId, track.domain) : defaultState();
    const total = track.canon.length + state.queue.length;
    out.push({
      domain: track.domain,
      label: track.label,
      read: Math.min(state.index, total),
      total,
      discovered: state.queue.length,
      cycles: state.cycles,
    });
  }
  return out;
}
