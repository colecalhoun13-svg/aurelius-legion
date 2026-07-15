// aurelius/learning/curriculum.ts
//
// THE CURRICULUM — auto-learning the canon of every field, one week at a time.
//
// The initiative pulse REACTS (it refreshes stale/thin domains). This is the
// other half Cole asked for: proactive, systematic study. Each operator carries
// an ordered CANON — the foundational literature of its field (strategy reads
// Sun Tzu and Musashi; wealth reads Buffett, Munger, Taleb; identity reads the
// Stoics) — and every Sunday night Aurelius works through the next unit for each
// domain: it researches the work (LLM knowledge + open academic sources), ingests
// the synthesis into the second brain (four-write, domain-tagged), and refreshes
// the domain's living wiki page. A per-domain cursor advances so it never re-reads
// the same unit; when a canon is exhausted it shifts to "stay current" mode
// (recent developments in the field). Over months, every operator becomes deeply
// versed in its literature — so its reasoning for Cole is grounded in the best
// thinking humanity has on that domain, not just the model's default.
//
// Safety/consistency: this is INWARD auto-ingestion into the brain (like RSS and
// the weekend pulse) — corpus documents, reversible, traced. It does NOT write
// Living Knowledge (persona/facts), which still goes through propose→confirm.
// Honest failure (hard rule 3): if no LLM engine answers, the unit is SKIPPED —
// never ingested as content — and the cursor does NOT advance, so it retries next
// week. The cursor lives under scope="system" (never embedded, never in recall).

import { prisma } from "../core/db/prisma.ts";
import { resolveOperatorId } from "../knowledge/store.ts";
import { runResearch } from "../research/researchEngine.ts";
import { ingestDocument } from "../corpus/ingest.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";
import { surfaceSignal } from "../core/bridge.ts";

type Unit = { title: string; query: string };
type Track = { operator: string; domain: string; label: string; canon: Unit[] };

// One shared prompt frame so every synthesis comes back grounded AND applied to
// Cole's life, not an abstract book report.
function studyQuery(work: string, field: string): string {
  return (
    `Study "${work}". Extract its core framework and the specific, durable principles a serious ` +
    `practitioner should internalize. Then translate them into concrete decision heuristics for ` +
    `${field}: how would these ideas change how someone actually decides and acts? Be specific, ` +
    `structured, and honest about where the ideas have limits. Avoid summary-for-summary's-sake.`
  );
}

