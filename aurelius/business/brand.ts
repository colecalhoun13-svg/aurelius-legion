// aurelius/business/brand.ts
//
// THE BRAND VOICE — so drafts sound like Cole, not like a generic coach bot.
//
// The positioning facts (mantra, audience, edge) live in business/profile.ts and
// reach every prompt through businessContextBlock. This file holds the VOICE:
// the cadence, the dichotomy content template, and a verbatim sample of Cole's
// own writing, injected into the content and outreach prompts so the copy has
// his rhythm — short punchy lines, a contrast hook that names the reader's
// mistake, an engagement-question CTA — rather than a plausible approximation.
//
// It is GIVEN, from CALHOUN_PERFORMANCE_BRAND.md (confirmed by Cole). No engine
// redesigns it. The verbatim sample is the target cadence, quoted so the model
// matches a real example instead of inventing a house style.
//
// The block is also seeded as persona.* entries (seedBrandVoice) so the base
// system prompt's voice layer carries it even outside the content lane — but the
// primary mechanism is direct injection, exactly like businessContextBlock: an
// absent block reads to a model as "no constraint", and it invents one.

/** The verbatim reel caption Cole is proud of — the target cadence. */
const VOICE_SAMPLE = `AESTHETICS VS. ATHLETICS
Ones For Show...
Ones For Go...
You can build both—but not by accident.
Aesthetic training and athletic training aren't the same. And chasing both with the wrong plan? That's how you stay stuck.
Follow along as I unpack the difference so you can stop spinning your wheels.
What's your current focus—looks or performance? Drop it below.`;

/** The template Cole already runs — the content engine replicates it. */
export const CONTENT_TEMPLATE =
  "dichotomy hook (X vs Y — names the mistake the reader is making) → " +
  "name the mistake plainly → promise the unpack/payoff → engagement-question CTA";

/**
 * The voice block, for prompt injection into content + outreach drafts. Kept
 * short and imperative — it's a constraint, not an essay.
 */
export function brandVoiceBlock(): string {
  return [
    "═══ CALHOUN VOICE — write in THIS, not a generic coach voice ═══",
    "Mantra (the through-line for every line): \"Move fast, lift heavy, be an athlete.\"",
    "",
    "Cadence, from Cole's own post (match this rhythm, don't copy the words):",
    ...VOICE_SAMPLE.split("\n").map((l) => `  > ${l}`),
    "",
    "Rules — not style preferences:",
    "- Short, punchy lines. Fragments for rhythm. Em-dashes and ellipses for pace. Never long academic paragraphs.",
    "- Lead with a DICHOTOMY / contrast hook (X vs Y — show vs go, looks vs performance) that names a mistake the reader is making.",
    "- Confident, teaching-but-challenging (\"that's how you stay stuck\", \"stop spinning your wheels\"). Not soft, not hype, not guru.",
    "- End on an ENGAGEMENT QUESTION CTA (\"What's your focus — looks or performance? Drop it below\").",
    "- Selective, purposeful emoji at most — never spam. Title-Case for key phrases is on-brand.",
    "- Standard-setter, never guarantee-coach: state what's required and why, never \"we'll get you X\".",
    `Template Cole runs: ${CONTENT_TEMPLATE}.`,
    "",
    "Visual pairing (Cole-confirmed look, 2026-08-09 — suggest with each content draft, one line):",
    "- Editorial black-and-white athlete photography, documentary not stocky; OR a clean, legible",
    "  program-table graphic (the product is the proof — real structure from Cole's own sheets,",
    "  anonymized). Institutional 'performance dept' framing fits the voice; neon fitness-bro",
    "  styling never does. Carousel grammar: editorial hero → the table → a plain checklist + CTA.",
  ].join("\n");
}

// ── Persona seeding — mirrors seedBusinessProfile's idempotent reconcile ──

const PERSONA_SCOPE = "persona";
const BRAND_SOURCE_PREFIX = "brand:rev";

type VoiceEntry = { key: string; value: string; revision: number };
const VOICE_ENTRIES: VoiceEntry[] = [
  {
    key: "brand_mantra",
    value: "Calhoun Performance — \"Move fast, lift heavy, be an athlete.\" Strength, speed and athleticism together; the gen-pop wedge is \"train like an athlete, not a gym-goer.\"",
    revision: 1,
  },
  {
    key: "voice_cadence",
    value:
      "Short punchy lines, fragments for rhythm, em-dashes/ellipses for pace. Dichotomy/contrast hook that names the reader's mistake. Teaching-but-challenging, never soft or hype. Ends on an engagement-question CTA. Selective emoji only.",
    revision: 1,
  },
  {
    key: "content_template",
    value: CONTENT_TEMPLATE,
    revision: 1,
  },
];

/**
 * Seed the brand voice into persona.* Living Knowledge, idempotently. Same
 * contract as seedBusinessProfile: a seed-written entry is upgraded only when
 * its revision climbs; an entry Cole edited by hand (different sourceId) is
 * never overwritten.
 */
export async function seedBrandVoice(): Promise<{ written: string[]; skipped: string[]; revised: string[] }> {
  const { setKnowledge, getKnowledge, resolveOperatorId } = await import("../knowledge/store.ts");
  // MUST be the "strategy" operator: getOperatorStateBlock (Layer 1.5) reads
  // persona.* off resolveOperatorId("strategy"), so a brand entry written under
  // any other lens would seed a row nothing ever reads. Fall back only if the
  // strategy operator genuinely doesn't resolve.
  const opId =
    (await resolveOperatorId("strategy").catch(() => null)) ??
    (await resolveOperatorId("business").catch(() => null));
  if (!opId) return { written: [], skipped: [], revised: [] };

  const written: string[] = [];
  const skipped: string[] = [];
  const revised: string[] = [];

  for (const entry of VOICE_ENTRIES) {
    const stamp = `${BRAND_SOURCE_PREFIX}${entry.revision}`;
    const existing = await getKnowledge(opId, PERSONA_SCOPE, entry.key, { includeInactive: false });
    if (existing) {
      const storedSource = (existing as any)?.sourceId ?? null;
      const storedRev =
        typeof storedSource === "string" && storedSource.startsWith(BRAND_SOURCE_PREFIX)
          ? Number(storedSource.slice(BRAND_SOURCE_PREFIX.length))
          : null;
      if (storedRev === null || !Number.isFinite(storedRev) || storedRev >= entry.revision) {
        skipped.push(entry.key);
        continue;
      }
      await setKnowledge({
        operatorId: opId, scope: PERSONA_SCOPE, key: entry.key, value: entry.value,
        sourceType: "cole_conversation", sourceId: stamp,
        rationale: `Brand voice restated (revision ${entry.revision}).`, updatedBy: "cole",
      });
      revised.push(entry.key);
      continue;
    }
    await setKnowledge({
      operatorId: opId, scope: PERSONA_SCOPE, key: entry.key, value: entry.value,
      sourceType: "cole_conversation", sourceId: stamp,
      rationale: "Calhoun Performance brand voice, confirmed by Cole.", updatedBy: "cole",
    });
    written.push(entry.key);
  }
  return { written, skipped, revised };
}
