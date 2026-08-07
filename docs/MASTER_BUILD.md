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
ALWAYS stop for Cole's confirm; nothing auto-sends; the gym-boundary guard
fails closed on every acquisition door.

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

- [ ] 1.1 **The Money Ledger** — `Lead` stage enum extend, `MoneyEvent` (state enum, earnedCents, recordedBy), `AttributionEvent`/`TouchPoint`; `earnedCents` sums only `paid` (code invariant). Migration (excise DropIndex blocks). FE: pipeline/ledger card on Business page.
- [ ] 1.2 **The ref-link emitter** — `TrackLink` + `/l/:code` public GET → `/intake?ref=`, click count; publish confirm mints link + hands bio-link URL. `[CFG MEDIA_PUBLIC_BASE_URL]`. FE: the link shown in the publish/queue confirm.
- [ ] 1.3 Self-recording attribution — inbound on a drafted `threadId` flips Lead→replied (extend the 10-min Gmail poll). `[CFG Gmail]`
- [ ] 1.4 Authorship stamp — `OutwardArtifact` (draftId, angleIds, externalId); persist IG `postId` at publish (`contentPublish`); join insights only to stamped posts.
- [ ] 1.5 The `referredBy` fix (`leadEngine.ts:83`) — stop stuffing relationship into referrer.
- [ ] 1.6 The Offer Probe — `probeOffer()` floats 2–3 variants w/ distinct refs; winner → `Offer.active` (Cole's hand). Unlocks `marketingPass.ts:47`. FE: offer panel probe controls. `[Cole: offer promise + candidate prices]`

## WAVE 2 — Lead flow (the cheapest path to the first ten leads)

- [ ] 2.1 **"The Standard" assessment** — public `GET /start` (or `/standard`) page, five numbers → benchmark card in the dichotomy voice → gated POST to `captureInboundLead` w/ ref. Static benchmark table (no model in hot path). Add `assessment`/`website` to LEAD_SOURCES. `[CFG MEDIA_PUBLIC_BASE_URL]` `[Cole: per-sport benchmark bands]`. **FE (public page).**
- [ ] 2.2 Warm-list flow polish + the `referredBy` fix surfaced; CTA guidance. FE: warm list panel (exists).
- [ ] 2.3 The confronting analyst read — deterministic ROI ranker, one truth/week on Mon 07:00 briefing; real-denominator rule. FE: shown in briefing + a read on Business page.
- [ ] 2.4 Money on scoreboard + briefing — reconstructed from ledger+traces; `drafted`≠`paid`; dollars-per-hour-of-confirm hero. FE: scoreboard panel.
- [ ] 2.5 Channel-spend ledger + Cole's-minutes ledger (the analyst's denominators).

## WAVE 3 — The loops (compounding)

- [ ] 3.1 Content outcome→pattern — register missing `content.draft` finalizer; 72h post-publish insights read → reinforce/decay the angle pattern.
- [ ] 3.2 Warm-list follow-up engine — daily sweep drafts overdue follow-ups, angle-tagged, gated send.
- [ ] 3.3 Freshness gate — connector read staleness guard; loops refuse+notify rather than act stale.
- [ ] 3.4 IG insights→attribution wiring — poller matches permalink→media insights; reach becomes leads÷reach.
- [ ] 3.5 Brand ingest — dichotomy template + mantra + voice from `CALHOUN_PERFORMANCE_BRAND.md` into persona/knowledge so drafts speak Calhoun. `[CFG research key for external grounding]`
- [ ] 3.6 llmDependenceRate correctness coupling — corrected reuse un-counts; Sunday shadow-eval; annotate correctionRate.

## WAVE 4 — Retention / referral (built now, dormant until client #1)

- [ ] 4.1 Referral engine — `Referral` model, peak detection (PR/re-sign), ask draft, capture w/ scoped `referredBy`, thank-loop. Dormant-honest.
- [ ] 4.2 Check-in cadence engine — `checkInEveryDays` + `retentionSweep()`.
- [ ] 4.3 Renewal / re-sign watch — draft 21d out, framed w/ lifetime + PRs.
- [ ] 4.4 Progress/PR ledger — `Metric{clientId,label,value,unit,isPR,achievedAt}` on `logSession`; the `isPR` event.
- [ ] 4.5 Proof engine — PR→anonymized case study→`content.draft`→publish (confirm), minor-consent gated.
- [ ] 4.6 Price confrontation + LTV-weighted channel ranker + churn sentinel. Silent until n≥N.
- FE for wave 4: client detail retention view, referral surface, PR log.

## WAVE 5 — Integrations (config-gated, dormant until keys)

- [ ] 5.1 Stripe webhook — signature-verified `/webhooks/stripe` → Payment self-record; Venmo/Zelle email-parse fallback. `[CFG STRIPE_WEBHOOK_SECRET]`. FE: connect + unmatched-payment notice.
- [ ] 5.2 Twilio SMS — inbound webhook self-records against phone identity; outbound confirm-gated. `[CFG Twilio + 10DLC]`. FE: connect + SMS thread.
- [ ] 5.3 Partnership acquisition outreach — research named partners, draft intro (inward), per-partner ref. `[CFG research key]`. FE: partner pipeline.
- [ ] 5.4 Measured paid boost — boost only an organically-proven post; live CPL + kill line; spend = confirm. `[CFG Meta ads token]`. FE: boost proposal + spend/ROI dashboard.

## WAVE 6 — Reliability (the risky core refactors — isolated commits)

- [ ] 6.1 Self-healing supervisor — hourly retry of failed spine jobs; new failed-row claim path; unswallow the six handlers; `await` the six non-awaited; `ranToday` ignores errored; hourly catchUp.
- [ ] 6.2 Restore-verify backups — weekly `pg_restore` into scratch + row-count; throw not `{ok:false}`; mount marker.
- [ ] 6.3 The dedup seam — route executor gate-path create through `surfaceSignal`; stable outreach sourceId (or the Prisma client extension — pick one).
- [ ] 6.4 Retry/backoff in engine adapters.
- [ ] 6.5 Persist push delivery (`pushedAt`); self-watchdog (26h no JobRun → exit); freshness/preflight for volumes.

---

## THE COLE CHECKLIST (assembled as waves land — keys, inputs, actions with how-tos)

*Populated at the end of the build with step-by-step instructions. Placeholder
list of what will be here:* offer promise + prices · per-sport benchmark bands ·
`MEDIA_PUBLIC_BASE_URL` (public origin) · a research key (Tavily/Gemini/SerpAPI) ·
Stripe account + webhook secret · Twilio number + 10DLC · Meta ads token ·
set your IG bio link · `LLM_MONTHLY_BUDGET_USD` · paste the warm list · the
gym-arrangement decision.