// ── THE CANON ────────────────────────────────────────────────────────
// Ordered foundational literature per operator. Curated, not exhaustive — the
// spine of each field. Extend freely; the cursor just walks the list.
export const CURRICULUM: Track[] = [
  {
    operator: "strategy",
    domain: "strategy",
    label: "Strategy",
    canon: [
      { title: "Sun Tzu — The Art of War", query: studyQuery("The Art of War by Sun Tzu", "strategy: timing, positioning, winning before fighting, knowing self and terrain") },
      { title: "Miyamoto Musashi — The Book of Five Rings", query: studyQuery("The Book of Five Rings by Miyamoto Musashi", "strategy: mastery through fundamentals, adaptability, the way of the disciplined operator") },
      { title: "Robert Greene — The 48 Laws of Power", query: studyQuery("The 48 Laws of Power by Robert Greene", "strategy and social dynamics, used ethically for self-protection and leverage") },
      { title: "Robert Greene — Mastery", query: studyQuery("Mastery by Robert Greene", "the path to world-class skill: apprenticeship, deliberate practice, creative-active phase") },
      { title: "Richard Rumelt — Good Strategy / Bad Strategy", query: studyQuery("Good Strategy Bad Strategy by Richard Rumelt", "the kernel of strategy: diagnosis, guiding policy, coherent action; spotting fluff") },
      { title: "Carl von Clausewitz — On War", query: studyQuery("On War by Carl von Clausewitz", "friction, the culminating point, war as politics by other means, the fog of uncertainty") },
      { title: "B.H. Liddell Hart — Strategy (the indirect approach)", query: studyQuery("Strategy by B.H. Liddell Hart", "the indirect approach: dislocate before you strike, avoid the enemy's strength") },
      { title: "John Boyd — the OODA loop", query: studyQuery("John Boyd's OODA loop and 'Patterns of Conflict'", "operating inside the opponent's decision cycle; tempo and orientation as edge") },
      { title: "Machiavelli — The Prince", query: studyQuery("The Prince by Niccolò Machiavelli", "power, realism over idealism, virtù and fortuna — read critically, applied ethically") },
      { title: "Naval Ravikant — leverage & specific knowledge", query: studyQuery("Naval Ravikant's writing on leverage, specific knowledge, and judgment", "building leverage: code, media, capital, and compounding judgment") },
    ],
  },
  {
    operator: "training",
    domain: "training",
    label: "Training",
    canon: [
      { title: "Zatsiorsky & Kraemer — Science and Practice of Strength Training", query: studyQuery("Science and Practice of Strength Training by Zatsiorsky and Kraemer", "programming strength: the three methods, overload, specificity, fatigue management") },
      { title: "Mel Siff — Supertraining", query: studyQuery("Supertraining by Mel Siff", "advanced strength science: the force-velocity curve, work capacity, adaptation") },
      { title: "Brad Schoenfeld — hypertrophy mechanisms", query: studyQuery("Brad Schoenfeld's research on the mechanisms of muscle hypertrophy", "mechanical tension, volume landmarks, proximity to failure, frequency") },
      { title: "Helms et al. — The Muscle & Strength Pyramids", query: studyQuery("The Muscle and Strength Training Pyramids by Eric Helms", "the priority hierarchy: adherence, volume/intensity/frequency, progression, deload") },
      { title: "Periodization models — linear, block, DUP", query: studyQuery("periodization models: linear, block, and daily undulating periodization", "structuring training over time; when each model wins; managing peaking and fatigue") },
      { title: "Autoregulation — RPE and RIR", query: studyQuery("autoregulation in strength training via RPE and reps-in-reserve", "adjusting load to daily readiness; velocity-based and RIR-based approaches") },
      { title: "Prilepin's chart & intensity management", query: studyQuery("Prilepin's chart and intensity/volume management in strength sport", "optimal reps per intensity zone; managing total tonnage") },
      { title: "Connective tissue & tendon adaptation", query: studyQuery("tendon and connective tissue adaptation to loading", "building resilient tendons; loading protocols; why tissue adapts slower than muscle") },
    ],
  },
  {
    operator: "athlete",
    domain: "athlete",
    label: "Athletic Performance",
    canon: [
      { title: "Matthew Walker — Why We Sleep", query: studyQuery("Why We Sleep by Matthew Walker", "sleep as the foundation of recovery, performance, and decision quality") },
      { title: "Tudor Bompa — Periodization for sport", query: studyQuery("Periodization: Theory and Methodology of Training by Tudor Bompa", "peaking for competition; sequencing qualities across a season") },
      { title: "Mihaly Csikszentmihalyi — Flow", query: studyQuery("Flow by Mihaly Csikszentmihalyi", "the psychology of optimal performance; conditions that produce flow states") },
      { title: "Recovery science — HRV, fatigue, deload", query: studyQuery("recovery science: heart-rate variability, fatigue monitoring, and deloading", "reading the body's readiness signals; when to push and when to back off") },
      { title: "Speed & power development", query: studyQuery("speed and power development for athletes", "rate of force development, plyometrics, the force-velocity spectrum") },
      { title: "Mental toughness & resilience", query: studyQuery("mental toughness and resilience in elite sport", "building the mind that performs under pressure; discomfort tolerance") },
    ],
  },
  {
    operator: "wealth",
    domain: "wealth",
    label: "Wealth & Investing",
    canon: [
      { title: "Morgan Housel — The Psychology of Money", query: studyQuery("The Psychology of Money by Morgan Housel", "behavior over intelligence; the role of patience, compounding, and enough") },
      { title: "Charlie Munger — Poor Charlie's Almanack (mental models)", query: studyQuery("Poor Charlie's Almanack and Charlie Munger's latticework of mental models", "multidisciplinary mental models; inversion; avoiding standard stupidities") },
      { title: "Warren Buffett — the shareholder letters", query: studyQuery("Warren Buffett's Berkshire Hathaway shareholder letters", "value investing, moats, circle of competence, long-term ownership") },
      { title: "Nassim Taleb — Antifragile", query: studyQuery("Antifragile by Nassim Nicholas Taleb", "gaining from disorder; convexity; the barbell strategy; via negativa") },
      { title: "Nassim Taleb — Fooled by Randomness / The Black Swan", query: studyQuery("Fooled by Randomness and The Black Swan by Nassim Taleb", "randomness, fat tails, and surviving rare high-impact events") },
      { title: "John Bogle — The Little Book of Common Sense Investing", query: studyQuery("The Little Book of Common Sense Investing by John Bogle", "low-cost index investing; why costs and behavior dominate returns") },
      { title: "Ray Dalio — Principles & the All-Weather idea", query: studyQuery("Principles by Ray Dalio and the All-Weather portfolio concept", "radical transparency, diversification across environments, risk parity intuition") },
      { title: "Risk of ruin, position sizing, the Kelly criterion", query: studyQuery("risk of ruin, position sizing, and the Kelly criterion", "never blowing up; sizing bets to survive and compound") },
    ],
  },
  {
    operator: "business",
    domain: "business",
    label: "Business",
    canon: [
      { title: "Alex Hormozi — $100M Offers", query: studyQuery("$100M Offers by Alex Hormozi", "building a grand-slam offer; value equation; making price irrelevant") },
      { title: "Alex Hormozi — $100M Leads", query: studyQuery("$100M Leads by Alex Hormozi", "lead generation: the core four; turning attention into engaged leads") },
      { title: "Peter Drucker — The Effective Executive", query: studyQuery("The Effective Executive by Peter Drucker", "managing oneself; effectiveness as a habit; decisions and contribution") },
      { title: "Michael Porter — Competitive Strategy (five forces)", query: studyQuery("Competitive Strategy by Michael Porter and the five forces", "industry structure; sources of durable advantage; positioning") },
      { title: "Clayton Christensen — jobs to be done / disruption", query: studyQuery("The Innovator's Dilemma and Jobs to Be Done by Clayton Christensen", "why incumbents fail; understanding the job a customer hires you for") },
      { title: "Eric Ries — The Lean Startup", query: studyQuery("The Lean Startup by Eric Ries", "build-measure-learn; validated learning; the minimum viable product") },
      { title: "Jim Collins — Good to Great", query: studyQuery("Good to Great by Jim Collins", "level 5 leadership; the hedgehog concept; the flywheel; first who then what") },
      { title: "Michael Gerber — The E-Myth (systems & SOPs)", query: studyQuery("The E-Myth Revisited by Michael Gerber", "working ON the business not IN it; systemizing via SOPs; franchise thinking") },
    ],
  },
  {
    operator: "content",
    domain: "content",
    label: "Content & Persuasion",
    canon: [
      { title: "David Ogilvy — Ogilvy on Advertising", query: studyQuery("Ogilvy on Advertising by David Ogilvy", "big ideas, headlines, research-driven persuasion, respecting the audience") },
      { title: "Eugene Schwartz — Breakthrough Advertising", query: studyQuery("Breakthrough Advertising by Eugene Schwartz", "market awareness and sophistication stages; channeling existing desire") },
      { title: "Joseph Sugarman — The Adweek Copywriting Handbook", query: studyQuery("The Adweek Copywriting Handbook by Joseph Sugarman", "the slippery slide; psychological triggers; every element sells the next") },
      { title: "Robert Cialdini — Influence", query: studyQuery("Influence by Robert Cialdini", "the six (now seven) principles of persuasion, used ethically") },
      { title: "Donald Miller — Building a StoryBrand", query: studyQuery("Building a StoryBrand by Donald Miller", "the customer as hero, you as guide; clarifying the message") },
      { title: "Joseph Campbell — the Hero's Journey", query: studyQuery("The Hero with a Thousand Faces by Joseph Campbell", "the monomyth; narrative structure that resonates universally") },
      { title: "Short-form attention & hooks", query: studyQuery("the mechanics of short-form video hooks and retention", "earning the first three seconds; open loops; pattern interrupts; platform dynamics") },
    ],
  },
  {
    operator: "identity",
    domain: "identity",
    label: "Identity & Purpose",
    canon: [
      { title: "Marcus Aurelius — Meditations", query: studyQuery("Meditations by Marcus Aurelius", "Stoic self-governance; the view from above; duty, impermanence, the inner citadel") },
      { title: "Seneca — Letters from a Stoic", query: studyQuery("Letters from a Stoic by Seneca", "time as the only real currency; practicing adversity; living deliberately") },
      { title: "Epictetus — The Enchiridion", query: studyQuery("The Enchiridion by Epictetus", "the dichotomy of control; distinguishing what is and isn't up to us") },
      { title: "Viktor Frankl — Man's Search for Meaning", query: studyQuery("Man's Search for Meaning by Viktor Frankl", "meaning as the deepest drive; the last human freedom; purpose through suffering") },
      { title: "James Clear — Atomic Habits (identity-based habits)", query: studyQuery("Atomic Habits by James Clear", "identity-based habits; systems over goals; the 1% compounding of self") },
      { title: "Ryan Holiday — Ego Is the Enemy", query: studyQuery("Ego Is the Enemy by Ryan Holiday", "ego as the obstacle to mastery; humility, restraint, and the long game") },
      { title: "Carl Jung — individuation & the shadow", query: studyQuery("Carl Jung's concepts of individuation and the shadow", "integrating the shadow; becoming whole; the process of individuation") },
    ],
  },
];

