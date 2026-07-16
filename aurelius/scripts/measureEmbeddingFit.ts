// aurelius/scripts/measureEmbeddingFit.ts
//
// MEASURE BEFORE TUNING (council work order #7, red team's demand). The claim
// the whole retrieval layer rests on — "abstract when-clauses land cosine-near
// concrete decisions" — was only ever exercised on hash-mock embeddings, which
// prove plumbing, not semantics. This script runs the claim on Cole's REAL
// embedding provider and sizes COLE_BONUS (0.08) against the measured top-k
// spread, so retuning happens on evidence instead of vibes.
//
// Run (with real keys in env):
//   npx tsx scripts/measureEmbeddingFit.ts
//
// Honest-failure: mock/absent provider → refuses with the exact fix. Read-only:
// embeds in memory, writes nothing to the DB or the vector index.

import { prisma } from "../core/db/prisma.ts";
import { getEmbeddingAdapter } from "../retrieval/embeddingAdapter.ts";
import { extractWhenClause, isColeDerived, COLE_BONUS } from "../compiled/patternIndex.ts";

type FitReport = { ok: boolean; reason?: string; lines: string[] };

// Concrete probes in Cole's registers — none shares meaningful tokens with an
// abstract when-clause on purpose; that's the property under test.
const BUILTIN_PROBES = [
  "should I take this high-paying client or protect my Tuesday training block?",
  "is it worth dropping $4k on this certification right now?",
  "do I confront him about the missed sessions or let it slide once more?",
  "should we push the launch a month or ship what we have?",
  "trade my morning sessions for evening ones this cycle?",
];

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function measureFit(): Promise<FitReport> {
  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider === "mock") {
    return { ok: false, reason: "EMBEDDINGS_PROVIDER=mock — hash embeddings prove plumbing, not semantics. Run with your real provider (openai/gemini) and its API key.", lines: [] };
  }
  const adapter = getEmbeddingAdapter();
  if (!adapter) {
    return { ok: false, reason: "No embedding engine configured. Set EMBEDDINGS_PROVIDER and the matching API key, then re-run.", lines: [] };
  }

  const patterns = await prisma.compiledPattern.findMany({
    where: { status: { in: ["auto_factual", "confirmed_heuristic"] } },
    take: 100,
  });
  const rules = patterns
    .map((p) => ({
      id: p.id,
      cole: isColeDerived(p.patternSignature, p.evidence as string[]),
      rule: ((p.patternSignature as any)?.recurringReasoningTheme ?? "").toString(),
    }))
    .filter((r) => r.rule.length > 0)
    .map((r) => ({ ...r, when: extractWhenClause(r.rule) || r.rule }));
  if (rules.length < 2) {
    return { ok: false, reason: `Only ${rules.length} usable compiled rule(s) exist — confirm a few heuristics on the Bridge first, then measure.`, lines: [] };
  }

  // Probes: real recent decisions when they exist, else the built-in set.
  const fired = await prisma.logEntry.findMany({
    where: { type: "trace", message: "decision:patterns_fired" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const realProbes = fired.map((f) => ((f.context as any)?.decision ?? "").toString()).filter((d: string) => d.length > 20);
  const probes = [...new Set([...realProbes, ...BUILTIN_PROBES])].slice(0, 12);

  const whenVecs = await adapter.embed(rules.map((r) => r.when.slice(0, 6000)));
  const probeVecs = await adapter.embed(probes.map((p) => p.slice(0, 6000)));

  const lines: string[] = [
    `provider: ${adapter.name}:${adapter.model} · rules: ${rules.length} (${rules.filter((r) => r.cole).length} Cole-derived) · probes: ${probes.length} (${realProbes.length} real)`,
    "",
  ];
  const gaps: number[] = [];
  const tops: number[] = [];
  for (let i = 0; i < probes.length; i++) {
    const scored = rules
      .map((r, j) => ({ ...r, score: cosine(probeVecs[i], whenVecs[j]) }))
      .sort((a, b) => b.score - a.score);
    const top = scored[0], second = scored[1];
    tops.push(top.score);
    gaps.push(top.score - second.score);
    lines.push(`probe: "${probes[i].slice(0, 70)}"`);
    lines.push(`  1. ${top.score.toFixed(3)}${top.cole ? " [cole]" : ""} — ${top.when.slice(0, 70)}`);
    lines.push(`  2. ${second.score.toFixed(3)}${second.cole ? " [cole]" : ""} — ${second.when.slice(0, 70)}`);
    lines.push(`  gap 1→2: ${(top.score - second.score).toFixed(3)}`);
  }

  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const medGap = median(gaps);
  const medTop = median(tops);
  lines.push("");
  lines.push(`median top score: ${medTop.toFixed(3)} · median 1→2 gap: ${medGap.toFixed(3)} · COLE_BONUS: ${COLE_BONUS}`);
  lines.push(
    COLE_BONUS > medGap * 2
      ? `⚠ COLE_BONUS (${COLE_BONUS}) is >2× the median gap (${medGap.toFixed(3)}) — it will routinely leapfrog better situational matches. Consider sizing it near the median gap.`
      : `COLE_BONUS (${COLE_BONUS}) is in scale with the measured gap (${medGap.toFixed(3)}) — a close-call nudge, as designed.`
  );
  lines.push(
    medTop < 0.3
      ? `⚠ median top score ${medTop.toFixed(3)} is weak — abstract when-clauses may not be landing near concrete decisions on this provider. Retrieval may be ranking noise; revisit before trusting fit-ranking.`
      : `when-clause ↔ decision similarity looks real (median top ${medTop.toFixed(3)}) — the retrieval premise holds on this provider.`
  );
  return { ok: true, lines };
}

// Standalone entry point.
const isMain = process.argv[1]?.endsWith("measureEmbeddingFit.ts");
if (isMain) {
  measureFit()
    .then(async (r) => {
      if (!r.ok) console.error(`✗ ${r.reason}`);
      else console.log(r.lines.join("\n"));
      await prisma.$disconnect();
      process.exit(r.ok ? 0 : 1);
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
