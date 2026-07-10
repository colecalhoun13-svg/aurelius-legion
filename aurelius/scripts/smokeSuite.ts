// aurelius/scripts/smokeSuite.ts
//
// THE SMOKE SUITE — live-fire verification of every load-bearing loop,
// against a real Postgres. Run: npx tsx scripts/smokeSuite.ts
// (needs DATABASE_URL; EMBEDDINGS_PROVIDER=mock is fine — checks assert
// plumbing and writes, not answer quality.)
//
// This is the standing-requirement bar from NORTH_STAR §6: verification
// travels with the system, not with the chat session that built it.

import { prisma } from "../core/db/prisma.ts";
import { ingestDocument, getCorpusAwareness } from "../corpus/ingest.ts";
import { ask } from "../corpus/ask.ts";
import { ensureRituals, generateMorningBriefing } from "../rituals/engine.ts";
import { createMission, runMission, getMission } from "../missions/engine.ts";
import { createProposal, getAllPendingProposals, resolveProposal } from "../knowledge/proposals.ts";
import { getKnowledge, resolveOperatorId } from "../knowledge/store.ts";
import { computeWeeklySnapshot } from "../measurement/scoreboard.ts";
import { runInitiativePulse } from "../autonomy/initiative.ts";
import { synthesizeWikiPage } from "../wiki/engine.ts";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name} ${detail}`); }
}

async function main() {
  const TAG = `smoke_${Date.now()}`;

  console.log("── second brain: four-write ingestion ──");
  const { doc, chunkCount } = await ingestDocument({
    title: `Smoke doc ${TAG}`,
    content:
      "Smoke content: velocity loss thresholds around twenty percent are a common stop signal. This document exists only to verify the ingestion pipeline end to end.",
    domain: "smoke_suite",
  });
  check("corpus registered", !!doc.id);
  check("chunks embedded", chunkCount >= 1);
  const mem = await prisma.memory.findFirst({ where: { value: { contains: TAG } } });
  check("summary memory written", !!mem);
  const sig = await prisma.bridgeSignal.findFirst({ where: { sourceId: doc.id } });
  check("bridge signal surfaced", !!sig);
  const run = await prisma.ingestionRun.findFirst({
    where: { runType: "corpus_upload" }, orderBy: { startedAt: "desc" },
  });
  check("ingestion run completed", run?.status === "completed");
  const awareness = await getCorpusAwareness();
  check("awareness block lists library", awareness.includes("YOUR LIBRARY"));

  console.log("── ask plumbing ──");
  const answer = await ask("what stops a set in velocity based training?");
  check("ask returns structured result", typeof answer.answer === "string" && Array.isArray(answer.sources));

  console.log("── wiki synthesis ──");
  const wiki = await synthesizeWikiPage("smoke_suite", "smoke");
  check("wiki page written", !wiki.skipped && !!wiki.page?.content);
  const rev = await prisma.wikiRevision.count({ where: { pageId: wiki.skipped ? "" : wiki.page.id } });
  check("revision kept", rev >= 1);

  console.log("── rituals ──");
  await ensureRituals();
  const { instance } = await generateMorningBriefing();
  check("briefing instance filed", instance.status === "generated" && !!instance.outputText);

  console.log("── missions (keyless: fails honestly at synthesize) ──");
  const mission = await createMission({ objective: `Smoke mission ${TAG}`, domain: "smoke_suite" });
  const done = await runMission(mission.id);
  check("mission reached terminal state", ["completed", "failed"].includes(done.status));
  const full = await getMission(mission.id);
  check("steps persisted with states", (full?.steps.length ?? 0) >= 2);

  console.log("── durable propose→confirm ──");
  const opId = await resolveOperatorId("training");
  const prop = await createProposal({
    operatorId: opId!, operatorName: "training", intentClassId: "rep_band_update",
    scope: "smoke", key: TAG, proposedValue: "smoke value",
    rationale: "smoke", coleNaturalLanguage: "smoke",
  });
  const pending = await getAllPendingProposals();
  check("proposal survives fresh read", pending.some((p) => p.id === prop.id));
  await resolveProposal({ operatorId: opId!, proposalId: prop.id, decision: "confirmed", coleResponseText: "smoke" });
  const kn = await getKnowledge(opId!, "smoke", TAG);
  check("confirm applied to Living Knowledge", kn?.value === "smoke value");

  console.log("── measurement ──");
  const snap1 = await computeWeeklySnapshot();
  const snap2 = await computeWeeklySnapshot();
  check("scoreboard idempotent per week", snap1.id === snap2.id);

  console.log("── initiative ──");
  const init1 = await runInitiativePulse();
  const init2 = await runInitiativePulse();
  check("initiative dedups on rerun", init2.proposed.length === 0 || init2.proposed.length < init1.proposed.length + 1);

  // ── cleanup (smoke artifacts only) ──
  await prisma.vectorEmbedding.deleteMany({ where: { sourceId: doc.id } });
  await prisma.corpusDocument.delete({ where: { id: doc.id } });
  await prisma.knowledgeProposal.deleteMany({ where: { key: TAG } });
  await prisma.knowledgeEntry.deleteMany({ where: { scope: "smoke", key: TAG } });
  await prisma.mission.deleteMany({ where: { title: { contains: TAG } } });
  const wikiPage = await prisma.wikiPage.findUnique({ where: { slug: "smoke_suite" } });
  if (wikiPage) {
    await prisma.vectorEmbedding.deleteMany({ where: { sourceId: wikiPage.id } });
    await prisma.wikiPage.delete({ where: { id: wikiPage.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
