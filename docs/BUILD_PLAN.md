# Aurelius Build Plan

> **Operator Roadmap — October 2026.** Converted from the *Aurelius Build Plan*
> PDF (handoff to Claude Code). This doc ADDS to the existing docs; it does not
> replace them. Two edits were made on conversion, both marked inline:
> **Release 0 (Front door)** was prepended before Release 1, and **Releases 7–9**
> are marked **candidate scope** (decided after day 90 on measured need).
>
> *Provenance note:* the PDF referenced specs in `docs/SUPER_JARVIS_PLAN.md`
> (P-SEC, P1, P3). **That file does not exist in the repo** (only
> `SUPER_JARVIS_ROADMAP.md` does, which uses `#1–67` IDs). Release 0's specs
> below were therefore authored from the verified audit evidence
> (`STATE_OF_AURELIUS.md`) and the security work already done (PR #91), not
> copied from a P-SEC/P1/P3 file. See `PLANS_INDEX.md`.
>
> The prior `BUILD_PLAN.md` (the 2026-08-12 wave-routing map) was preserved at
> `docs/BUILD_PLAN_WAVES_2026-08.md` — nothing was lost.

**Basis:** repository audit, AURELIUS v3 and v3.4, the repo North Star.
**Governing metric:** verified outcomes rise while daily interruptions and
operating time fall.

---

## Executive decision — finish the loops before adding more intelligence

Aurelius already has more components than a normal assistant. Its ceiling is not
blocked by another model, tool, or dashboard — it is blocked because the pieces
do not yet complete work as one reliable loop.

**The core test:** a plain-language mission should become a plan, a real action,
a verification, and a short report — without Cole babysitting the middle.

- **Operator score today: 4/10** — strong foundation, weak continuous execution.
- **Daily attention ceiling: <30m** — a design target to measure, not a promise.
- **One outward engine at a time** — stabilize content, then activate outbound.

**The nine-part build:** 1 Trust · 2 Perception · 3 Assistant · 4 Content ·
5 Lead generation · 6 Knowledge/research · 7 Voice · 8 Browser execution ·
9 Self-upgrade. **Objective correction:** do not light content and lead
generation simultaneously — build their shared spine together, release content
first, then outbound after the first loop is stable.

## Current state — the foundation is real; the operator loop is not

| Area | What exists | What blocks Jarvis-level use |
|---|---|---|
| Safety | Grants, atomic confirm/undo, outward controls | Irreversible **inward** actions not consistently gated; some non-idempotent retries can double-execute |
| Memory | Versioned Living Knowledge, propose-confirm, correction propagation | Confirmed knowledge not reliably injected into later decisions; recall misses invisible |
| Tools | ~148 actions across 15 adapters, traces, persisted calls | Request-driven; missions don't carry actions through verification |
| Scheduling | Many production jobs run; inbox watching scheduled | `runNervousSystemTick` has no production invoker |
| Frontend | Real routes, API-backed surfaces, no mocks | Shows capability more than completed outcomes |
| Business | Lead/Client foundations, content actions, careful money | No complete acquisition loop; payment/txn idempotency needs hardening |
| Voice | Speech in + generated speech out | Not low-latency, interruptible, full-brain conversation |
| Self-upgrade | A `self/` concept exists | Dead code, not a tested improvement cycle |

**Do not misdiagnose:** Aurelius is weak not from missing features but because
too much code has no reliable invoker, closure condition, or verification step.
**Preserve what's good:** the safety architecture, durable memory writes,
provider fallback, tracing, money model, and real frontend. Build *through* them.

## Target architecture — every signal ends in a verified outcome or a deliberate no-op

`Signals → Perceive → Decide → Act → Verify → Report → Learn → Remember → Improve`

**Autonomy by consequence:** Automatic (read/analyze/classify/draft/stage
reversible internal change) · Grantable (reversible inward within a Cole-approved
scope) · Always confirm (send/publish/spend/delete/overwrite/disclose/commit).
**Attention by exception:** Don't interrupt (routine success, low-value obs) ·
Batch (drafts, planned posts, routine approvals, non-urgent conflicts) ·
Interrupt now (deadline risk, hot lead, system failure, safety boundary).

> Jarvis-level is **not "more autonomous."** It's the *right* autonomy: silent on
> routine work, explicit at consequential boundaries, accountable for whether the
> result actually happened. **Personality rule:** tactical clarity, dry wit,
> pressure sparingly — no five theatrical modes, no announced costume changes.

---

# RELEASE 0 — Front door (security, auth, time, CI) **[added on conversion]**

**Ships before Release 1.** Rationale: Releases 1–9 harden *what Aurelius does*;
Release 0 hardens *who can reach it and whether changes are safe to ship*. These
are the gaps the audit (`STATE_OF_AURELIUS.md`) and `OBJECTIVE_REVIEW_2026-10.md`
found in the front door itself. Specs authored from audit evidence (the referenced
`SUPER_JARVIS_PLAN.md` P-SEC/P1/P3 file is absent — see provenance note).

| Item | Change | Evidence / why | Verify |
|---|---|---|---|
| **1. Security deploy** | Merge PR #91 (`next` 14.2.3→14.2.35) and redeploy the frontend | CVE-2025-29927 middleware auth-bypass; app lock lives only in `middleware.ts`. Patched on branch, **live until deploy** | `curl -H 'x-middleware-subrequest: middleware:…' $PROD/api/today` returns 401/302, not 200 |
| **2. Unlock rate-limiting** | Add per-IP rate-limit + backoff/lockout to `/api/unlock` | `frontend/app/api/unlock/route.ts` accepts unlimited guesses against a human-typed secret = online route to full takeover (security lens) | a script of N bad guesses gets throttled/locked |
| **3. Auth inside `proxyToBackend`** | Verify the unlock cookie in `frontend/lib/proxyToBackend.ts` before forwarding, not only in middleware | Defense-in-depth: today the proxy supplies `x-aurelius-key` itself, so a middleware bypass reaches the brain. A second check means one bypass ≠ full access | a proxied call without a valid cookie is refused even if middleware is skipped |
| **4. Backend route-auth test** | A test that hits `/api/*` with no `x-aurelius-key` and asserts 401 (and 503 when unset in prod) | `aurelius/index.ts:207-208` is the backend lock; nothing tests it | test is red if the lock is removed |
| **5. Explicit America/Phoenix TZ** | Set `AURELIUS_TZ`/`TZ=America/Phoenix` on both services; assert at boot | `core/schedule.ts:168` fires crons in **process TZ, UTC if unset** — the 07:00 brief could fire at midnight | doctor shows TZ set; a job logs a Phoenix-local timestamp |
| **6. Neon dev branch** | A throwaway Neon branch as `DATABASE_URL` for smoke/CI | Smoke suite can't run without a non-prod DB; sandbox has none | smoke suite runs green against it, prod untouched |
| **7. CI gate** | GitHub Actions: `tsc --noEmit` (both trees) + smoke suite (on the Neon dev branch) + a migration check (`prisma migrate diff` fails if a `DROP INDEX` for the HNSW/GIN indexes leaks in) | No CI exists; `strict:false`; the DROP-INDEX landmine is hand-excised in ~13 migrations | a breaking PR / a leaked DROP INDEX fails CI |

**Exit:** security patch deployed and curl-verified; `/api/unlock` throttled;
the proxy enforces auth; the route-auth test is green; crons fire in Phoenix; CI
blocks a red PR and a DROP-INDEX regression.

---

# Build sequence — nine controlled releases, each with a stop condition

Scope commitment: all nine are implementation scope; phase gates control order,
not whether a later release ships. **Release rule:** if a phase raises Cole's
weekly operating time for two consecutive measurement periods without a
measurable outcome gain, pause it and fix the loop before proceeding.

## RELEASE 1 — Trust foundation
Fix irreversible-action gates, duplicate execution, full previews, audit integrity.
- Route destructive calendar/document/CRM/finance/knowledge actions through Bridge confirmation.
- Set non-idempotent tools to **zero** automatic retries unless they accept a durable idempotency key.
- Add idempotency to payment **and manual transaction creation**.
- Show the **complete** payload in every confirmation card; never label a truncated preview "full."
- Persist intent, actor, grant, tool call, result, verification and undo status in one trace.
- **Exit:** zero unsafe test executions. *(All four code claims verified — see `STATE_OF_AURELIUS.md` §Verification.)*

## RELEASE 2 — Perception without spam
Schedule the nervous-system tick in **observe-only** mode; deduplicate and batch signals.
- Detect inbox, calendar, pipeline and job-health changes; dedupe by entity/event/time window; score urgency+confidence before surfacing; write routine items to one digest, reserve live alerts for real deadlines/hot leads/failures.
- **PDF anchor:** "invoke `runNervousSystemTick` from `index.ts` via the job-claim pattern." **⚠ Conflict resolved — do NOT revive that module.** `runNervousSystemTick → runAutonomyCycle → routeTask` (legacy `engineRouter.ts`, flagged for deletion) with a **stub `EngineContext`** (`memory/tools` are no-ops, `autonomyEngineDB.ts:28-37`): it perceives nothing and acts nothing. Build a **new minimal observe-only perception job** on the `scheduleNamed`+`claimDailyRun` pattern reading real services instead. Evidence + recommendation in `STATE_OF_AURELIUS.md` §Verification and the session notes.
- **Exit:** useful detection without alert noise. **Do not add action power in Release 2.**

## RELEASE 3 — Assistant completion
Inbox + calendar move from briefing to prepared outcomes.
- Inbox loop: read/classify → prepare (draft replies, extract tasks, propose follow-ups) → batch (one morning queue; hot leads may interrupt) → confirm & send (Cole edits/approves; Aurelius executes and verifies sent state).
- Calendar loop: read commitments → protect priorities → resolve conflicts (smallest change within grants) → verify (re-read after any change).
- **Exit:** one daily batch and fewer manual checks.

## RELEASE 4 — Content engine
Research → capture → draft → approve → schedule → publish → ingest performance.
- Content mix (launch assumption, not a quota): 30% Cole's thinking · 35% education · 20% proof/process · 15% conversion. Lowest-friction input: Cole sends a rough voice note; Aurelius extracts the point, keeps the opinion, drafts hook+body into the weekly review queue.
- Searchable idea bank (source/pillar/format/status/audience); platform-ready drafts with factual claims/personal stories marked for review; approve a week in one batch; schedule only approved material (publishing stays outward); ingest performance.
- **Exit:** four-week stable cadence inside the attention budget. **Time budget:** one capture habit + a weekly review ≤30 min; if the queue takes longer, reduce cadence before adding automation.

## RELEASE 5 — Lead-generation engine
Activate targeted outbound, warm reactivation and nurture **after content is stable**.
- Four lanes: Inbound (watch approved comments/messages/intake; score intent; prepare next reply) · Targeted outbound (small high-fit list, real context, Cole edits/sends — **no automatic cold messaging**) · Warm reactivation (past clients/old intakes/known contacts, human follow-up) · Nurture (measured cadence, pause on reply).
- CRM is the state ledger; the lead engine is the actor that moves state (New→Researching→Draft ready→Contacted→Replied→Qualified→Call booked→Won/Lost/Nurture).
- **Safety boundary:** Aurelius drafts; Cole edits; Cole sends. Revisit automation only after quality, platform compliance and account safety are proven. **Exit:** verified qualified opportunities, not activity.

## RELEASE 6 — Knowledge and research
Deterministic context, citations, compare-and-synthesize, measured recall.
- Generalize the scoped-read pattern from `training/reasoner.ts` into a reusable knowledge-context service; inject confirmed facts deterministically on domain/entity match; semantic recall as a supplement; log what was retrieved/omitted/corrected; retry failed embeddings and expose stale/unembedded records.
- Three lanes (content/coaching/business), evidence rules (store source/date/claim/confidence/disagreement; cite claims; expire time-sensitive claims).
- **Exit:** fewer repeated explanations and grounded decisions. **Stop condition:** a research stream that creates reading but no decision/asset/tested update gets shut off.

---

# RELEASES 7–9 — **candidate scope [marked on conversion]**

> **Decision deferred to after day 90, based on measured need.** The PDF lists
> these as committed implementation scope; on Cole's instruction they are
> **candidate** — specced and ready, but each begins only if post-90-day data
> shows the need and the prior loops are stable (per the Review gate and the
> Tool-evaluation discipline). They are not dropped; they are gated on evidence.

## RELEASE 7 — Voice *(candidate)*
Streaming, interruptible speech on the **existing** router and gates (speech in →
streaming transcript → existing router → memory+tools → streaming speech).
Build first: fast cost-controlled voice tier, partial-speech streaming,
interrupt/cancel mid-sentence, short spoken answers, same missions/knowledge/tools
as text. Approval by voice: read consequence not every field; clear confirmation
for the exact queued action; echo result only after verification. **Begin when:**
hands-free is already a daily need and the assistant loops are stable.
**Exit:** a mission can be run and confirmed hands-free.

## RELEASE 8 — Browser execution (Playwright) *(candidate)*
Unpark the frozen Playwright spec as another **execution adapter**: missions
decide, Bridge governs consequential steps, verification reads final state
(mission step → browser plan → preview → confirm → execute → verify). Isolated
browser context; stable locators + bounded retries; persist logs/screenshots/
page-state in the trace; resume safely or fail honestly. Hard boundaries: never
expose credentials to model context/logs; exact confirmation before
purchase/booking/send/publish/delete; stop at CAPTCHA/suspicious redirect/changed
terms. **First proof:** one repetitive, low-risk workflow with a read-after-write
check. Not purchasing, account recovery or broad browsing. **Begin only after**
the mission/confirmation/verification spine is proven.

## RELEASE 9 — Self-upgrade *(candidate)*
Corrections become tested proposals, approved diffs, canaries and rollback.
Collect corrections/failures/repeated edits → propose a rule/prompt/routing/
workflow change → run against a fixed eval set → show diff + expected benefit +
regression risk → require approval, canary, instant rollback. **Never let
self-upgrade directly edit production logic** — it's a disciplined
change-management system, not an autonomous coder with write access. **Exit:**
persistent improvement without self-modifying risk.

---

## Business engine — distribution + conversion around a protected service capacity

Offer ladder (working launch prices, inferred not validated — launch narrowly,
measure, revise): **General population program** $49 one-time (self-serve entry) ·
**Introduction to athletic training** $69 one-time (bridge + lead magnet) ·
**Mid-touch 1:1** $200/mo · **High-touch 1:1** $450/mo. Capacity: **6–10** total
1:1 athletes, **10–20 hrs/wk**, **3** paid beta clients before repricing.
Engine modules that matter first: Offer · Acquisition · Conversion · Client
(existing invoice/payment + idempotency) · Analytics. First lead magnet: **Free
6-Week In-Season Performance Program** (built from Cole's material; he approves
every exercise/claim). Never make medical claims, guarantee outcomes, or
misrepresent availability.

## Measurement — the Operator Score changes behavior, not a dashboard
Two layers: **Cole outcome score** (task completion, consistency, recovery/load,
business progress) and **Aurelius quality score** (verified mission completion,
false alerts/duplicate actions, recall misses/correction rate, approval
rejection/edit distance, time operating the operator). **If the quality score
drops, Aurelius gets quieter and more conservative.** North-star metrics:
minutes/day operating · unplanned prompts/day · verified outcomes/mission ·
approved posts/review-minute · qualified conversations+booked calls · revenue per
delivery hour. **Baseline first:** measure Cole's current weekly time before
claiming any hours saved.

## First 90 days — prove the operator thesis in three production releases
*(Target windows, not delivery promises.)*
- **A · Days 0–30 — Trust + observe:** baseline; repair gates/retries/idempotency;
  observe-only nervous-system ticks; dedupe/urgency/one digest. **Ship when** safety
  tests pass, perception coverage visible, alert noise acceptable. *(Release 0 runs here too.)*
- **B · Days 31–60 — Finish assistant + pilot content:** batched inbox triage,
  calendar proposals, voice-note capture, idea bank, weekly approval queue,
  scheduling, result ingestion; one content cadence. **Ship when** inbox/calendar
  effort falls and content runs two stable weeks inside the review budget.
- **C · Days 61–90 — Activate lead generation:** magnet intake, qualification,
  daily prospect drafts, warm reactivation, reply detection, nurture, funnel
  analytics; send stays edit-and-confirm. **Ship when** the engine produces
  qualified conversations and the weekly review names the real bottleneck.

**Parallel preparation, not parallel launches:** shared data model, Bridge
batching, analytics events and approval surfaces can support content and leadgen
together; their external loops go live sequentially so failures stay attributable.
**After day 90:** reliable knowledge reads + research synthesis, then (candidate)
voice, guarded Playwright, self-upgrade. **Review gate:** no later phase begins
because the calendar says so — it begins because the prior phase passed its
outcome and attention tests.

## Implementation handoff — extend the choke points, don't build another framework
Treat repository code as truth. Implement release by release behind a feature
flag; verify each named anchor before editing; return changed files, migrations,
tests, verification evidence and unresolved blockers. Do not create a parallel
operator framework or silently omit a later release.

| Known anchor | Change | Proof |
|---|---|---|
| `core/nervousSystem.ts` | **(See Release 2 conflict note — prefer a new observe-only job over reviving this.)** Split perceive/decide/act/verify into traceable stages; observe-only | One mission trace shows every stage + terminal state |
| `index.ts` | Invoke the perception tick via the job-run claim pattern | One claimed run per interval; safe restart |
| `autonomy/executor.ts` | Gate by consequence; confirm irreversible actions | Policy tests cover send/publish/spend/delete/overwrite |
| `llm/router.ts` | Keep one routing choke point; add a fast voice path + later measured cascade | Same tracing/costs/fallback for voice + text |
| `training/reasoner.ts` | Extract scoped-read into a reusable knowledge-context service | Confirmed facts appear deterministically in matching decisions |
| Bridge confirmation queue | Batch semantics, exact payload hashes, edit history, partial approval | One batch approves selected items without payload drift |
| Mission runner | Add action + verification step types + terminal failure states | Mission can't report success without verification evidence |
| Frozen Playwright spec | Unpark as a browser adapter under mission/Bridge/verification | One low-risk workflow completes with read-after-write |
| Lead/Client/Content areas | Connect state transitions to jobs, approvals, analytics events | Every lead/post has source, current state, next action |

Cross-cutting: idempotency · structured events · audit trace · read-after-write ·
feature flags · canary release · rollback · cost telemetry.
**Definition of done:** code merged, tests pass, a production path invokes it,
result verified, metrics visible, failure honest, docs current.
**Not done:** a directory exists, a prompt describes it, a cron starts it, a tool
returns success, or a dashboard shows an unverified claim.

## Tool evaluation — candidates are analysis work, not approved scope
Playwright is committed. The rest are build/park/reject analysis for Claude Code
(inspect repo fit, estimate maintenance, smallest useful implementation; none
built without Cole's separate approval): Stripe Payment Links · WhatsApp staged
messaging · Instagram DM drafts (Messenger API) · Receipt capture · Cal.com ·
Plaid read-only · DocuSign · GA4 Data API · Meta Ads · Whoop/Garmin · Twilio
voice-to-Cole-only. Score each on hours saved, setup, recurring cost, maintenance,
security exposure, provider friction, data quality, overlap with existing
adapters; output build/park/reject + anchors + smallest scope + approval boundary.

## Scope control — protect the roadmap from features that return no time
**Do not build now:** more model providers/role-personas without routing evidence ·
another dashboard/nav layer · five personality modes · fully automatic cold DMs ·
autonomous production-code self-modification · broad daily research digests with no
decision owner · deep wealth/training expansion before the operator loop closes ·
video-generation before content proves demand.
**Preserve and deepen:** one central router · grants/confirm/undo/audit · versioned
Living Knowledge · real tool adapters + provider fallback · integer money handling ·
real frontend + Bridge · living documents/athlete sheets once reads are reliable ·
tactical personality without theater.

## Final acceptance — 10/10 by outcomes, not architecture
"Get me five qualified athlete conversations this week" becomes a plan, approved
actions, verified results, one short report. Inbox/calendar handled in batches.
Lead generation creates qualified movement, not CRM activity. Cole's raw idea
becomes an approved post without flattening his voice. Research changes a decision
or asset. A confirmed fact is used correctly a month later and a miss is visible
and repairable. **The winning version of Aurelius is not the one that can do the
most — it's the one that reliably finishes the right work while Cole spends less
time managing it.**
