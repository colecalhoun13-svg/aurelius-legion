All 78 files in the territory read in full, with caller-graph verification for the loops. Report follows.

# THE MIND — deep sweep report

## Module inventory (purpose · grade)

**autonomy/** — `actionClasses.ts` (grantability taxonomy, **A**: checkGrantable is genuinely airtight — outward/neverGrant/domain/`autonomy.`-prefix all refused; defense-in-depth string check at `actionClasses.ts:225`). `grants.ts` (grant store, **A-**: double-locked via checkGrantable on both write and read). `executor.ts` (act-or-gate wrapper, **A-**: atomic pending→acting claims, whitelist confirm states, tier-aware boot reaper, real receipts). `registerActions.ts` (**B+**: all 13 declared classes have finalizers; only 3 have inverses — `inbox.triage_draft` and `knowledge` writes via sweep lack undo where the receipt text implies it). `trustLedger.ts` (**B+**: loop now closed — briefing/scoreboard push suggestions with cooldown). `initiative.ts` (**A-**), `capabilityGaps.ts` (**B+**: depends on toolEngine writing `metadata.status="failed"`), `pulse.ts` (**B**), workflows (**A-**, inboxTriage defuses inbound mail and guards hard-rule-3). Legacy scaffold: `decisionEngine.ts`, `taskPlanner.ts`, `stateStore.ts`, `autonomyConfig.ts`, `autonomyTypes.ts`, `types.ts`, `autonomyEngineDB.ts` — **D**, dead or script-only (see dead code). `reflectionEngine.ts` **C+**: live via engine registry but `reflect()` never consults compiled patterns or recall — a parallel, shallower brain.

**knowledge/** — `store.ts` (**A-**: optimistic-concurrency versioning, global fallback). `proposals.ts` (**B+**: atomic claim + claimWon marker are excellent; see defect 1). `queueSweep.ts` (**A-**: eligibility/expiry mutual-exclusion handled). `corrections.ts` (**A-**), `freshness.ts` (**A-**), `intentClasses.ts` (**B**), `seed.ts`/`foundationalTrainingKnowledge.ts` (**A**).

**compiled/** — `detector.ts` (**B-**, defect 2), `outcomeLoop.ts` (**A-**: decay/ratify/floor/confirmed-rule protection all real), `mirror.ts` (**A-**: why→correct→ratify loop is wired into index.ts), `chatCompiler.ts` (**B+**), `semanticReuse.ts` (**B**, defect 3), `patternIndex.ts` (**A-**), `shortCircuit.ts` (**A**: shadow-mode honesty is exemplary — `llmCallsAvoided` stays 0), `cache.ts`/`similarity.ts`/`types.ts` (**B+**), `reasoningHelper.ts` (**B+**: fit-ranked pattern loading with fired-out-param, wired to router).

**memory/** — `memoryService.ts` (**B**: keyword-tier retrieval is O(keywords) queries; fine at scale today), `conversation.ts` (**A-**), `memoryEvolutionEngine.ts` (**C**: thin adapter over memoryEvolution/, no persistence of synthesis output visible here).

**retrieval/** — **A-** across the board: model-scoped cosine search, stale-tail-chunk GC, loud keyless warning (`embeddingAdapter.ts:162-174` directly answers "mock-mode blindness" — it fails loudly now). Mock provider requires explicit `EMBEDDINGS_PROVIDER=mock`, never implicit.

**corpus/** — `ingest.ts` (**A-**: four writes + forget path), `inboxWatcher.ts` (**A**: stability gate, vault-overlap refusal, defused names+bodies), `upload.ts` (**A-**), `rssIngest.ts` (**B+**), `paperlessPoller.ts` (**B**, defect 4), `ask.ts` (**B**, defect 5).

**persona/** — `observer.ts` (**B+**: deterministic, propose-only, `origin:"observer"` keeps it out of the keyhole — constitution respected). `aureliusPersona.ts` (**B+**: strong anti-fabrication contract).

**wiki/** — `engine.ts` (**B**, defect 6), `vaultMirror.ts` (**A-**), `livingDocs.ts` (**A-**).

**missions/** (**B+**, minor race below) · **council/** `deliberate.ts` (**A-**, wired via index.ts) · **operators/** `operatorCores.ts` (**B**, live via research/reflection), 15 stub files (**D**, dead).

## Defects (by severity)

1. **Keyhole scope blocklist omits `system` — LLM-controlled scope reaches an auto-apply path.** `proposals.ts:167` guards only `scope !== "autonomy" && scope !== "persona"`; `queueSweep.ts:52` mirrors the same pair. But `researchEngine.ts:453` passes `d.scope` **verbatim from an LLM-emitted directive**, origin `"research"` → keyhole-eligible. Research prompts consume external web/corpus text, so an injected source can steer the model to emit `scope:"system", key:"paperless_cursor"` (or the mirror context) — auto-applied under the grant, and `setKnowledge→indexKnowledgeEntry` (`store.ts:219`) then **embeds the system-scope value into the vector index**, the exact thing hard rule 6 and mirror.ts ("scope=system … never embedded") say must never happen. One-line fix: add `system` to both blocklists and skip indexing for `scope==="system"` in store.ts.

2. **Re-detection silently undoes outcome-loop decay.** `detector.ts:160`: on an existing pattern, `confidenceScore: Math.max(existing.confidenceScore, p.confidenceScore)`. A confirmed heuristic decayed by corrections (0.5→0.38 via `outcomeLoop.ts` DECAY_STEP) is restored to ≥0.6 the next time three similar chat turns fire `detectHeuristics` — Cole's punishment signal is overwritten by mere repetition. The asymmetry ("one correction outweighs quiet weeks") is defeated by the write path the loop doesn't know about.

3. **Corrected cached answers keep being served.** `corrections.ts:96` stamps `correctedAt` on a corrected reuse, but `semanticReuse.ts:tryReuseAnswer` (lines 53-69) never filters `correctedAt: null` — only the scoreboard reads the stamp. A wrong answer Cole explicitly corrected is re-served verbatim for up to 14 days at ≥0.93 similarity.

4. **Paperless is the one ingest door with no defuse.** `paperlessPoller.ts:76-88` passes OCR'd content to `ingestDocument` raw; rss (`rssIngest.ts:72`), upload (`upload.ts:84`), and inbox (`inboxWatcher.ts:148`) all defuse. RSS's own comment ("the one door that skipped it") is now false — Paperless is that door. Recall defuses at render, but `ask.ts:46` and `missions/engine.ts:138` inject raw `chunkText` into prompts (5), and wiki synthesis renders raw summaries — directive execution is blocked at the choke points (extractDirectives strips), but content-steering injection is live through a scanned document.

6. **Wiki cross-domain bleed.** `wiki/engine.ts:32-38`: `gatherDomainMaterial` scopes docs by domain but pulls the 25 most-recent memories and knowledge entries **globally** — every domain page synthesizes from the same memory pool, so business noise steers training_science and one poisoned doc's ingest-memory reaches all five living documents.

7. Minor: `missions/engine.ts` — `planMission` writes status back to `"planned"` (line 123) after `runMission`'s claim set `"running"`, reopening a small double-run window the claim exists to close. `persona/observer.ts:53` uses server-TZ `getHours()` (peak-hours proposal wrong under UTC hosting). `rssIngest.ts` parses only RSS `<item>` — Atom feeds yield silent zero forever (violates dormant-vs-broken honesty). `detector.ts:265` theme guard rejects any line containing "error".

## Dead code

`autonomy/decisionEngine.ts` + `taskPlanner.ts` + `autonomyTypes.ts` + `autonomyConfig.ts` + `stateStore.ts` + `types.ts`: no importers outside each other (decisionEngine also crashes on undefined `history` at line 34 — evidence it never runs). `autonomyEngineDB.ts` reachable only via `scripts/runNervousSystem*.ts`, and it marks goals "completed" without doing work — the "logs phase names" scaffold pulse.ts's header disavows. All 15 `operator_*` stub files (tasks/goal/research/content/…): zero importers. `operators/strategy.ts`: zero importers. `memory/memoryEvolutionEngine.ts` is registered but its synthesis result is returned, not persisted. Roughly 600 lines of pre-v4 scaffolding worth deleting.

## Doc drift

Small: CLAUDE.md's schedule and prompt-assembly description match the code precisely (verified against router callers, sweeps, mirror). Drift found: rssIngest's "one door that skipped it" comment (Paperless now skips it); `reasoningHelper.ts` header still describes the pre-fit-ranker world in places; `pulse.ts` header says "nothing auto-applies" which predates the keyhole (proposals from its research runs are `origin:"research"` and do auto-apply under grant).

## Five most important findings

1. Keyhole blocklist omits `system` scope + system-scope values get embedded (constitution/rule-6 gap, injection-reachable) — proposals.ts:167, queueSweep.ts:52, store.ts:219.
2. `Math.max` re-detection erases trust decay — detector.ts:160 — the learning loop's error signal leaks back out.
3. Corrected reuse keeps serving — semanticReuse.ts (no `correctedAt` filter).
4. Paperless ingest undefused + raw chunkText in ask/mission prompts — content-steering injection surface.
5. Wiki synthesis pulls memories/knowledge unscoped by domain — cross-domain contamination of the five living documents.

## Does this mind learn and act, or file papers?

It genuinely learns and acts — with real teeth, not paperwork. The gate architecture (checkGrantable → decideAction → executeAction → receipt/undo) is enforced at every entry I traced; outward actions cannot be granted by any code path; the confirm loop is concurrency-safe; the mirror/mailbox correction loop, outcome decay, ratification counters, and the shadow-mode short-circuit are all wired into the live router (verified callers in index.ts and llm/router.ts). Learned data is read, not just written: patterns load into prompts fit-ranked, cache reuse serves, wiki pages embed into recall, grant suggestions push. The honest caveat: three feedback wires leak (defects 2 and 3 let punished knowledge resurface, defect 1 lets an LLM choose its own write scope), and a legacy 600-line "autonomy" scaffold that only files papers is still in the tree pretending to be the mind's older brother.

## Three best opportunities

1. **Close the trust-integrity trio** (defects 1-3): add `system` to both keyhole blocklists + skip system-scope embedding; make detector.ts respect existing confidence (never raise on update, or route through `adjustPatternConfidence`); filter `correctedAt: null` in tryReuseAnswer. ~15 lines total, eliminates every path where the mind un-learns a correction.
2. **Uniform defuse-at-ingest**: one `defuseDirectives` call in `ingestDocument` itself (instead of per-door) closes Paperless, ask, missions, and wiki in a single move and makes the invariant structural.
3. **Delete the legacy scaffold** (decisionEngine/taskPlanner/stateStore/operator stubs/autonomyEngineDB chain) and domain-scope `gatherDomainMaterial` — the mind's real learning surface gets smaller, cleaner, and the wiki pages stop cross-contaminating.
