All disputed claims verified. Here is THE CARTOGRAPHER'S round-2 delivery.

---

# THE CARTOGRAPHER — ROUND 2: Verdicts, Revised Ledger, Final Map

*Every adjudication below re-verified in code today. The frontend sweep is still in flight; items marked ⚑ depend on it.*

## 1. CROSS-EXAMINATION — verdicts on the record's conflicts

**Retrieval: mind sweep (A-, "fails loudly") vs Archivist ("confidently blind").** Both cite `retrieval/embeddingAdapter.ts`; both are right about *different* failure modes, and the Archivist's is the one that matters. Keyless genuinely fails loudly once (`:162-174`) — mind sweep correct. But mock is returned with **zero runtime warning** (`:180`), its own comment conceding "similar texts do NOT map to similar vectors… useless for semantic quality" (`:115-118`), and CLAUDE.md documents mock as the sandbox default. The tools page does label it `partial (MOCK)` (`integrationStatus.ts:186-188`) — so "the system hides it" is false, but "recall serves confident noise under the deployed default" is true. **Verdict: grade the code A-, grade deployed recall unusable-until-keyed. The Archivist's actionable residue stands: nothing at retrieval time flags mock results.**

**Business-stack sweep's reachability findings: WRONG, systematically.** The sweep declared `assessStandard`/`summarizeStandard`, `stageBoost`, and `researchPartners`/`draftPartnerIntro` dead code ("smokeSuite only"). It never grepped `frontend/`. Verified: `frontend/app/api/standard/route.ts:48` calls `assessStandard`, fed by the public `/standard` page (exempted in `middleware.ts:24-25`); `frontend/app/api/crm/growth/route.ts` invokes `stageBoost`, `researchPartners`, and `draftPartnerIntro`, fetched by the Business page (`page.tsx:1817,1824`). **The Standard lead magnet and the growth panel are live, exactly as the Business seat and my round-1 map said.** ⚑ (frontend sweep should confirm the UI controls render). However, the sweep's *phantom-spend* defect survives adjudication: `finalizeBoost` (`paidBoost.ts:113-128`) records an `ad_spend` row on Cole's confirm with the Meta API call explicitly unwired — once `META_ADS_TOKEN` lands, the ledger books money that never moved. Real defect, wrong headline.

**Steward vs middleware ⚑.** "The frontend confirm route carries no caller authentication" is **overstated**: `frontend/middleware.ts` gates every non-public `/api` route behind the HMAC unlock cookie when `APP_UNLOCK_SECRET` is set; the confirm route is not exempted. Unset secret = open, but that is rule-4 dormant and runbook-mandatory. His structural finding, though, is **confirmed and converges with the mind sweep on the same choke point**: the `knowledge.apply_proposal` finalizer (`registerActions.ts:100-121`) confirms *any* pending proposalId with no scope/origin check — the constitutional guards live only in callers (`proposals.ts:166-167`, `queueSweep.ts:51-54`) — while the mind sweep proved those caller blocklists omit `system` scope, `researchEngine.ts:449-459` passes an LLM-emitted scope verbatim with keyhole-eligible `origin:"research"`, and `store.ts:219` embeds every knowledge write, system scope included, into the vector index (rule-6 breach). **Two independent seats found two halves of one hole. One fix: enforce scope/origin inside the finalizer, add `system` to both blocklists, skip indexing system scope.**

**Contrarian's kill list: stale in two places.** `content.draft` is live (finalizer `registerActions.ts:35`, inverse `:47`, call site `content.ts:112` — already adjudicated at the 2026-08-06 council) and `systems.sop_draft` **no longer exists** (grep of `aurelius/`: zero). His `engineRouter` deletion is right and now fully evidenced by sweep 01 (`/api/autonomy/tick` routes to an engine that's never registered). Spine count, precisely: **23 `scheduleNamed` entries + 2 pollers** (his ~22, my 24 — both off by one).

**Operator's three defects: all confirmed.** `recordTurns` fires only from chat endpoints (`index.ts:886,925,1411`) — rituals are amnesiac; no `sendChatAction` anywhere; and `rituals/engine.ts:90-100` creates its BridgeSignal without `status`, so the schema default `"pending"` (`schema.prisma:401`) is counted by the badge (`nav/badges/route.ts:21`) — every briefing and debrief inflates the decision count.

**Engineer's delivery-blindness: confirmed at every link.** `sendToCole` returns false, never throws (`bot.ts:210-227`); `runTraced` writes `ok` and pings Healthchecks on trace success (`trace.ts:126-132`); the morning briefing wraps both (`index.ts:1711-1716`). The external monitor certifies briefings Cole never received.

