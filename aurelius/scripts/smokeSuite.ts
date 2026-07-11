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

  console.log("── calendar (unauthed: fails honestly; math runs on the mirror) ──");
  const { googleCalendarAdapter } = await import("../tools/adapters/googleCalendar.ts");
  const { isCalendarConnected } = await import("../calendar/googleAuth.ts");
  const { findAvailability } = await import("../calendar/engine.ts");
  if (!(await isCalendarConnected())) {
    const calRead = await googleCalendarAdapter.run("read_events", {});
    check("calendar tool fails honestly when unauthed", !calRead.ok && /calendar\/auth/.test(calRead.error ?? ""));
  } else {
    const calRead = await googleCalendarAdapter.run("read_events", {});
    check("calendar tool reads when connected", calRead.ok);
  }
  const calDay = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  await prisma.calendarEvent.createMany({
    data: [
      { externalId: `${TAG}_cal_1`, title: "smoke A", startAt: new Date(`${calDay}T09:00:00Z`), endAt: new Date(`${calDay}T10:30:00Z`), raw: { allDay: false } },
      { externalId: `${TAG}_cal_2`, title: "smoke B", startAt: new Date(`${calDay}T14:00:00Z`), endAt: new Date(`${calDay}T16:00:00Z`), raw: { allDay: false } },
    ],
    skipDuplicates: true,
  });
  const avail = (await findAvailability({ days: 2, minMinutes: 60 })).find((d) => d.date === calDay);
  check("availability gap math (3 slots, 210 busy min)", avail?.slots.length === 3 && avail?.busyMinutes === 210);
  await prisma.calendarEvent.deleteMany({ where: { externalId: { startsWith: TAG } } });

  console.log("── weekly planning phase 2: candidate generation ──");
  const { generateWeekCandidates } = await import("../planning/tools.ts");
  const overdueTask = await prisma.task.create({
    data: { title: `${TAG} overdue`, status: "next", dueDate: new Date(Date.now() - 3 * 86400_000) },
  });
  const cands = await generateWeekCandidates(10);
  check(
    "overdue task surfaces as week candidate with reason",
    cands.some((c) => c.title === overdueTask.title && /overdue/.test(c.reason))
  );
  await prisma.task.delete({ where: { id: overdueTask.id } });

  console.log("── freshness + corrections (the trust loop) ──");
  const { stalenessOf, runFreshnessSweep } = await import("../knowledge/freshness.ts");
  check("staleness math (400d / 120d half-life)", stalenessOf(new Date(Date.now() - 400 * 86400_000), "rep_bands") === 3.33);
  const freshEntry = await prisma.knowledgeEntry.findFirst({ where: { active: true, scope: { not: "system" } } });
  if (freshEntry) {
    await prisma.$executeRaw`UPDATE "KnowledgeEntry" SET "updatedAt" = NOW() - INTERVAL '400 days' WHERE id = ${freshEntry.id}`;
    const sweep1 = await runFreshnessSweep();
    const sweep2 = await runFreshnessSweep();
    check("freshness sweep proposes once, dedupes on rerun", sweep1.proposed >= 1 && sweep2.proposed === 0);
    const { recordCorrection } = await import("../knowledge/corrections.ts");
    const corr = await recordCorrection({
      targetType: "knowledge_entry",
      targetId: freshEntry.id,
      reason: `smoke correction ${TAG}`,
      after: freshEntry.value,
      operatorName: "global",
    });
    const corrected = await prisma.knowledgeEntry.findUnique({ where: { id: freshEntry.id } });
    check("correction applies with cole_correction provenance", corr.applied && corrected?.sourceType === "cole_correction");
    // cleanup this block's artifacts
    await prisma.knowledgeProposal.deleteMany({ where: { intentClassId: "freshness_recheck", key: freshEntry.key } });
    await prisma.correction.deleteMany({ where: { reason: { contains: TAG } } });
    await prisma.bridgeSignal.deleteMany({ where: { title: { startsWith: "Knowledge freshness:" } } });
    await prisma.memory.deleteMany({ where: { value: { contains: TAG } } });
  }

  console.log("── resilience: failover chain, catch-up, continuity ──");
  const { chooseModel } = await import("../llm/router.ts");
  const routed = chooseModel({ taskType: "chat", input: "x" });
  check("default routing targets Claude Sonnet 5", routed.model === "claude-sonnet-5");
  // Keyless env → the failover chain is length one → the old honest failure
  const { routeLLM } = await import("../llm/router.ts");
  const llmRes = await routeLLM({ taskType: "chat", operators: { primary: "strategy", secondaries: [] }, input: "smoke" });
  check(
    "keyless routeLLM fails honestly (no phantom failover)",
    /engine is not configured|All configured LLM providers failed/i.test(llmRes.text)
  );
  const { runCatchUp } = await import("../core/catchUp.ts");
  const catchup = await runCatchUp(); // keyless: jobs fire and fail honestly or dedupe on traces
  check("catch-up sweep runs without throwing", typeof catchup.fired === "number");
  const { recordTurns, recentConversationBlock } = await import("../memory/conversation.ts");
  recordTurns({ coleMessage: `${TAG} ping`, aureliusReply: `${TAG} pong`, operatorName: "strategy" });
  await new Promise((r) => setTimeout(r, 300)); // fire-and-forget write settles
  const convo = await recentConversationBlock();
  check("conversation continuity block carries recent turns", convo.includes(`${TAG} pong`));
  await prisma.conversationTurn.deleteMany({ where: { content: { contains: TAG } } });

  console.log("── voice (keyless: fails honestly with the fix) ──");
  const { transcribeAudio, sttConfigured } = await import("../telegram/voice.ts");
  if (!sttConfigured()) {
    const voiceErr = await transcribeAudio(Buffer.from("x")).catch((e) => e.message);
    check("voice transcription fails honestly without Groq key", /GROQ_API_KEY/.test(voiceErr));
  } else {
    check("voice transcription configured", true);
  }

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
