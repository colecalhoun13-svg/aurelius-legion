// aurelius/wealth/engine.ts
//
// WEALTH ENGINE v1 (OG doc Part XII) — the parts that need no account
// data: the DAILY MARKET PULSE. Every morning Aurelius sweeps crypto /
// equities / macro sentiment through the research engine, files ONE
// digest document per day into the wealth corpus (which auto-refreshes
// the Wealth Principles living document and joins recall), and surfaces
// the digest on the Bridge.
//
// Steerable like every sweep: wealth operator's research.daily_topics
// in Living Knowledge overrides the fallback list, via propose→confirm.
//
// Hard rules carried: analysis and signals ONLY. No allocation advice,
// no trade calls — Cole makes every capital decision. Net worth /
// cashflow / accounts arrive with the CSV import block (needs Cole).

import { prisma } from "../core/db/prisma.ts";
import { runResearch } from "../research/researchEngine.ts";
import { resolveTopicsFor } from "../autonomy/pulse.ts";

const DAILY_MARKET_TOPICS = [
  "bitcoin and major crypto price action, funding, and narratives today",
  "US equities and volatility regime today",
  "macro liquidity, rates, and dollar conditions this week",
];

export async function runMarketPulse(dateStr?: string) {
  const dstr = dateStr ?? new Date().toISOString().slice(0, 10);
  const topics = await resolveTopicsFor("wealth", DAILY_MARKET_TOPICS, "daily_topics");

  const run = await prisma.ingestionRun.create({
    data: {
      runType: "wealth_daily",
      operatorName: "wealth",
      triggeredBy: "schedule",
      sourcesQueried: topics,
    },
  });

  const sections: string[] = [];
  const errors: string[] = [];
  let totalInsights = 0;

  // Macro ground truth first — FRED gives a real digest even keyless
  // (no LLM needed for the numbers). Omitted honestly when no key.
  try {
    const { fredSnapshot, formatFredForDigest } = await import("./fred.ts");
    const macro = await fredSnapshot();
    if (macro) sections.push(formatFredForDigest(macro));
  } catch (err) {
    console.warn("[wealth] FRED snapshot failed (non-fatal):", (err as any)?.message ?? err);
  }

  for (const topic of topics) {
    try {
      const r = await runResearch({ query: topic, operator: "wealth", depth: "shallow" });
      // No engine = no digest. Never file an error message as market analysis.
      if (/_API_KEY is not configured|engine is not configured|Missing .*_API_KEY|All configured LLM providers failed/i.test(r.synthesis ?? "")) {
        errors.push(`${topic}: no research engine available`);
      } else if (r.synthesis || r.insights.length > 0) {
        totalInsights += r.insights.length;
        sections.push(
          [`## ${topic}`, r.synthesis, ...r.insights.map((i) => `- ${i}`)].filter(Boolean).join("\n")
        );
      }
    } catch (err: any) {
      errors.push(`${topic}: ${err?.message ?? String(err)}`);
    }
  }

  if (sections.length === 0) {
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), errors },
    });
    console.warn(`[wealth] market pulse ${dstr}: no findings (${errors.length} errors)`);
    return { date: dstr, ingested: false, totalInsights: 0, errors };
  }

  // ONE digest document per day — ingestion fires the four awareness
  // writes and refreshes the wealth living document automatically.
  const { ingestDocument } = await import("../corpus/ingest.ts");
  const { doc } = await ingestDocument({
    title: `Market pulse — ${dstr}`,
    content: sections.join("\n\n"),
    sourceType: "research",
    domain: "wealth",
    operatorName: "wealth",
    triggeredBy: "schedule",
  });

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      finishedAt: new Date(),
      findingsCount: totalInsights,
      errors: errors.length ? errors : undefined,
    },
  });

  await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      domain: "wealth",
      sourceType: "research_ingestion",
      sourceId: doc.id,
      severity: "info",
      title: `Market pulse ${dstr} — ${totalInsights} signals across ${sections.length} fronts`,
      body: sections.join("\n\n").slice(0, 1200),
    },
  });

  console.log(`[wealth] market pulse ${dstr}: ${totalInsights} insights, ${errors.length} errors`);
  return { date: dstr, ingested: true, docId: doc.id, totalInsights, errors };
}