## 2. REVISED LEDGER — verified corrections to my round-1 map

- **"Full scheduled spine LIVE" gets an asterisk**: `core/catchUp.ts` (20 entries) omits `retention_sweep`, `content_outcome`, `training_trend_sweep` — three registered, claimed jobs that vanish silently after any downtime. Verified.
- **New DRIFTED-in-code class I missed**: agentic-loop LLM calls bypass all telemetry — `index.ts:1177` calls `routeLLM` directly; `llm_call` logging exists only in `runLLM.ts:61`. The budget alarm undercounts the most expensive turns.
- **Un-learning paths** (missed entirely): `detector.ts:160` `Math.max` restores decayed confidence on re-detection; `semanticReuse.ts` has no `correctedAt` filter (grep: zero) — corrected answers re-serve for 14 days.
- **The UTC day-window family**: `productivity/service.ts:20-24` builds "today" as UTC bounds; `runMiddayCheck` repeats the pattern (`tools.ts:488-490`) and reads **no calendar at all** (`:492-501`) — Hole-finder's scenario-1 confirmed.
- **Dead weight, verified**: the v3.4 layer (~600 lines: engineRouter/nervousSystem/operatorModes/decisionEngine/taskPlanner/15 operator stubs) plus `volume.ts`'s plate-math doc/code contradiction (`:106` says 115, `:131` computes 205) and the un-defused Gmail adapter (only `web.ts` and `googleSheets.ts` defuse among adapters).
- **Gym boundary**: `moneyLedger` (`ledger.ts:40-53`) aggregates all payments with no `kind` filter — the one true "exclusion in the query" miss. Verified.

## 3. FINAL MAP

**Genuinely live:** the 23-job spine (with the catch-up asterisk), executor/keyhole/undo, CRM+Lead engine, public `/standard`+`/start`+`/intake`+growth panel, content lane through staging, compiled-pattern loop, chat compiler, battery/record wall, quiet mode, capture-split. **One-unblock dormant:** Telegram+Groq, Gemini embeddings+backfill, Google OAuth trio, `MEDIA_PUBLIC_BASE_URL`/`APP_PUBLIC_URL`, warm list + one priced offer, first grants. **Dead weight to delete:** the v3.4 layer and autonomy legacy scaffold (~600+ lines), `serpSearchAdapter`, duplicate `business.draft_offer` block, dead deps (uuid, groq-sdk, @google/generative-ai). **Docs to rewrite:** NORTH_STAR §4/§6 body (inverted by its own appendix), ROADMAP_TO_NINE §0 (stamp superseded), CLAUDE.md spine (add three jobs), `.env.example` (materially incomplete incl. `AURELIUS_API_KEY`).

## 4. TOP 10 FOR COLE

1. **Fuel, not features** — mock embeddings + zero grants + empty warm list idle every learning loop. *Evidence: `embeddingAdapter.ts:115-118`'s own admission.*
2. **Delivery-verified pushes** — trace `ok` + Healthchecks ping fire on undelivered briefings. *`trace.ts:126-132` + `bot.ts:210-227`.*
3. **Keyhole choke-point hardening** — LLM-chosen `system` scope can auto-apply and get embedded. *`researchEngine.ts:453` → `proposals.ts:167` → `store.ts:219`.*
4. **The UTC day-window fix** — evening sessions invisible to Today/briefing/midday. *`service.ts:20-24`.*
5. **Catch-up parity** — three jobs unrecoverable after naps on a machine meant to nap. *`catchUp.ts` (20 entries vs 23 registered).*
6. **Ritual conversational closure** — rituals never enter conversation memory; badge inflated 2/day. *`recordTurns` callers + `rituals/engine.ts:90-100`.*
7. **Un-learning trio** — decay overwritten, corrected answers re-served. *`detector.ts:160`; no `correctedAt` in `semanticReuse.ts`.*
8. **Gmail defuse** — the cheapest hostile channel feeds an immediate-execution tool loop raw. *`gmail.ts:49-67` vs `web.ts:92`.*
9. **Spend-ledger blind spot** — the agentic loop is invisible to the budget alarm. *`index.ts:1177` vs `runLLM.ts:61`.*
10. **Delete the dead architecture** — a mounted route that always 200s an error is a feature-shaped trap. *`/api/autonomy/tick` → unregistered engine.*

The map's one-sentence verdict stands, sharpened: **the machine is real and mostly honest, starved of fuel, blind in exactly the reassuring direction — and the sweeps' worst "dead code" claims were themselves dead wrong because they never looked at the frontend, which is why the frontend sweep must land before synthesis.**