type Cursor = { index: number; cycles: number };

// The cursor lives under scope="system" so it is NEVER embedded into the vector
// index (backfill/freshness both exclude scope="system") — it's control state,
// not knowledge.
async function getCursor(operatorId: string, domain: string): Promise<Cursor> {
  const row = await prisma.knowledgeEntry.findUnique({
    where: { operatorId_scope_key: { operatorId, scope: "system", key: `curriculum:${domain}` } },
  });
  const v = (row?.value as any) ?? {};
  return { index: typeof v.index === "number" ? v.index : 0, cycles: typeof v.cycles === "number" ? v.cycles : 0 };
}

async function setCursor(operatorId: string, domain: string, cursor: Cursor): Promise<void> {
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId, scope: "system", key: `curriculum:${domain}` } },
    update: { value: cursor as any, updatedBy: "curriculum" },
    create: {
      operatorId,
      scope: "system",
      key: `curriculum:${domain}`,
      value: cursor as any,
      sourceType: "curriculum_cursor",
      createdBy: "system",
    },
  });
}

// Cost guard: each unit is a DEEP research run (multiple LLM calls + academic
// source fetches). One per domain per week keeps the Sunday burst bounded.
const UNITS_PER_DOMAIN_PER_WEEK = 1;
const MAX_UNITS_PER_RUN = 8;

