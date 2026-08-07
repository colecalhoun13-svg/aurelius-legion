# MASTER BUILD — all four roadmaps, one dependency-ordered spine

The unification of: `ROADMAP_TO_NINE.md` (foundation 4→7), `ROADMAP_8_9_10.md`
(the Jarvis loops), `ROADMAP_DEMAND_ENGINE.md` (lead generation), and the
`CALHOUN_PERFORMANCE_BRAND.md` brand. Cole's call: **full send, include the
risky refactors, frontend for everything, perfect — don't miss a thing.**

Status keys: `[ ]` todo · `[~]` in progress · `[x]` done+verified ·
`[CFG]` needs a Cole-supplied key/input to go live (built dormant-honest).
Every wave ends with the gate: `smokeSuite` + `tsc` both sides + prod `next
build` + `reachabilityAudit`, and updates the Cole checklist (§ at bottom).

The rule for the whole build (CLAUDE.md): outward actions (send/publish/spend)
ALWAYS stop for Cole's confirm; nothing auto-sends. The gym boundary (Cole's
employer's athletes are off-limits) is enforced by the drafting prompts and the
business facts in `profile.ts`, plus Cole controlling who enters the warm list —
it is NOT a code-level filter that mechanically rejects a gym athlete at intake
(there is no gym roster to check against). Honest scope, not a fail-closed guard:
if that boundary ever needs to be mechanical, it has to be built.

---

## WAVE 0 — Foundation truth (the base everything stacks on)

- [x] 0.1 Bridge severity sort — rank map, not string desc (`productivity/service.ts:271`). FE: deck/decisions order.
- [x] 0.2 Badge counts decisions only (`api/nav/badges/route.ts`) + deck rank/collapse/split decisions vs receipts (`getDeck`, `home` + `SignalsBench`). **FE.**
- [x] 0.3 Expire `noted` — both `updateMany` filters (`queueSweep.ts`) — SHIP WITH any schema default change (binding).
- [x] 0.4 Receipt reversibility truth — read inverse registry (`executor.ts:91`).
- [x] 0.5 `recommendation`→`opportunity` kind (`marketingPass.ts`) + `marketing_pass`→`catchUp` JOBS.
- [x] 0.6 `"serp"`→`"serpapi"` + retype param (`marketing.ts:96`).
- [x] 0.7 `chatCompiler` guard — import `engineUnavailableText`, raise floor (`chatCompiler.ts:31`).
- [x] 0.8 Risk line: hoist `hasActiveOffer`, reorder, shared inputs on the phone path (`productivity/service.ts`).
- [x] 0.9 Delete the 12h window from the gated-ask count (`rituals/engine.ts:143`).
- [x] 0.10 `/business` on mobile — `more` GROUPS + `MobileTabBar` also-list. **FE.**
- [x] 0.11 Complete `ACTION_CLASSES` (declare pattern.*/autonomy.apply_grant), throw on unregistered, delete dead `systems.sop_draft`. FE: autonomy dial.
- [x] 0.12 reachabilityAudit new rules (grantable→site, finalizer→class, vocab literals, `any` at vocab boundary) as smoke failures.

## WAVE 1 — The shared spine (root of Jarvis + Demand)

