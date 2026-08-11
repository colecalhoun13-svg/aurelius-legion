I have enough to write the coverage-gap report. Here it is.

---

# COVERAGE-GAP AUDIT — the seats the first council never filled

I read SYNTHESIS.md, all 3,576 lines of structure in `smokeSuite.ts` (555 `check()`s across 66 sections), `reachabilityAudit.ts` in full, all 33 migrations, both `package.json`s + lockfiles, and the core write paths. Findings below, each with cite and severity.

## 1. Test-suite QUALITY — **the backbone is thinner than its pass-count implies** (HIGH)

The strong parts are genuinely strong. The money section (`smokeSuite.ts:2414-2500`) is real behavioral testing of real invariants: integer cents, overdue *derived* not stored, partial payment remainder, MRR isolating the monthly shape, cascade self-clean. The keyhole undo (`:1071-1136`) and the failed-job-reclaim (`:2350-2362`) are proper end-to-end assertions.

But two structural weaknesses:

- **~25 checks are grep-in-a-trenchcoat** — `readFileSync(...) + /regex/.test(src)` (e.g. `:2321` "inbox triage refuses to file model-error text" asserts the *string* `engineUnavailableText(replyBody)` exists; `:2339` calendar guard; `:1591` gmail). These verify a guard is *written*, not that it *fires* at runtime. A refactor that keeps the bug but moves the string breaks the test; worse, they pass even if the guarded call site is unreachable.
- **The suite tests primitives in isolation; the council's defects are wiring gaps** — which is exactly the class it structurally misses. Concretely, which council defects **sail right past a green suite**:
  - **Plate-math (`volume.ts` 225 vs 205)** — zero checks reference plate/volume math. Uncaught.
  - **TZ `dayRange`** — no day-window math test; only `:3538` asserting preflight *names* "timezone". Uncaught.
  - **G1 keyhole scope hole** — the keyhole test exercises `chat` origin and `persona` scope guards but **never stages a `system`-scope research proposal** (the actual hole). Suite goes green with the worst path in the repo wide open.
  - **G3 un-defused gmail/paperless/media** — `defuseDirectives` is tested in isolation (`:289-291`); nothing asserts it's *wired* into `ingestDocument`/gmail/`analyzeMedia`. The function works; the missing call site — the vulnerability — is untested.

**`reachabilityAudit.ts` is the best instrument in the repo** — 12 high-signal checks, deliberately no noisy dead-export analysis, catches the skeleton class the smoke suite can't. Its own gap: rule 4 checks `ONCE_PER_DAY` membership but **not catch-up-manifest parity** (see §4), so the three silently-dropped jobs sail past it too.

**Single most important test that doesn't exist:** a mechanical catch-up-parity assertion in `reachabilityAudit` — every `scheduleNamed` job is in the catch-up manifest or explicitly exempted. Runner-up: a constitution red-team check that stages a `system`/`autonomy`-scope research proposal and asserts it does **not** auto-apply.

## 2. Migrations & schema — **disciplined, one cosmetic smell** (fine-as-is)

33 migrations. The DropIndex gotcha is handled *consistently* — every late migration carries the excision note (`offer_artifact`, `content_queue`, `attribution_spine`, … through `targets_sheeturl`). The one live `DROP INDEX IF EXISTS "Memory_metadata_gin_idx"` (`fix_memory_gin_expression`) is a deliberate, `IF EXISTS`-guarded fix. Destructive ops are all justified: the `CompiledPattern` CASCADE drop (`generalize_compilation_schema`) is pre-prod schema generalization; the `DELETE FROM MeasurementSnapshot` (`job_claims_and_snapshot_dedup`) is a correct dedup-before-partial-unique. **Smell:** two migrations named `productivity_plane` 13s apart — `...054745` is **0 bytes** (empty no-op from a botched `migrate dev`), `...054758` holds the real DDL. Harmless, untidy. On the N-query loops the sweeps found: those are application-level N+1s, not missing indexes — the schema indexing is fine; the fix belongs in code, not a migration.

## 3. Dependencies — **dead weight still shipped, one real build risk** (MEDIUM)