export type CurriculumResult = {
  ok: boolean;
  studied: { domain: string; title: string }[];
  skipped: { domain: string; title: string; reason: string }[];
  error?: string;
};

/**
 * Study the next curriculum unit for each field (or one domain, for testing).
 * Runs SEQUENTIALLY so at most one deep-research mission is in flight at a time.
 */
export async function runCurriculumIngest(opts?: {
  onlyDomain?: string;
  maxUnits?: number;
}): Promise<CurriculumResult> {
  const globalId = await resolveOperatorId("global");
  if (!globalId) return { ok: false, studied: [], skipped: [], error: "no global operator" };

  const tracks = opts?.onlyDomain
    ? CURRICULUM.filter((t) => t.domain === opts.onlyDomain)
    : CURRICULUM;
  const cap = opts?.maxUnits ?? MAX_UNITS_PER_RUN;

  const studied: { domain: string; title: string }[] = [];
  const skipped: { domain: string; title: string; reason: string }[] = [];
  const touched = new Set<string>();
  let count = 0;

  for (const track of tracks) {
    if (count >= cap) break;
    // (UNITS_PER_DOMAIN_PER_WEEK is 1 today; the loop below would extend to N.)
    for (let u = 0; u < UNITS_PER_DOMAIN_PER_WEEK && count < cap; u++) {
      const cursor = await getCursor(globalId, track.domain);
      const done = cursor.index >= track.canon.length;
      const unit: Unit = done
        ? {
            title: `Staying current — ${track.label} (cycle ${cursor.cycles + 1})`,
            query:
              `What are the most important recent developments, refinements, or debates in ${track.label} ` +
              `that a serious practitioner should absorb now? Focus on what has genuinely changed or sharpened. ` +
              `Be specific and actionable, and connect it to how it should change real decisions.`,
          }
        : track.canon[cursor.index]!;

      try {
        const res = await runResearch({ query: unit.query, operator: track.operator, depth: "deep" });
        const body = [res.synthesis, ...(res.insights ?? [])].filter(Boolean).join("\n\n");

        // Honest failure (hard rule 3): no engine / empty → SKIP. Never file an
        // error string as studied content, and DON'T advance the cursor — retry
        // next week when a provider is available.
        if (
          !body ||
          body.trim().length < 80 ||
          engineUnavailableText(body) ||
          engineUnavailableText(res.synthesis ?? "")
        ) {
          skipped.push({ domain: track.domain, title: unit.title, reason: "no research engine / empty synthesis" });
          continue;
        }

        await ingestDocument({
          title: `Curriculum · ${track.label}: ${unit.title}`,
          content: `# ${unit.title}\n\n${body}`,
          sourceType: "research",
          domain: track.domain,
          operatorName: track.operator,
          triggeredBy: "self_directed",
          // Idempotent per unit: a re-run the same week won't double-file.
          dedupKey: `curriculum:${track.domain}:${done ? `maint:${cursor.cycles}` : cursor.index}`,
        });

        studied.push({ domain: track.domain, title: unit.title });
        touched.add(track.domain);
        count++;

        // Advance: canon units step the index; maintenance runs bump the cycle.
        await setCursor(globalId, track.domain, done
          ? { index: cursor.index, cycles: cursor.cycles + 1 }
          : { index: cursor.index + 1, cycles: cursor.cycles });
      } catch (err: any) {
        skipped.push({ domain: track.domain, title: unit.title, reason: err?.message ?? String(err) });
      }
    }
  }

  // Let each studied field's living wiki absorb the new reading now (the 09:00
  // wiki sweep already ran earlier Sunday; refresh the touched domains here).
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
          `\n\nAbsorbed into the second brain and each field's wiki — grounding future decisions.`,
      });
    } catch (err) {
      console.warn("[curriculum] summary signal failed:", (err as any)?.message ?? err);
    }
  }

  console.log(
    `[curriculum] studied ${studied.length}, skipped ${skipped.length}` +
      (skipped.length ? ` (skips: ${skipped.map((s) => s.domain).join(", ")})` : "")
  );
  return { ok: true, studied, skipped };
}

function labelFor(domain: string): string {
  return CURRICULUM.find((t) => t.domain === domain)?.label ?? domain;
}

/** How far through each field's canon Aurelius has read — for a status view. */
export async function getCurriculumProgress(): Promise<
  { domain: string; label: string; read: number; total: number; cycles: number }[]
> {
  const globalId = await resolveOperatorId("global");
  const out: { domain: string; label: string; read: number; total: number; cycles: number }[] = [];
  for (const track of CURRICULUM) {
    const cursor = globalId ? await getCursor(globalId, track.domain) : { index: 0, cycles: 0 };
    out.push({
      domain: track.domain,
      label: track.label,
      read: Math.min(cursor.index, track.canon.length),
      total: track.canon.length,
      cycles: cursor.cycles,
    });
  }
  return out;
}
