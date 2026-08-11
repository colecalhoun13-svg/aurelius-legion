Full coverage complete — every file in the territory read end-to-end (index.ts, all 25 core/ files, all 8 llm/, all 16 router/, full schema, all 17 scripts including smokeSuite.ts's 3,576 lines). Report follows.

# CORE SPINE — Deep Sweep Report

## Per-module assessment

**index.ts** (entry point, chat endpoint, webhook doors, scheduled spine) — **B+**. Dense but coherent; auth lock, signature-verified webhooks, bounded agentic loop, and honest-failure paths are genuinely well built. Defects below.

**core/schedule.ts** (named registry + JobRun claims) — **A−**. The claim/reclaim state machine (failed=retryable, done=terminal, running=leased) is correct and well-tested. One deliberate trade: on claim-store outage `claimDailyRun` returns true ("availability beats dedup", schedule.ts:85), so a DB outage spanning a cron minute + catch-up sweep can double-fire a briefing.

**core/catchUp.ts** — **B−**, one real hole (finding #1 below).

**core/trace.ts / traceContext.ts** — **A**. ALS threading, start markers, failure paging with 6h dedupe. Page-dedupe map is in-memory, so a crash-looping *process* (restart per crash) pages every restart — arguably correct.

**core/doctor.ts / preflight.ts** — **A**. The best file in the repo; probes what the router actually uses, every failure carries its fix. Two nits: Gemini/FRED keys go in URL query strings (leakable via proxy logs, doctor.ts:168,273), and preflight's reassurance is wrong in one config (finding #3).

**core/bridge.ts / salience.ts** — **A−**. Dedup/escalation logic is careful. `findFirst`-then-`create` dedup is non-atomic — two concurrent surfaces of the same sourceId can both insert (single-process, low risk).

**core/backup.ts** — **A−**. Verifies restorability via `pg_restore --list`, escalates failure to a critical Bridge signal. DATABASE_URL (with password) is passed as a CLI arg — visible in `ps` on a shared box.

**core/db/prisma.ts, watchdog.ts, time.ts, nowContext.ts, connectorFreshness.ts** — **A−/B+**. Sound. One bug in nowContext (finding #5).

**The v3.4 vestigial layer** — engineRegistry/engineRouter/engineTypes/operatorModes/nervousSystem/memoryEngine/operatorHelpers/logger/config.ts, plus router/engineTest.ts, autonomyRouter's `/tick`, and scripts runNervousSystem*/runOperatorModeRecalibration/smokePhase4/seedOperators — **D as a group**. This is a whole parallel "engine/operator" architecture the real system no longer uses (see finding #4).

**llm/router.ts + runLLM.ts + modelConfig.ts** — **A−**. Tier-aware, capability-preserving failover is thoughtful. `FALLBACK_MODELS.anthropic` is hardcoded `"claude-sonnet-5"` while the frontier map respects `ANTHROPIC_CHAT_MODEL` — an account that overrode the default can still fall back to a model it can't reach (router.ts:694 vs 703).

**llm/directiveParser.ts / nativeTools.ts / nonAnswer.ts / pricing.ts / promptMarkers.ts** — **A**. The parser handles code-fence exemption, near-misses, and defusing correctly; pricing's null-not-zero rule is honest by design and self-declared as hand-maintained.

**router/** (14 Express routers) — **A−**. Thin, ordered correctly (static before `/:param` everywhere it matters), OAuth flows carry CSRF state. No real defects found in calendarRouter, gmailRouter, instagramRouter, crmRouter, productivityRouter, proposalsRouter, wikiRouter, missionsRouter, corpusRouter, correctionsRouter, healthRouter, ritualsRouter. operatorRouter.ts (the scoring module) is clean.

**prisma/schema.prisma** — **A**. Money as integer cents, derived-not-stored "overdue", `@@unique([externalRef])` TOCTOU guard on Payment, the `kind` gym-boundary — the schema encodes the business rules. Read in full; nothing wrong found.

**scripts/smokeSuite.ts** — **A−**. 3,576 lines of genuinely load-bearing live-fire assertions; it tests failure paths, races, and idempotency, not happy paths. Two caveats: (a) several cleanup deletes are not TAG-scoped (`deleteMany({sourceType:"inbound_lead"})`, `"outreach_unreachable"`, `"heuristic_confirm"`) — run against a **production** DB this suite would destroy real rows; the sandbox-only contract is stated once, deep in the file. (b) The initiative-dedup check (line 99: `init2 <= init1`) passes even when nothing dedups.

**scripts/reachabilityAudit.ts** — **A**. High-signal, checks invokers not existence. Blind spot: it verifies routers are *mounted*, not that mounted routes do anything (the `/api/autonomy/tick` corpse passes it).

**Other scripts** — repairDegradedWindow (A, careful), backfillEmbeddings (A−), measureEmbeddingFit (A), doctor.ts CLI (A), check-* (fine).

## DEFECTS, ranked

1. **Three scheduled jobs silently unrecoverable after downtime** — `core/catchUp.ts` JOBS omits `retention_sweep` (08:30 daily), `content_outcome` (09:00 daily), and `training_trend_sweep` (Mon 06:50), all of which are in `ONCE_PER_DAY` and scheduled in index.ts. A Mini asleep over those hours loses them for the day/week with no trace — the *exact* defect the file's own comments say the "check-in council" fixed for the Sunday learners. `training_trend_sweep` can't even be expressed: CatchUpJob supports `sundayOnly` but has no Monday concept. Marketing-pass catch-up got a comment calling itself "the only invoker of the whole marketing lane"; retention has the same shape and no entry.

2. **The agentic loop's LLM calls bypass the spend ledger** — index.ts:1177 calls `routeLLM` directly inside the multi-round tool loop; all cost/telemetry recording lives in `runLLM` (runLLM.ts:53-87). Every synthesis round — full system prompt + up to 7KB of tool results, up to 3 rounds per turn, on the most tool-heavy turns — is invisible to `llm_call` logging, the failover doctor check, the scoreboard, and the budget alarm. The budget alarm structurally undercounts exactly the expensive turns.

3. **Preflight lies-in-the-reassuring-direction on prose-only deployments** — preflight.ts:70-73 prints "Everything still answers, via ${live[0]}" when the default tier's key is missing. But routeLLM's capability-preserving failover (router.ts:761-774) excludes groq/deepseek/xai from directive-bearing chains: with only GROQ_API_KEY set, every chat turn's chain is `[anthropic-dead]` → "All configured LLM providers failed", while boot said everything answers.

4. **A dead parallel architecture is still mounted** — `POST /api/autonomy/tick` routes to an engine named `"autonomy"` that `registerAllEngines` never registers (registered names: gpt/gemini/groq/anthropic/deepseek/xai/research/reflection) → always returns "Engine 'autonomy' not found" as a 200. `router/engineTest.ts:65` calls `routeTask(task, ctx)` but the signature is `(task, payload, …)` — the built EngineContext is passed as the *payload* and the engine's userPrompt becomes `JSON.stringify(ctx)`. `buildEngineContext` supplies no-op memory/tools stubs. nervousSystem's mode system (`updateOperatorMode`) is recalibrated by a script that hardcodes stats to 0/0, so it always outputs "normal". None of this can harm the live spine, but it reads like a feature and is a maintenance trap.

5. **NOW-block day window is UTC-anchored to a local date** — nowContext.ts:59 builds `start = new Date(\`${dstr}T00:00:00.000Z\`)` from `operatorToday()` (local date). In America/Chicago, "today's deck" and "overdue" counts cover 19:00-yesterday→19:00-today local; an evening task scheduled after 18:00 local counts as tomorrow. Every prompt's task-load line is off at the day edges.

6. **Unbounded/unpruned `intakeHits` map** — index.ts:230: entries are never evicted; a bot rotating IPs against the public `/intake` grows process memory without bound. Also the media path (index.ts:848-868) folds vision-model transcriptions into the prompt without `defuseDirectives` — an image containing directive text is an (indirect, model-mediated) injection surface the RSS/email paths already defend against.

## Territory summary

**Load-bearing risks for an always-on second operator:** (a) downtime recovery has holes (finding #1) in a system whose whole premise is "the spine survives naps"; (b) the spend/telemetry blind spot (#2) grows with exactly the autonomy Cole grants; (c) the availability-beats-dedup claim fallback means a flaky DB morning can double-send briefings; (d) prod-unsafe smoke cleanup means one wrong DATABASE_URL during "verify live" deletes real Bridge/lead rows; (e) preflight's false reassurance (#3) is the same genus as the ANTHROPIC-key week the repo keeps memorializing.

**Top 3 improvement opportunities:** (1) Generate catchUp's JOBS from a single spine manifest shared with index.ts and `ONCE_PER_DAY` — three copies of the job roster is how #1 happened, and the reachability audit could then enforce parity mechanically. (2) Route the agentic loop through `runLLM` (or extract the telemetry into routeLLM) so every model call is priced; add a smoke assertion that no non-runLLM `routeLLM` call sites exist outside runLLM itself. (3) Delete the v3.4 layer (engineRouter/engineTest/nervousSystem/operatorModes + their scripts, `/api/autonomy/tick`) — the repo's own "unreachable code that reads like a feature" rule, applied to ~600 lines of it.

Overall: this territory is unusually honest, self-documenting, and well-verified — grade A− as a whole — but its failure-recovery story has drifted behind its schedule roster, and its cost instrumentation has a hole precisely where autonomy spends the most.
