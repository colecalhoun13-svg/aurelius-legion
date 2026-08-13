// aurelius/faith/rhythm.ts
//
// FAITH RHYTHM (NORTH_STAR #48) — "deepen beyond the daily quote." Cole asked
// for this to draw from AURELIUS' OWN LIBRARY, not a generic verse-of-the-day
// API. So it does exactly that: it recalls faith-relevant material Cole has
// actually ingested (a devotional, a reading plan, scripture, a book) and
// offers a short grounding rhythm reflecting on THAT.
//
// The hard line, because faith content is sacred and misquoting it is worse than
// silence: it NEVER invents or adds scripture. It only reflects on what's in the
// library, and if the library has nothing faith-related yet, it stays DORMANT
// and says so — the fix is ingesting material, not fabricating verses. Keyless
// or empty → honest dormancy, never a made-up devotional.

export type FaithRhythm = {
  ok: boolean;
  rhythm?: string; // a short reflection grounded in the library passage
  drawnFrom?: string; // which kind of source it came from
  reason?: string; // why dormant, when not ok
};

// A library hit must be genuinely close, not the nearest random chunk — a weak
// match would produce a "faith" reflection about someone's training log.
const MIN_SIMILARITY = 0.42;

export async function faithRhythm(): Promise<FaithRhythm> {
  const { semanticRecall } = await import("../retrieval/retrieve.ts");
  const hits = await semanticRecall({
    query:
      "faith, scripture, prayer, trusting God, grace, devotion, spiritual discipline, gratitude, humility, purpose and calling",
    limit: 5,
  }).catch(() => []);

  const strong = hits
    .filter((h) => h.similarity >= MIN_SIMILARITY && (h.chunkText?.trim().length ?? 0) > 60)
    .sort((a, b) => b.similarity - a.similarity);

  if (strong.length === 0) {
    return {
      ok: false,
      reason:
        "No faith material in the library yet — ingest a devotional, a reading plan, or scripture and the rhythm will draw from it. I won't invent verses.",
    };
  }

  const source = strong[0]!;
  const { runLLM } = await import("../llm/runLLM.ts");
  const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
  const res = await runLLM({
    taskType: "summary",
    operator: "strategy",
    noReuse: true,
    omitToolCatalog: true,
    input:
      `From this passage in Cole's OWN library, offer a short daily faith rhythm — one steady grounding thought for today, drawn ONLY from what is here.\n\n` +
      `HARD RULES: do NOT add, quote, or invent any scripture, verse, or reference that is not already in the passage. Reflect on what's present; never fabricate. 2-3 sentences, personal and steady, not preachy, not a sermon.\n\n` +
      `PASSAGE:\n${source.chunkText.slice(0, 1600)}`,
  });
  const rhythm = (res.text ?? "").trim();
  if (!rhythm || rhythm.length < 20 || engineUnavailableText(rhythm)) {
    return { ok: false, reason: "No engine available — refusing to invent a devotional. Nothing surfaced." };
  }

  return { ok: true, rhythm, drawnFrom: source.sourceType };
}