- [x] 1.1 **The Money Ledger** — `Lead` stage enum extend, `MoneyEvent` (state enum, earnedCents, recordedBy), `AttributionEvent`/`TouchPoint`; `earnedCents` sums only `paid` (code invariant). Migration (excise DropIndex blocks). FE: pipeline/ledger card on Business page.
- [x] 1.2 **The ref-link emitter** — `TrackLink` + `/l/:code` public GET → `/intake?ref=`, click count; publish confirm mints link + hands bio-link URL. `[CFG MEDIA_PUBLIC_BASE_URL]`. FE: the link shown in the publish/queue confirm.
- [x] 1.3 Self-recording attribution — inbound on a drafted `threadId` flips Lead→replied (extend the 10-min Gmail poll). `[CFG Gmail]`
- [x] 1.4 Authorship stamp — `OutwardArtifact` (draftId, angleIds, externalId); persist IG `postId` at publish (`contentPublish`); join insights only to stamped posts.
- [x] 1.5 The `referredBy` fix (`leadEngine.ts:83`) — stop stuffing relationship into referrer.
- [x] 1.6 The Offer Probe — `probeOffer()` floats 2–3 variants w/ distinct refs; winner → `Offer.active` (Cole's hand). Unlocks `marketingPass.ts:47`. FE: offer panel probe controls. `[Cole: offer promise + candidate prices]`

## WAVE 2 — Lead flow (the cheapest path to the first ten leads)

- [x] 2.1 **"The Standard" assessment** — public `/standard` page (2-phase: numbers→benchmark card in the dichotomy voice→gated capture w/ ref), pure static bands (`assessment/benchmarks.ts`), `/api/standard` + middleware public + `assessment` in LEAD_SOURCES. `[Cole: per-sport benchmark bands]`. **FE (public page).**
- [x] 2.2 Warm-list flow: the `referredBy` fix (Wave 1.5) is the substance; panel + empty-state CTA guidance exist on the Business page.
- [x] 2.3 The confronting analyst read (`business/analyst.ts`) — deterministic ranker on real click/lead/earned denominators, one truth/week on the Mon briefing, real-denominator floor. FE: "The read" panel on Business page.
- [x] 2.4 Money on scoreboard + briefing — earned (arrived) vs leads (motion), drafted≠paid, distinct on the scoreboard panel + Business ledger card. (Hero framed as earned-vs-motion, not fabricated confirm-hours.)
- [~] 2.5 Denominators: clicks + leads are the real ones the analyst uses; channel-spend wired as $0-ready for Wave 5 paid ads. Cole's-minutes precise tracker deferred (no honest data source yet — not built speculatively).

## WAVE 3 — The loops (compounding)

- [x] 3.1 Content outcome→pattern — register missing `content.draft` finalizer; 72h post-publish insights read → reinforce/decay the angle pattern.
- [x] 3.2 Warm-list follow-up engine — daily sweep drafts overdue follow-ups, angle-tagged, gated send.
- [x] 3.3 Freshness gate — connector read staleness guard; loops refuse+notify rather than act stale.
- [x] 3.4 IG insights→attribution wiring — poller matches permalink→media insights; reach becomes leads÷reach.
- [x] 3.5 Brand ingest — dichotomy template + mantra + voice from `CALHOUN_PERFORMANCE_BRAND.md` into persona/knowledge so drafts speak Calhoun. `[CFG research key for external grounding]`
- [x] 3.6 llmDependenceRate correctness coupling — corrected reuse un-counts; Sunday shadow-eval; annotate correctionRate.

## WAVE 4 — Retention / referral (built now, dormant until client #1)

- [x] 4.1 Referral engine — `Referral` model, peak detection (PR/re-sign), ask draft, capture w/ scoped `referredBy`, thank-loop. Dormant-honest.
- [x] 4.2 Check-in cadence engine — `checkInEveryDays` + `retentionSweep()`.
- [x] 4.3 Renewal / re-sign watch — draft 21d out, framed w/ lifetime + PRs.
- [x] 4.4 Progress/PR ledger — `Metric{clientId,label,value,unit,isPR,achievedAt}` on `logSession`; the `isPR` event.
- [x] 4.5 Proof engine — PR→anonymized case study→`content.draft`→publish (confirm), minor-consent gated.
- [x] 4.6 Price confrontation + LTV-weighted channel ranker + churn sentinel. Silent until n≥N.
- FE for wave 4: client detail retention view, referral surface, PR log.

## WAVE 5 — Integrations (config-gated, dormant until keys)

- [x] 5.1 Stripe webhook — signature-verified `/webhooks/stripe` → Payment self-record; Venmo/Zelle email-parse fallback. `[CFG STRIPE_WEBHOOK_SECRET]`. FE: connect + unmatched-payment notice.
- [x] 5.2 Twilio SMS — inbound webhook self-records against phone identity; outbound confirm-gated. `[CFG Twilio + 10DLC]`. FE: connect + SMS thread.
- [x] 5.3 Partnership acquisition outreach — research named partners, draft intro (inward), per-partner ref. `[CFG research key]`. FE: partner pipeline.
- [x] 5.4 Measured paid boost — boost only an organically-proven post; live CPL + kill line; spend = confirm. `[CFG Meta ads token]`. FE: boost proposal + spend/ROI dashboard.

## WAVE 6 — Reliability (the risky core refactors — isolated commits)

- [x] 6.1 Self-healing supervisor — `withDailyClaim` records a failed run without re-throwing; unswallowed the 16 Pattern-A handlers + awaited the 6 non-awaited so failures record `failed`; `ranToday` is JobRun-status-authoritative (a failed run retries); catch-up now runs HOURLY, not boot-only.
- [x] 6.2 Restore-verify backups — `pg_restore --list` integrity check (not just a byte floor) + a mount-marker write-test; the `db_backup` handler THROWS on `!ok` so the run records `failed`.
- [x] 6.3 The dedup seam — the executor gate path routes through `surfaceSignal` (dedup on sourceType+sourceId) and pushes as an ASK (Confirm/Dismiss) via `pushBridgeAsk`; a repeated gated ask collapses to one pending signal.
- [x] 6.4 Retry/backoff — `fetchWithRetry` (exp backoff + jitter, honours Retry-After, retries 429/529/5xx) in the shared adapter, applied to the primary Anthropic engine.
- [x] 6.5 Persist push delivery (`BridgeSignal.pushedAt`, set on delivery) + a self-watchdog (`core/watchdog.ts`: exits if no JobRun in 26h, uptime-guarded so a healthy boot is safe).

---

## THE COLE CHECKLIST — delivered

Full step-by-step instructions live in **`docs/COLE_CHECKLIST.md`** — 16 items in
priority order (Part A: no-key do-nows · Part B: keys that unlock engines · Part
C: inputs that sharpen), each with what it unlocks, how to do it, and where the
value shows up. Covers: warm list · offer + prices · gym-arrangement · IG bio
link · `ANTHROPIC_API_KEY` · `APP_PUBLIC_URL` · `MEDIA_PUBLIC_BASE_URL` · a
research key · Instagram · Gmail · Stripe · Twilio + 10DLC · Meta ads ·
`LLM_MONTHLY_BUDGET_USD` · `APP_UNLOCK_SECRET` · per-sport benchmark bands ·
Calendar.