- **Dead deps confirmed present, zero `.ts` importers each:** `uuid`, `groq-sdk`, `@google/generative-ai` (grep = 0 importers). Plus unused devDeps `ts-node`, `nodemon` (dev uses `tsx`). Pure supply-chain surface, no benefit — the council flagged them; not yet deleted.
- **Version skew:** backend TS `^6.0.2` vs frontend `^5.4.0`; `@types/node` `^25` vs `26.1.1`; **`@types/react` 19.2.14 against `react` 18.3.1** — React-19 types on an 18 runtime, can emit false type errors or mask real ones. Types-only, low sev, real.
- **`pdf-parse` pinned `1.1.1`** (good it's pinned) but that package is effectively abandoned and 1.1.1 carries the notorious "reads a debug test-file when `module.parent` is falsy" quirk. Replace eventually.
- **Build risk:** frontend `postinstall` does `prisma generate && cp -r ../aurelius/node_modules/.prisma …` — a fragile cross-package filesystem copy that breaks if backend `node_modules` isn't installed first. Real build-order fragility.
- Mitigant: `package-lock.json` exists both sides, so caret ranges are pinned at install. No `@anthropic-ai/sdk` despite Anthropic being primary — it calls raw `fetch` in `anthropicEngine.ts`; not a defect, just notable.

## 4. Data-loss / write-path integrity — **the un-looked-at one** (HIGH)

**Only 2 files in the entire backend use `$transaction`** (`crm/service.ts`, `core/memoryEngine.ts`). The system's core knowledge-write path is not one of them.

**`ingestDocument` (`corpus/ingest.ts:41`) is a 5+-write non-atomic path:** `ingestionRun.create` → `corpusDocument.create` → `embedSource` (N chunk writes) → `update(chunkCount)` → `saveMemory` → `bridgeSignal.create` → `ingestionRun.update`. A crash mid-way leaves partial state. **Worse:** with a `dedupKey` (Telegram media), the dedup anchor is written into `corpusDocument.sourceUrl` *at create time* — so a crash after `doc.create` but before `embedSource` finishes leaves a 0-chunk document that a **retry actively SKIPS** as "already ingested" (`:48-53`). The idempotency guard *prevents the orphan from ever healing* — a permanently-unsearchable document, silently. Concrete and real. (The vault-mirror and debounced-wiki fire-and-forgets below it are correctly non-fatal; `backup.ts` empty catches are just unlink cleanup — fine.)

## 5. Anything else genuinely un-looked-at

- **Rate limiting exists only on `/intake`** (`index.ts:231`), via an **in-memory `Map`** that resets on redeploy and doesn't span instances. Non-public `/api` routes have **no per-caller throttle** — they lean entirely on the API-key lock, which is **dormant by default** (`:179`). A leaked key = unthrottled. (MEDIUM)
- **No PII erasure/retention path for CRM.** `retention_sweep` is business re-sign/referral, not data retention. Corpus has `forgetDocument`; **leads/clients have nothing** — minors' `parentName` + `isMinor` are stored with no deletion policy. Low urgency at zero clients, real. (LOW-MEDIUM)
- **Catch-up parity gap, confirmed mechanically:** 23 `scheduleNamed` jobs, but `content_outcome`, `training_trend_sweep`, `retention_sweep` are **absent from `catchUp.ts`** (grep = 0). A napping Mini silently drops all three — the exact defect the file claims to fix — and nothing tests or audits it. (HIGH, corroborates SYNTHESIS Tier-1 #5.)
- Next `14.2.3` predates several patched middleware CVEs — worth a bump. i18n absent (fine, personal tool). No external error aggregation — only the in-DB trace spine (acceptable for a Mini).

---

## THE HONEST COVERAGE STATEMENT

After two councils and six sweeps, the examination was **deep on features and intent, shallow on failure modes.** Four regions remain genuinely un-rigorously-examined:

1. **Concurrency and crash-recovery of the write paths.** No one traced what a mid-operation crash does to any multi-write. The self-defeating ingest orphan (§4) is proof the region is unexplored, and only 2 of the backend's files are transactional.
2. **The test suite's own trustworthiness.** It was *treated* as the verification backbone but never audited for whether green means correct. ~25 source-regex asserts plus a structural blind spot for wiring gaps mean "555 green" overstates confidence — and the specific G1/plate/TZ/G3 defects prove green today coexists with known open holes.
3. **Runtime under real use.** Everything examined is static-read + smoke on synthetic data. By the synthesis's own words the system "has never had a day of real use" — no load test, no true-concurrency race test, no soak against a funded key.
4. **Dependency/CVE + build supply chain and PII lifecycle** — the Next version, the postinstall copy, the in-memory limiter under an actual attacker, minors' data governance.

**A third pass would need:** (a) a crash-recovery audit of every multi-write, wrapping ingest and the CRM chains in transactions; (b) a meta-audit converting the source-regex checks to behavioral and adding catch-up-parity + constitution red-team tests to `reachabilityAudit`; (c) a real dependency/CVE + build pass; (d) one honest soak/load run against real Postgres and a funded key. The truthful answer to "was this deep enough across the whole code" is: **deep on what the code intends to do, not yet deep on what it does when something fails or when two things happen at once — because nothing has run for real yet.**
