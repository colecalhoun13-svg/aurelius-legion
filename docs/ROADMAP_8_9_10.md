# ROADMAP TO 8 / 9 / 10 — The Council's Converged Design

*Recording secretary's synthesis of the six-chair council (Revenue Operator [LEAD],
Chief of Staff, Systems Architect, Reliability Engineer, Product Skeptic, Adversary).
Every citation below is live code a chair opened. Nothing here is invented.*

> **Provenance note, carried from four chairs and not suppressed:** the charter-named
> source docs — `docs/AURELIUS_3.4_VISION.md`, `docs/COUNCIL_2026-08-06*.md`,
> `docs/ROADMAP_TO_NINE.md` — **do not exist at HEAD.** `git log --all` shows no such
> files; the only matching code is `aurelius/council/deliberate.ts` and
> `aurelius/media/vision.ts` (the multimodal module, unrelated). `NORTH_STAR.md`
> explicitly supersedes the vision doc's snapshots. Every §-number below is therefore
> **mapped from the charter's own enumeration and NORTH_STAR's fused OG Part XI** and is
> honest about it. The Adversary registered this absence as his first Phase-2 kill; the
> Skeptic flagged that his §7.4/§7.5 labels "could be a mechanism I've mis-numbered." The
> coverage map is **code-grounded and true about what is ABSENT**; its section labels are
> inferred and should be checked against the real doc if it surfaces.

---

## 1. WHAT EACH TIER MEANS

The council converged on a single principle: **a tier is not what a loop *does* — it is
what the loop cannot *lie* about.** Cole's test is money per minute of his attention,
never one more minute. Each bar below carries its anti-gaming observable, because every
chair agreed the numbers already in the system measure *effort* (`corpusDocsAdded`,
`memoriesWritten`, `ritualsFired`) and not one is a dollar, a reply, or a lead.

### Tier 8 — *the ledger writes itself*
Every money loop's right half exists: an outcome ledger, a puller, and a dispatcher that
takes a real-world result and mutates the lead / the content pattern / the pattern
confidence **with zero hand-typing**. A reply updates the lead, a payment updates the
angle, a post's metrics update the content pattern — because there is finally an object
for the outcome to land on. Every loop prepares to its last reversible step and lands as
*one tap*, not a screen. Backups don't just exist — they've been *restored* this week. No
scheduled money loop dies in silence.

- **Anti-gaming observable:** every state transition is backed by an event that *happened
  in the world*, not a row Aurelius wrote about its own intentions. `earnedCents` sums
  **only** `paid`-state rows reached by an observed event or Cole's explicit tap — a
  drafted offer *physically cannot* move the revenue number (the type system forbids it).
  `status:"acted"` (written the instant a finalizer returns, `executor.ts:87`) is never
  counted as an outcome.

### Tier 9 — *the loops change their own behavior from what they recorded*
The metric compounds *and survives an adversary trying to farm it*. The winning outreach
angle compiles into a `CompiledPattern` that leads next week's drafts unprompted; the
price re-proposes itself from close-rate evidence Cole ratifies; content re-ranks on
**leads-per-post, not likes**. Review burden **falls as action volume rises** — the 21st
identical confirm costs a fraction of the first. The hero number is **dollars per hour of
Cole's confirm-time**, rising month over month while his minutes stay flat.

- **Anti-gaming observable:** the metric un-counts its own lies. `llmDependenceRate` falls
  **only** when a reuse Cole *didn't correct* served it — a corrected reuse retroactively
  un-counts (`reuseCorrectionRate` stays low *while* dependence falls, or the alarm
  fires). "Workload absorbed" is `Σ(draftHours × absorptionScore)` measured by
  edit-distance to what Cole actually shipped — a draft he rewrote scores ~0. Reply-rate
  rises from Aurelius's own learning, never from Cole's data entry.

### Tier 10 — *a second revenue operator he never has to brief*
All five operators run the same Pass-2 engine over the same self-recording ledger.
Delivery runs *through* Aurelius: check-ins drafted, renewals surfaced before they lapse,
retention a property of the system rather than a thing Cole remembers. His 45 minutes go
almost entirely to the two or three genuinely-his calls a day.

- **Anti-gaming observable:** outcomes flow back that *no human typed* — an inbound reply
  on a stored `threadId`, a Meta insights read keyed to a stamped `postId`. The hard line
  holds at every tier: **every send/publish/spend is Cole's confirm, non-grantable by
  construction** (`checkGrantable` refuses outward, `actionClasses.ts:174`). Tier 10 never
  means Aurelius sends more on its own — it means the packaging around his confirms is done
  for him, so each confirm carries the weight of two.

> The Chief of Staff's warning, preserved: *"The failure mode I exist to kill is the
> '5-item disguised as a 9': a beautiful new surface that adds one more thing to check."*

---

## 1b. VISION COVERAGE — REAL / PARTIAL / ABSENT at HEAD

Section labels are inferred (see provenance note). Verdicts are the convergence of five
chairs' coverage passes; where they differed, the more conservative verdict is recorded
with the dissent noted. **A HOLE = an ABSENT section served by no HEAD capability.**

| § | Section | Verdict | Evidence | Served by item(s) |
|---|---------|---------|----------|-------------------|
| 2.1 | Operator cores | **PARTIAL** | Operators are lenses (`operators/operatorCores.ts`, `core/operatorRegistry.ts`) routed via `llm/router.ts`; `operators/content.ts` is a 24-line static stub; no per-operator Pass-2 execution. | 12 |
| 2.2 | Living Knowledge taxonomies | **REAL** | `knowledge/store.ts`, `proposals.ts`, propose→confirm, provenance, keyhole apply. | (substrate) |
| 2.3 | Compiled Understanding ("reduces LLM calls") | **PARTIAL / GAMEABLE** | `compiled/semanticReuse.ts` + `outcomeLoop.ts` real; `llmDependenceRate` computed but has **no quality coupling** — a bad reuse lowers it like a good one. Not proven to *fall* month-over-month. | 4 |
| 2.4 | Research Memory | **REAL** | Missions plan→research→synthesize→ingest; corpus, wiki, `research.ingest` grant. | (closed) |
| 3.1 | Training operator | **REAL** | Signals-only by construction; `training.prescribe` non-grantable (`actionClasses.ts:121`). | (capped, correct) |
| 3.2 | Business operator | **ABSENT as a loop** | `business/positioning.ts` drafts offers as proposals; **no `Lead`/`Deal`/`Client`/`Payment` model** — nothing downstream of the offer exists. | 1, 6 |
| 3.3 | Content operator | **PARTIAL, no feedback** | `content.draft`→`content.publish`→`outward/instagram.ts` real; `instagram/insights.ts` real — but **the two never touch**; the returned `postId` is discarded (`instagram.ts:100`). | 3, 7 |
| 3.4 | Wealth operator | **PARTIAL** | `wealth/fred.ts` read-only macro; `wealth.trade` gated; no portfolio loop. | (deferred) |
| 3.5 | Personal OS | **REAL** | Productivity plane, calendar sync, rituals, briefing/debrief, `IntentActionGap`. | — |
| 4 | Seven-step Pass-2 for EVERY operator | **PARTIAL** | Full pipeline is research-only (`missions/engine.ts`) + hand-rolled per workflow; no shared `runOperatorPass2`; outcome step (step 7) absent for business/content. | 12 (+ every outcome item) |
| 5 | Multi-LLM routing | **REAL** | `llm/router.ts`, 6 providers, failover, cache-break assembly. | — |
| 6 | Connectors | **PARTIAL / dormant-honest** | Calendar REAL; Gmail read+draft (**no send scope**, `engine.ts:17,109`); IG/Paperless/Telegram dormant-honest; FRED live. **7-day testing-mode OAuth expiry** is a live staleness risk. | 8 |
| 7.1 | Offer / pricing | **PARTIAL** | `proposeOffer` (`positioning.ts:296`) exists; no outcome feeds back. | 1, 5 |
| 7.2 | Lead-gen / outreach | **ABSENT as a loop — HOLE** | `outreach.send` outward class (`actionClasses.ts:106`) with **no finalizer and no Lead entity** — a sent outreach has nowhere to live. | 1, 2, 6 |
| 7.3 | Content money-path | **PARTIAL — HOLE (closing half)** | Read-back exists; reach never touches a pattern. | 3, 7 |
| 7.4 | Client retention / delivery | **ABSENT — HOLE** | No client entity, no renewal/churn signal. | 1, 6 |
| 7.5 | Wealth / finance loop | **PARTIAL** | Read-only signals; `wealth.trade` gated stub. | (deferred) |
| 7.6 | Attribution / pricing feedback | **ABSENT — THE central HOLE** | Nothing records "this send → that reply → that payment." No `OutcomeEvent`/`MoneyEvent` table; `measurement/scoreboard.ts` has **zero** revenue/reply/conversion terms. | 1, 2, 5 |
| 8 | Jarvis bar (runs unattended) | **PARTIAL** | Salience gate + grant flywheel real; scheduled spine rich. Missing: same-day retry (`catchUp.ts:147` counts an errored run as "ran"), unattended doctor, restore-verified backups, drift detection, learned batching, money background. | 2, 5, 8, 9, 10 |

**HOLES with no HEAD capability:** §7.2, §7.4, §7.6, and the closing half of §7.3 —
*"every money loop is open at the outcome step"* (Chief of Staff). The Systems Architect's
one-line diagnosis of the whole system: **"the brain compounds (§2.3), but no money loop
can compound because none of them can record their own outcome."** The ordered list below
fills exactly these.

---

## 2. THE ORDERED LIST — THE EXECUTION SECTION

Ranked by tier-capability per hour, money and background first. The Adversary's Phase-2
review **converged five separately-designed ledgers into one** (~15h once, not the ~74h
the council collectively budgeted) and **four separately-designed attribution builds into
one**. This list reflects that convergence.

---

### 1. The Money Ledger — the entity every outcome flows into *(converged from Revenue 1 · CoS 1 · SysArch 1 · Skeptic 1 · Adversary 2)*
- **Tier:** 8 — enabling for all of §7.
- **Vision §:** 7.1–7.6, 3.2, 2.2, 4 (step 7).
- **What:** New Prisma models — `Lead` (name, source, stage `warm|contacted|replied|booked|signed|lost|paid`, value, `linkedContactEmail`, `firstTouchAt`, `lastTouchAt`, stable `entityKey`), `MoneyEvent` (strict state enum `drafted|sent|replied|agreed|paid`, `earnedCents`, `recordedBy: "aurelius"|"cole"`, external/source ref), and `AttributionEvent`/`TouchPoint` (`leadId`, channel, direction, actionClass, `bridgeSignalId`, evidence id, occurredAt). **Hard invariant enforced in code: `earnedCents` sums only `paid` rows**, reached only via Cole's confirm or a connector-observed inbound Aurelius did not author. The write side is *not new plumbing* — it hangs off `confirmAction`/`executeAction`: each finalizer appends its `TouchPoint`/`MoneyEvent` as its last line. Stage transitions are inward/reversible → ride `executeAction`, land as vetoable receipts. The `Memory.entityKey` comment (`schema.prisma:144`, "lead ID, post ID") already anticipated this.
- **Why:** Nothing in §7 can *close* without an object the outcome mutates. The Adversary's truth serum: a drafted offer *cannot* move the revenue number because the type system won't let `drafted` touch `earnedCents`.
- **INVOKER:** existing confirm paths write events; a new `lead.advance` **inward** action-class does stage writes through `executeAction`; reads surface on a Decisions-tab ledger card. **No new cron.**
- **Prereqs:** live Postgres (have it); the 4→7 warm-list handoff (charter supplied). Excise the phantom `DROP INDEX` blocks per CLAUDE.md migration gotcha.
- **Build cost:** ~15h once (models + migration; the reply→lead matcher; the action-class + finalizer + inverse). **Ongoing:** near-zero tokens — deterministic writes.
- **BACKGROUND:** *Unattended* — every executed/confirmed revenue action books its own row; stage advances on matched inbound. *Silent* — lead creation and stage moves land as vetoable receipts. **The one confirm:** *none new* — this item adds zero gates; it instruments the gates that already exist.
- **WORKLOAD ABSORBED:** ~2–3 h/week of CRM bookkeeping Cole will never start doing. **Money mechanism:** makes every other loop *measurable* — no ledger = no ROI = no re-pricing = no attribution.
- **How we'd know:** `AttributionEvent` count with `recordedBy:"aurelius"` climbs week over week while `recordedBy:"cole"` stays flat; TouchPoints-per-week rises with action volume; zero manual writes in the trace log.

---

### 2. Self-recording attribution via stored `threadId` *(Adversary 3 · CoS 4 reply-half · SysArch 1 puller · D4 convergence)*
- **Tier:** 8.
- **Vision §:** 7.2, 7.6, 4 (step 7 closed unattended).
- **What:** `inboxTriage.ts:124` already stores `threadId` on every drafted reply. Extend the existing every-10-min Gmail read path: a **new inbound message on a thread Aurelius drafted into** flips the matching `Lead`/`MoneyEvent` to `replied`, with the inbound message id as evidence, and advances lead stage — **Cole types nothing.** Read scope already exists; no new grant, no send. Guarded against thread-merge/forward false positives by requiring the inbound `From` to match the original recipient.
- **Why:** The charter's exact demand — *"attribution that records itself, outcomes that flow back without Cole typing them."* Highest background-value-per-hour item in the council.
- **INVOKER:** the existing 10-min Gmail poller (extend, don't add).
- **Prereqs:** Item 1; Gmail connected (read+draft, built).
- **Build cost:** ~8h. **Ongoing:** one extra Gmail list call per poll; negligible.
- **BACKGROUND:** *Fully unattended* — replies mark themselves; reply-rate updates itself, traced. **The one confirm:** *none new* — pure observation. (It surfaces a read-only *notice* when reply-rate on an angle crosses a threshold.)
- **WORKLOAD ABSORBED:** ~30–45 min/week of the "who owes me a reply, who went cold" mental ledger. **Money mechanism:** §7.2 reply-rate → §7.3 angle selection.
- **How we'd know:** `repliesAttributedAutomatically / totalReplies` rises toward 1.0; **mandate: an unmatched reply logs `unattributed`, never `lost`** — "the pattern is starved of data rather than fed a lie" (Revenue chair), the expired≠denied discipline.

---

### 3. Authorship stamp on every outward artifact *(Adversary 1 — the load-bearing precondition for content learning)*
- **Tier:** enabling (precondition for any tier-8 content/business loop).
- **Vision §:** 3.3, 4 (step 7), 7.3.
- **What:** New `OutwardArtifact` model (draftId, operator, actionClass, the angle/patternIds that generated it, channel, `externalId`, publishedAt, outcome columns). Write it at **draft** time inside `content.draft` and `inbox.triage_draft` prepare(); **backfill `externalId`** at publish time — `finalizeContentPublish` already receives `publishToInstagram`'s `postId` (`instagram.ts:100`) and currently **discards it**; persist it instead. Then refactor `postingPatterns` (`insights.ts:193`) to join Meta metrics **only** to posts whose `externalId` matches a stamped artifact.
- **Why:** Today `recentPostMetrics` reads the **whole account, unfiltered** (`insights.ts:116`) — the gym's posts, Cole's dog photos, and Aurelius's drafts land in one bucket. A content loop built on it "learns from posts it never wrote… a correlated-noise generator dressed as learning." The stamp is the only thing that makes *"a post's metrics update the content patterns"* a true sentence. **Test:** point the loop at an account where Aurelius authored 0 posts — if the pattern still "learns," it's learning from noise.
- **INVOKER:** written by existing draft/publish workflows (no new invoker); read by the Sunday content-pattern job.
- **Prereqs:** the shipped content lane. **Build cost:** ~10h (1 migration, 4 write-sites, 1 join refactor). **Ongoing:** near-zero; one indexed table.
- **BACKGROUND:** *Unattended* — every draft and confirmed publish records its own provenance row. **The one confirm:** unchanged (still the publish confirm); adds zero taps.
- **WORKLOAD ABSORBED:** none directly; it protects the content loop's claimed ~2h/week from being **fictional**. **Money mechanism:** §7.3 join key.
- **How we'd know:** `contentPatternsAttributedToStampedPosts / totalContentPatterns` = 1.0. Any pattern whose evidence includes an unstamped post is a bug.

---

### 4. Couple `llmDependenceRate` to correctness *(Adversary 4 — de-games the council's headline compounding metric)*
- **Tier:** 9.
- **Vision §:** 2.3.
- **What:** Two changes to the reuse path. **(a)** When Cole corrects a decision, `decayRecentlyFired` (`outcomeLoop.ts:134`) already scans the recent fired-set; extend it to find any `reasoningCacheEntry` **served** in that window, mark it `invalidated`, and **retroactively decrement that week's `cacheReuses`** (`scoreboard.ts:66`). A reuse Cole corrected must un-count. **(b)** A Sunday shadow-eval sampler re-asks a live model for a random ~5% of reuse hits and logs agreement; a disagreeing reuse is invalidated and dropped. Annotate `llmDependenceRate` with `reuseCorrectionRate`.
- **Why:** `tryReuseAnswer` serves on cosine ≥ threshold + freshness alone (`semanticReuse.ts:51-59`) — **zero correctness check.** The DoD metric is farmable by *loosening* reuse: drop similarity and dependence "improves" while answers get worse. **This is the load-bearing de-gamer for every chair's "dependence falls → we compound" claim** (Revenue 5, CoS 5, SysArch 4, Skeptic 5). **Test:** force 10 corrections on reused answers; if dependence still reads "improved," the metric is cosmetic.
- **INVOKER:** the correction front-door (immediate) + a new Sunday shadow sampler.
- **Prereqs:** none — `outcomeLoop.ts` machinery exists to copy. **Build cost:** ~10h. **Ongoing:** 5% shadow re-asks cost bounded tokens — *the point is to spend a little to keep the savings honest.*
- **BACKGROUND:** *Unattended* — corrections invalidate reuses silently; the sampler runs Sunday. **The one confirm:** none — internal metric hygiene.
- **WORKLOAD ABSORBED:** none of Cole's hours; protects the credibility of the one number the entire "compounding" claim rests on.
- **How we'd know:** `reuseCorrectionRate` stays <~5% *while* `llmDependenceRate` falls. If dependence falls and correction rate climbs, the alarm fires — the number is being farmed.

---

### 5. Money on the scoreboard — pushed via the 07:00 briefing *(Revenue 5 · SysArch 4 · Skeptic 2, screen-stripped)*
- **Tier:** 9.
- **Vision §:** 7.1–7.6, 2.3, 8.
- **What:** Extend `computeWeeklySnapshot` (`scoreboard.ts:80`) with a money block **reconstructed the trust-ledger way — from `MoneyEvent`/`AttributionEvent` + `action:` traces, never self-reported**: `bookedThisWeek`, `signedThisWeek`, `pipelineValue`, `repliesToOurSends`, `outreachSent` (from confirmed `outreach.send` traces), `postsPublished`, `attributedRevenue`, and the hero — **dollars per hour of Cole's confirm-time** (confirm-taps × median tap-cost from the trace log). Rewrite the scoreboard headline from "12 documents absorbed" (`scoreboard.ts:156`) to *"$X booked · Y replies on Z sends · pipeline $W."* The morning briefing's biggest-risk footer gains a revenue sibling that **cites the pattern it learned**: *"Your 40 min last week drove $X; the `competency_standard` angle is closing 2× `measured_numbers` — I'm leading with it."* **`drafted` and `paid` are reported as two numbers that never sum.** New ratios match the `llmDependenceRate` integer-percent convention (CLAUDE.md gotcha).
- **Why:** Makes "more money per minute" an *observed* number and directs Cole's scarce attention to the highest-ROI loop. The hero metric confronts (NORTH_STAR DoD) instead of vanity-counting.
- **INVOKER:** existing Sun 20:00 `weekly_scoreboard` + 07:00 briefing. **No new cron. No new screen** — the Adversary killed the Skeptic's standalone "monthly machine scoreboard" page (see Rejected); it rides the briefing push or it dies.
- **Prereqs:** Items 1–2. **Build cost:** ~9h. **Ongoing:** deterministic, zero tokens.
- **BACKGROUND:** *Unattended* — weekly compute and briefing line. *Silent* — the snapshot upsert. **The one confirm:** none — it's a report.
- **WORKLOAD ABSORBED:** the "is any of this working" accounting Cole would never do. **Money mechanism:** attention allocation — his 45 min/day pointed at the best-return loop.
- **How we'd know:** dollars-per-hour-of-confirm-time trends **up** month over month; `attributedRevenue` non-null only in weeks with a `paid` event; `recordedBy:"aurelius"` share exceeds Cole's.

---

### 6. The warm-list follow-up engine *(Skeptic 4 · CoS 4 draft-half · Revenue 2 send-loop)*
- **Tier:** 8 (→9 as it learns which openers land).
- **Vision §:** 7.1, 7.2, 7.6, 3.2.
- **What:** A daily background pass over `Lead` (Item 1) finds leads whose `lastTouchAt` is past a stage-appropriate interval (warm→7d, replied→2d) and **prepares** a follow-up: drafts from `businessContextBlock` (`positioning.ts:195`) + thread history, staged as a gated `outreach.send` landing on the phone Bridge with Confirm/Dismiss (`executor.ts:135`). It **never sends**; it makes the send a one-tap. The `prepare()` tags each draft with an **angle variant** (e.g. `competency_standard` vs `measured_numbers`, both from `CONFIRMED_FACTS`, `profile.ts:28`) so it speaks Cole's real posture, never a guarantee. Win-rates accrue via Item 2; when one clears a margin over N sends it compiles into a `CompiledPattern` (`proposed_heuristic`→`confirmed_heuristic`) the next `prepare()` leads with.
- **Why:** Prepares the loop "to the last reversible step." Follow-up is where coaching leads die and it's pure discipline — the thing a second operator owns. The angle-learning is the tier-9 bar verbatim: *"reply rates rise because it learns from its own sends."*
- **INVOKER:** new daily `followup_sweep` cron (or weekday 08:15, after the 08:00 initiative), `runTraced`; inbound detector on the existing 10-min poll.
- **Prereqs:** Items 1–2; Gmail draft (built). **⚠ See L1 in §3 / D2 in §6 — the *send* re-enters Cole in Gmail until a `gmail.send` scope + `outreach.send` finalizer land.**
- **Build cost:** ~9h (drafting only; the send finalizer + scope escalation are a separate, uncosted prereq). **Ongoing:** a few drafts' tokens/day; review is the confirm taps.
- **BACKGROUND:** *Unattended* — the sweep finds every overdue lead and drafts each follow-up. *Silent* — nothing sends. **The one confirm:** each send — *"follow-up to Marcus ready, 9 days quiet — send?"*
- **WORKLOAD ABSORBED:** ~2–4 h/week of "I need to follow up with…" that never happens. **Money mechanism:** conversion on the existing warm list — the cheapest revenue there is.
- **How we'd know:** reply-rate of the auto-selected angle vs the field rises across a quarter; leads in `contacted` with no advance for 14d trend toward zero.

---

### 7. Content outcome → pattern reinforcement *(Skeptic 3 · Revenue 6 · CoS 5, on top of Item 3)*
- **Tier:** 9 — *the one loop that can reach a real 9 by code alone.*
- **Vision §:** 3.3, 2.3, 4 (step 7), 7.3.
- **What:** Two wires. **(a)** Register the **missing** `content.draft` finalizer (the class exists at `actionClasses.ts:66` but `registerActions.ts` never wires it — a declared loop with no engine); wire it to draft from corpus + `businessContextBlock` into a weekly review queue. **(b)** After each publish, a post-publish hook on `finalizeContentPublish` schedules an insights-read 72h later; the outcome feeds the **existing** compiled-pattern loop (`outcomeLoop.ts`: `recordPatternsFired`→REINFORCE/DECAY). A post that beats Cole's median engagement reinforces the angle/hook pattern that drafted it (`proposed_heuristic`); an underperformer decays it. The `content.draft` prepare() then pulls higher-confidence patterns next time. **Reach reinforces a *content pattern*; it does not auto-publish anything — publishing stays Cole's tap at every tier.**
- **Why:** The 9-bar verbatim: *"a post's metrics update the content patterns — zero hand-typing."* And Instagram insights are **the only money-relevant outcome that flows back over the network with no human in the loop** — which is why this, uniquely, can compound autonomously.
- **INVOKER:** a weekly metrics-pull job (Sunday learner cluster) reading `insights.ts`; the drafter reads reinforced patterns via existing Layer 5.4 machinery.
- **Prereqs:** **Item 3 (the stamp) is non-negotiable** — without it the loop learns from the gym's posts. IG connected (built). Reuses `outcomeLoop.ts` wholesale — no new learning primitive.
- **Build cost:** ~10h. **Ongoing:** ~0 extra tokens (metrics are API reads).
- **BACKGROUND:** *Unattended* — every Sunday last week's reach silently reinforces/decays the patterns. *Silent* — pattern confidence shifts inside the existing bounded loop. **The one confirm:** none new; the payoff is *better drafts* Cole still confirms.
- **WORKLOAD ABSORBED:** ~1h/week of "which posts worked and why," plus it raises the yield of every content confirm. **Money mechanism:** content is top-of-funnel; a drafter that measurably learns makes the same cadence produce more inbound → more Leads (Item 1) → more follow-ups (Item 6).
- **How we'd know:** median engagement-per-post of drafted-then-published posts trends up across a quarter; content `confirmed_heuristic` count > 0 and climbing; `llmDependenceRate` for content drafting falls as patterns short-circuit.

---

### 8. Freshness gate on every background loop *(Adversary 6)*
- **Tier:** enabling — precondition for "runs unattended for weeks."
- **Vision §:** 6, 8.
- **What:** A `connectorReadAt` freshness stamp on every calendar/Gmail/IG/FRED read, and a guard in each background workflow: if the last successful read is older than that loop's tolerance (calendar 30m, inbox 30m, IG metrics 48h), the loop **refuses and files an honest-fail Bridge notice** instead of acting on the snapshot.
- **Why:** Motivated by the documented **7-day testing-mode OAuth expiry** (NORTH_STAR line 518). A `calendar.schedule_protection` placing a hold against a 7-day-stale calendar mirror is *"a confident lie… worse than one that doesn't run"* (hard rule 3). Turns silent staleness into loud refusal.
- **INVOKER:** wraps existing schedulers (15-min calendar sync, 06:45 schedule protection, 10-min Gmail, IG reads).
- **Prereqs:** none. **Build cost:** ~9h. **Ongoing:** near-zero.
- **BACKGROUND:** *Unattended* — every loop self-checks before acting. **The one confirm:** the reconnect tap (the existing OAuth re-auth link), one deduped notice.
- **WORKLOAD ABSORBED:** prevents cleanup of actions taken on stale data (double-booked holds, replies to resolved threads). **Money mechanism:** reliability that lets the money loops run unattended.
- **How we'd know:** zero actions executed against a connector snapshot older than its tolerance; `staleRefusals` is a visible, non-zero-when-disconnected counter.

---

### 9. Self-healing supervisor — same-day retry of failed spine jobs *(Reliability 1, redesigned to fix L3)*
- **Tier:** 8.
- **Vision §:** 8, 4.
- **What:** A new `core/supervisor.ts` on an **hourly** cron. For each `ONCE_PER_DAY` job whose fire-time has passed today with `status:"failed"` (written at `schedule.ts:87`, **currently read by nothing**), re-fire through `runTraced` under a fresh claim, bounded to 3 attempts/day (stored on the JobRun). **Fixes the killer HEAD bug:** `catchUp.ts:147` `ranToday()` counts an *errored* run as "ran" and refuses to re-fire; catch-up is boot-only (`catchUp.ts:207`); `pageFailure` tells Cole *"I'll retry on schedule"* (`trace.ts:164`) — which for a daily job means **tomorrow** (a lead cooled 24h). **Redesign mandate (Adversary L3):** `claimDailyRun` (`schedule.ts:61-83`) only rescues `status:"running"` rows >30 min old — **a `failed` row is never matched.** The supervisor needs *new claim logic to take over failed rows*, or it silently skips every job it exists to retry.
- **Why:** Transient failures (cold Neon, a Google blip, a rate-limit spike) self-heal within the hour instead of costing a full day. A failed inbox-triage briefing = a warm reply never drafted that morning.
- **INVOKER:** hourly cron `supervisor` (new).
- **Prereqs:** `JobRun`, `runTraced` exist; **the new failed-row claim path** (understated in the original 10h estimate). **Build cost:** honest ~14h. **Ongoing:** near-zero tokens; one JobRun column (`attempts`).
- **BACKGROUND:** *Unattended* — hourly re-fire of failed-but-relevant daily jobs under the atomic claim (no double-fire vs the live cron). *Silent* on success. **The one confirm:** only when a job exhausts retries *and* stays failed does it page once (reusing `pageFailure`'s 6h dedupe) — a notice, not a decision.
- **WORKLOAD ABSORBED:** ~1–2 h/month of forensic re-running; the real value is protecting schedule-protection and morning triage from silent death.
- **How we'd know:** same-day-recovered failures rise, Cole-visible failures fall — review burden drops as the spine gets busier.

---

### 10. Restore-verify the backups *(Reliability 2)*
- **Tier:** 8 — enabling; cheapest insurance on the entire second brain.
- **Vision §:** 2.2, 2.4, 8.
- **What:** Extend `core/backup.ts`. Today `runDbBackup` only asserts `bytes < 1024` (`backup.ts:48`) — a truncated or version-mismatched dump passes as success. Add a weekly `backup_verify`: `pg_restore` the newest `.dump` into a throwaway `aurelius_restore_probe` DB, assert `SELECT COUNT(*)` on load-bearing tables (`KnowledgeEntry`, `CompiledPattern`, `VectorEmbedding`, and now `Lead`/`MoneyEvent`/`OutwardArtifact`) is within a sane delta of live, then `DROP DATABASE`. File a `restore_failure` Bridge signal if restore throws or counts collapse.
- **Why:** *"An unrestorable backup discovered the day the disk dies is identical to no backup — and the entire compounding-intelligence thesis lives in one Postgres."*
- **INVOKER:** weekly cron `backup_verify` (Sun ~03:00, after the nightly dump).
- **Prereqs:** `pg_restore` in the image (runbooks install `postgresql-client`); scratch-DB create/drop grant. **Build cost:** ~6h. **Ongoing:** one restore/week (seconds–minutes CPU), zero tokens.
- **BACKGROUND:** *Unattended* weekly restore into scratch, row-count assertion, scratch dropped. *Silent* on success. **The one confirm:** a `restore_failure` signal — *"last night's backup will not restore"* — a genuine decision.
- **WORKLOAD ABSORBED:** converts unbounded catastrophic risk into a bounded observed one. **Money mechanism:** insurance on every offer, lead, pattern, and correction Cole has fed it.
- **How we'd know:** "weeks since last successful restore-verify" stays ≤1.

---

### Deferred, not dead
- **Pass-2 unification (`runOperatorPass2`)** — SysArch 2. Genuine tier value, but the Adversary priced it 2–3× low (D3): it refactors the core acting spine (4 workflows + `missions/engine.ts` 337 lines) with the whole autonomy layer as regression surface. **Build after the ledger stabilizes.**
- **Experiment framework** — SysArch 3. Real tier-9, needs Items 1–4 mature first.
- **Outcome-liveness / drift canary** — Reliability 3. Good; after the ledger's return leg exists.
- **Offer re-pricing engine** — Revenue 3. Folds into Sun 20:00/21:00; needs Items 1–2's deal outcomes.
- **Delivery / renewal sentinel** — Revenue 4 / §7.4. Tier 8→9; needs `Deal` terms + the athlete sheet handoff.
- **Trust-earned summarization (INWARD only)** — CoS 2, **restricted** (see Rejected K1).
- **Learned attention window + budget** — CoS 3. Indirect; nice-to-have.
- **The one-tap morning decision queue** — CoS 6. Rides the briefing once Items 1–3 supply contents.
- **The reliability metric** ("days since Cole had to look") — Reliability 4. ~5h; add once Items 9–10 supply clean event sources.
- **Sleep/wake watchdog + unattended doctor-diff** — Reliability 5. ~8h; the Mac Mini reality (7-day Google token death caught the day it breaks).
- **Ledger auditor** — Skeptic 6 / the immune system. Keep low; add once money numbers exist.
- **Absorption score** — Adversary 5. A floor, self-gameable by author's own concession.
- **Reachability audit** — SysArch 5. Enabling-hygiene (Adversary K2: a lint check, not a tier item), but genuinely useful — `content.draft` is a live orphan it would flag day one.

---

## 3. THE COMPOUNDING LOOPS

### The Honest Outreach Loop *(the first to build — the smallest loop that closes §7.2 without a farmed number)*
1. **DRAFT** *(inward, silent)* — `followup_sweep` (Item 6) drafts a warm-list message from `CONFIRMED_FACTS`, writes an `OutwardArtifact` stamped with the angle/patternIds (Item 3), state `drafted`, stores the `threadId`.
2. **GATE / CONFIRM** *(the one tap)* — the draft reaches Cole's phone via the Bridge (`executor.ts:135`). **This is the only human step, inviolable — outward, non-grantable.** Cole taps; state → `sent`; a `TouchPoint` is keyed to lead + angle.
3. **OBSERVE** *(unattended, self-recording)* — the 10-min Gmail poller (Item 2) matches an inbound reply on the stored thread, advances the lead, writes the outcome onto the angle — **zero typing.**
4. **EARN** *(observed, never asserted)* — a receipt parse or one-tap "they paid" advances state → `paid`; `earnedCents` moves **here and only here** (Item 1's invariant).
5. **LEARN** *(Sunday)* — reply-rate and paid-rate per angle reinforce via `outcomeLoop.ts`; **angles that draw silence do not reward** (the silence-never-rewards asymmetry, `outcomeLoop.ts:204`, copied verbatim).
6. **REPORT** — the ROI line (Item 5) tells Cole in the briefing which angle is winning and that it's now leading.

- **What closes it:** step 3 — the reply flowing back on a thread Aurelius already stored.
- **What would silently break it:** (a) a stale Gmail token (step 3 reads nothing; the loop looks "quiet" instead of "blind" — *"reports a healthy 0% reply rate while disconnected and the angle-learning quietly poisons itself on a false negative"*) → **mitigated by Item 8's freshness gate, a prereq not a nicety**; (b) wrong-Contact attribution poisoning the drafter's learning → **the matcher must be same-thread/same-address-strict and fail *open* (record `unattributed`, never guess).**

### The Content Learning Loop *(the one that reaches a real 9 by code alone)*
1. **DRAFT** — `content.draft` finalizer (Item 7a) stages a post from corpus + reinforced patterns, stamped (Item 3).
2. **PUBLISH** *(the one tap)* — `content.publish`, outward, non-grantable. `externalId` (the real `postId`) is persisted onto the artifact.
3. **SCORE** *(unattended, 72h later)* — the insights-read pulls reach **only for the stamped post** (Item 3's join).
4. **REINFORCE** — a post beating median reinforces its angle/hook pattern; an underperformer decays it (`outcomeLoop.ts`).
5. **COMPOUND** — the next draft leads with the higher-confidence pattern.

- **What closes it:** IG insights flow back API-side with **no human in the loop** — the unique property that lets this compound autonomously where revenue cannot.
- **What would silently break it:** the unstamped account read (`insights.ts:116`) attributing the gym's posts to Aurelius's patterns → **Item 3 is the non-negotiable precondition.**

### The Self-Healing Spine *(Items 9 + 10 + the deferred reliability metric)*
1. **DETECT** — every spine job writes its `JobRun` status; the hourly supervisor reads `failed`/missing.
2. **HEAL** — same-day re-fire under the atomic claim, bounded to 3 attempts. Most transient failures die here, silently.
3. **ESCALATE (once)** — a job that exhausts retries pages Cole once, with the fix.
4. **MEASURE** — the "days since Cole had to look" counter resets only on step 3, never on step 2.

- **What closes it:** the metric in step 4 is the feedback — if it stops rising, the healing regressed.
- **What would silently break it:** the supervisor double-firing against the live cron (mitigated — both go through `claimDailyRun`), or the failed-row claim path never landing (Adversary L3). Residual risk the Reliability chair named: *"a retry that succeeds mechanically but produces a degraded result — the JobRun says 'done,' the metric stays clean, but the output was thin."*

---

## 4. THE JARVIS DAY

*Cole asked for this by name. Every capability cites its item number and is buildable from
§2 — none is fantasy. The rule holds all day: Aurelius finalizes inward work silently and
stops at Cole's thumb for every outward send. What reaches his phone is a decision, never a
status.*

**05:00 — while Cole sleeps.** The db backup ran at 02:00 and, this being Sunday-adjacent,
was **restored into a scratch DB and row-counted** — the second brain is provably
recoverable (**Item 10**), silent. Overnight the freshness gate (**Item 8**) confirmed
every connector read is current; a 7-day OAuth expiry would have filed one *"reconnect
Gmail"* notice rather than letting the morning's loops close onto a stale mirror.

**06:00–06:45 — the spine wakes.** RSS, market pulse, schedule-protection. The hourly
supervisor (**Item 9**) checked: last night's debrief errored at 21:30 and, instead of
being dead till tomorrow, was re-fired at 22:00 and succeeded — Cole never knew. Nothing
reached his phone.

**07:00 — the one thing he reads.** The morning briefing. Its biggest-risk footer now has a
**revenue sibling** (**Item 5**): *"Your 40 min of confirms last week drove $1,200 — the
`competency_standard` angle is closing 2× `measured_numbers`, so I'm leading with it. Three
warm leads have gone quiet past their window; drafts are ready."* This line **cites a
pattern Cole never typed** — a `confirmed_heuristic` compiled from his own recorded sends
(**Items 6, 7**). It arrives on his phone; it is not a screen he opened.

**07:40 — the single tap.** Over coffee: three drafted follow-ups (**Item 6**), each staged
as a gated `outreach.send`, each speaking Cole's real posture from `CONFIRMED_FACTS`. He
reads, edits one word, taps Confirm three times. *(Honest caveat, L1: until a `gmail.send`
scope + finalizer land, the actual send is Cole tapping send in Gmail — the draft-and-surface
is the genuine leverage; the "background send on one confirm" is uncosted.)* Each tap books a
`TouchPoint` keyed to lead + angle (**Item 1**). **This is the only revenue work he does all
day.**

**09:00–17:00 — he coaches; Aurelius operates.** Cole is on the gym floor. In the
background, with **zero pings** into his sessions:
- The 10-min Gmail poller (**Item 2**) matches an inbound reply from Marcus on the thread
  Aurelius drafted into — advances his lead `contacted → replied`, writes the outcome onto
  the `competency_standard` angle. **Cole types nothing; the pipeline updates itself.**
- A prospect who replied "what's the price?" trips an objection tag; the offer judge notes
  it against close-rate (feeds the deferred re-pricing engine).
- Yesterday's published post crosses its 72h mark; the insights-read pulls its reach **for
  that stamped post only** (**Item 3**), reinforcing the hook pattern that drafted it
  (**Item 7**) — next week's drafts lead with it.
- An unmatched reply (a prospect who wrote from a personal Gmail, not the address on the
  lead) logs `unattributed` — **never `lost`.** The angle is starved of one data point
  rather than fed a lie.

**13:00 — silence.** The midday check runs and says nothing, because Cole is on pace. Calm
is silence; the system's discipline is to not speak.

**18:30 — one decision, not a report.** The salience gate has held everything non-urgent for
his real evening read-window. One line reaches his phone: *"Client X renews in 9 days, no
renewal touch logged — here's a check-in draft. Send?"* (deferred §7.4 delivery, on Item 1's
`Deal` terms). He taps Confirm. A saved client outweighs a new lead.

**21:15–21:30 — the queue sweeps, the debrief lands.** Keyhole backlog applies under grant
(inward knowledge writes only — the Adversary's K6 reminder: this closes *knowledge*, not
deals). The debrief names tomorrow's opening move and checks the streak sentinel — a read,
no confirm.

**Sunday — the compounding shows itself.** Weekend sweep → wiki; persona observer; weekly
planning; **the scoreboard (Item 5)** posts the money block — `$ booked · replies/sends ·
pipeline`, and the hero: **dollars per hour of confirm-time, up 18% month over month while
his minutes stayed flat.** The shadow-eval sampler (**Item 4**) re-asks 5% of the week's
reuses; `reuseCorrectionRate` holds at 3%, so the falling `llmDependenceRate` is *earned*,
not farmed. The content patterns reinforced by real reach (**Item 7**) reshape next week's
drafts. **No human typed a single outcome all week.**

### The literal "double my workload" answer

| Cole does today, by hand | At **8** | At **9** | At **10** |
|---|---|---|---|
| Remembers who to follow up with (drops it when the day runs long) | Ledger holds every lead's stage; sweep drafts every overdue follow-up (I1, I6) — ~2–4 h/wk absorbed | Drafts lead with the angle that's *measurably* converting (I6, I7) | — |
| Types "did they reply?" into nothing | Reply self-records on the stored thread (I2) — ~30–45 min/wk | Reply-rate per angle is a live series with no manual rows | — |
| Guesses which post worked | Stamped post → real reach → reinforced pattern (I3, I7) — ~1 h/wk | Content re-ranks on leads-per-post, not likes | — |
| Wonders "is any of this working" | Money on the briefing, reconstructed not self-reported (I5) — ~1 h/wk | Dollars-per-hour-of-attention trends up, confronting | — |
| Re-derives "am I charging right" | — | Price re-proposes from ratified evidence (deferred R3) | — |
| Remembers renewals (or doesn't) | `Deal` terms tracked | Churn signals raise priority | Retention is a system property — renewals surfaced before they lapse |
| Forensically reruns failed jobs | Same-day self-heal (I9); backups proven restorable (I10) | "Days since Cole had to look" rises as the spine gets busier | Invisible infrastructure under all five operators |

**The honest shape of the doubling** (Chief of Staff): *"a J-curve, not a step — the first
month of any new lane costs Cole more review, not less; the doubling shows up only once
volume and confirmed-history accumulate. Anyone promising these items double his throughput
in week one is selling the destination as the departure."*

---

## 5. THE SYSTEM'S OWN SCOREBOARD

The metrics Cole checks monthly to see it **compounding AND earning** — each with its
gaming failure mode and the guard, because *"one false dollar burns the whole surface."*

| Metric | What it proves | Gaming failure mode | The guard |
|---|---|---|---|
| **Dollars per hour of confirm-time** *(hero)* | Money per minute of attention, rising while minutes stay flat | Counting drafted intent as income | `earnedCents` sums only `paid` rows reached by an observed event or Cole's tap (Item 1 invariant); `status:"acted"` is never counted |
| **`drafted` vs `paid`, reported separately** | Pipeline depth without inflating revenue | Summing pipeline into one flattering total | The two numbers *never merge* — enforced in `computeWeeklySnapshot` (Item 5) |
| **Reply-rate per angle** | Outreach learning from its own sends | False-negative starvation (reply from another address/channel) | Unmatched reply logs `unattributed`, never `lost` (Item 2 mandate) |
| **Leads-per-post** | Content that compounds toward bookings | Attributing the whole account's reach to Aurelius | Authorship stamp; join only to stamped posts (Item 3) — ratio must = 1.0 |
| **`llmDependenceRate` + `reuseCorrectionRate`** | Compiled understanding actually right | Loosening reuse thresholds to "improve" the number | Corrections retroactively un-count; 5% shadow-eval; alarm if dependence falls while corrections climb (Item 4) |
| **`recordedBy:"aurelius"` share of attribution** | The machine keeps its own books | Cole quietly doing the data entry the system claims | `recordedBy:"cole"` must stay flat while aurelius climbs (Item 1) |
| **Hours absorbed = Σ(draftHours × absorptionScore)** | Leverage, not production | `count(drafts)` as absorption | Edit-distance to what shipped; a rewritten draft scores ~0 (deferred Adversary 5 — *itself a floor, gameable by generic low-edit drafts*) |
| **Days since Cole had to look at a non-happening** | The spine self-heals | A degraded retry marked "done" | Counter resets only on Cole-visible failure, never on silent self-heal (Item 9 + deferred Reliability 4) |
| **Weeks since a successful restore-verify** | The moat is recoverable | `bytes < 1024` passing a corrupt dump | Weekly `pg_restore` + row-count into scratch (Item 10) — must stay ≤1 |

The Adversary's standing rule over the whole board: *"these items raise the cost of
self-deception from 'write an optimistic row' to 'fabricate an external event,' and force
the lie to happen somewhere a correction can find it. That is a real gain. It is not a
guarantee."*

---

## 6. BUILT TOGETHER OR NOT AT ALL

Sets where a partial build is *worse* than none — a half-connected loop reports health
while lying.

- **Item 1 (ledger) + Item 2 (attribution).** A ledger with no self-recording puller is a
  CRM Cole must hand-maintain — i.e. the thing he'll never do. Attribution with no ledger
  has nowhere to write. Neither ships alone.
- **Item 3 (stamp) + Item 7 (content learning).** *The load-bearing pairing.* Ship Item 7
  without Item 3 and the content patterns **learn from the gym's posts and Cole's dog
  photos** (`insights.ts:116` reads the whole account). That is not a weak loop — it is a
  correlated-noise generator that actively poisons the drafter. Item 7 without Item 3 is
  **negative value.**
- **Item 4 (correction-coupling) + any tier-9 claim citing `llmDependenceRate`.** Every
  chair's "dependence falls → we compound" (Revenue 5, CoS 5, SysArch 4, Skeptic 5) is
  farmable until Item 4 lands. Ship the compounding narrative without the de-gamer and the
  headline metric is cosmetic.
- **Item 8 (freshness gate) + the Honest Outreach Loop.** Without it, a dead Gmail token
  makes the loop report a healthy 0% reply-rate while blind, poisoning angle-learning on
  false negatives. The gate is a prereq, not a nicety.
- **Item 9's failed-row claim path (L3).** Half-built, the supervisor *silently skips every
  failed job it exists to retry* (`claimDailyRun` never matches `status:"failed"`). A
  supervisor that looks like it's running and rescues nothing is worse than no supervisor —
  it manufactures false confidence over the exact failure it was built to catch.

---

## 7. REJECTED — what the Adversary killed, with reasons

- **K1 — Chief of Staff Item 2 (trust-earned summarization) as applied to OUTWARD actions.**
  Collapsing "publish the drafted post" ×N into one *"tap to release all"* dispatches three
  outward publishes on one tap — **not** "Cole confirms every instance," the hard constraint
  `checkGrantable` (`actionClasses.ts:174`) exists to hold. *"The moment 'release all' fires
  3 `content.publish` finalizers on one tap, it manufactures grant-like behavior on the exact
  class that is non-grantable by construction."* **Survives only restricted to inward
  classes** — at which point its "2–3 h/week absorbed" (which came from batching the
  high-volume *outward* taps) collapses. Kept in the deferred list, inward-only.

- **K3 — Product Skeptic Item 5 (the dated-citation brief) as a tier-9.** *"A 7 in a 9
  costume."* At HEAD patterns compile from training and chat only; there is no content or
  business pattern to cite until Items 3 + 7 land. For months the "provably knows what you
  didn't tell it" moment is *"provably reminds you of a training heuristic."* The dated
  citation is a real 6-fix (folded into Item 5's briefing line); the tier-9 claim rests
  entirely on two other items landing first. **Demoted, not deleted.**

- **Skeptic Item 2's monthly "machine scoreboard" as a standalone screen.** The author named
  it *"the one screen he checks."* The charter is explicit: a surface Cole must visit is a
  5-item. **Survives only by riding the existing 07:00 briefing push (Item 5); as a new page,
  killed.**

- **K2 — Systems Architect Item 5 (reachability audit) as a tier item.** Real and good, but
  it's *"enabling-hygiene, not a tier item — a lint check whose 'protects 8/9' framing
  oversells it."* Kept in the deferred list as CI hygiene.

- **The council's ~74h of duplicated ledger builds → one ~15h build.** The money ledger was
  designed five times (Revenue 1, CoS 1, SysArch 1, Skeptic 1, Adversary 2) and assumed by a
  sixth (Reliability 3); attribution-via-threadId four times (D4); the content-outcome loop
  four times (D5). **Collapsed to Items 1, 2, 7** — the design disagreements (state-machine
  granularity, `ActionRecord` vs `Touch`) reconcile in a single schema.

- **Adversary K4, stated for the record:** *"No auto-send violations found, and that's worth
  stating. Every chair respected the outward gate. The council's discipline held."*

- **Not rejected but permanently capped:** any framing of the 21:15 queue sweep as
  "closes deals overnight" (it auto-applies *knowledge* proposals under keyhole — inward
  hygiene, never outward, K6); any grant-flywheel item where *ignored* proposals count as
  confirms (silence never rewards, K8); any "actions completed" money metric reading
  `BridgeSignal` status instead of an observed external event (K5).

---

## 8. WHAT A JARVIS MACHINE STILL CANNOT DO

*The honest residue — stated without lowering the ambition. Every chair named a limit; the
sharpest are preserved.*

**The `paid` transition happens off-network for most of a gym business.** A walk-in coaching
business collects cash, in-person, Venmo. No connector observes that event (Adversary L2). So
`MoneyEvent → paid` is reached by **Cole's one-tap "they paid"** for the majority of revenue —
a human re-entry at the single most important state transition. *"Revenue that records itself"
is really "revenue Cole confirms in one tap."*

**There is no send channel — Aurelius physically cannot send an email.** `gmail/engine.ts` is
compose-only (`engine.ts:17,109`); `outreach.send`/`email.send` have no finalizer
(`registerActions.ts`); `confirmAction` refuses to run without one (`executor.ts:223`).
"Cole taps Confirm → it sends" is **unbuilt at HEAD** and requires a `gmail.send` scope
escalation nobody costed (L1, D2). The honest path today: Aurelius drafts into Gmail *drafts*;
Cole taps send in Gmail himself. The loop still *attributes* — but "background send on one
confirm" is theater until the scope lands.

**Attribution's last mile in an in-person business is un-instrumentable.** *"A parent who saw
Cole's post, thought about it for three weeks, and walked into the gym leaves no digital thread
my code can follow"* (Revenue chair). Leads-per-post leans on one human act — Cole tapping the
source once at intake. Reply-rate is a *proxy* for demand, not revenue; a booked call is not a
paid client. The system logs `unattributed` rather than manufacture a number the offer engine
then re-prices on.

**Drift detection is heuristic, not semantic.** It catches "outcomes stopped flowing" and
"shape changed to yield zero," but *"an API that keeps returning plausible-looking but wrong
data — a metrics endpoint that starts returning a different account's numbers — passes every
invariant I can cheaply assert"* (Reliability chair).

**An in-process watchdog cannot report a corpse.** Items 8–10 run *inside* the node process;
if it's crashed, powered off, or the disk is gone, none fire and the "days since Cole had to
look" counter freezes at a comfortable number while nothing runs. The only real guard is the
**external** dead-man ping (`HEALTHCHECKS_PING_URL`, stubbed at `index.ts:1709`) — a hard
deploy precondition on the Mini, a config line, not code. *"My items make the system heal
itself while it's alive; they cannot make a corpse report its own death."*

**The anti-gaming layer is itself an arms race.** `absorptionScore` via edit-distance is fooled
by a draft so generic there's nothing to edit — high absorption, low value. The shadow-eval
spends real tokens and could be tuned to agree with the cache. *"Instrumentation is an arms
race, not a proof. The most I can honestly claim is that these items raise the cost of
self-deception."*

**And the deepest limit is not technical.** The `gym_arrangement` open-question
(`business/profile.ts:132`) — *who owns the client, and can Cole even sell his own offer there*
— is a relationship and possibly legal fact that gates the entire ledger. *"If everything routes
through the gym's membership, Cole doesn't own the payment row, and a Revenue Operator optimizing
his personal outreach could quietly put him crosswise with the employer who feeds him. My machine
can measure and compound demand; it cannot resolve whether that demand is Cole's to capture. That
answer is his, and it is upstream of every dollar I designed."*

---

## THE COUNCIL'S CONVERGED CEILING

*(The Adversary's verdict, which the chairs did not contest.)*

> **A solid 8 system-wide; a real 9 on exactly one loop; 10 unreachable by code alone.**
>
> Build the converged survivors and the system genuinely reaches **8**: every operator
> prepares to the last reversible step, outcomes land on a ledger that can't lie, and review
> burden falls because attribution self-records.
>
> **9 is reachable on the content loop and nowhere else by code alone** — Instagram insights
> are the only money-relevant outcome that flows back over the network with no human in the
> loop. Email reply-rate is a *near*-9: it self-records, but the send re-enters Cole.
>
> **The revenue 9 is structurally gated, and no engineering closes it**, because two of the
> five operators' money events happen off-network: the `paid` transition is cash/in-person,
> the `send` channel is compose-only. The most honest thing this codebase can be is a **second
> revenue bookkeeper-and-drafter that reduces Cole's pipeline to two one-tap confirms — send,
> and "they paid"** — not a second operator that closes revenue while he sleeps. That is a
> genuine doubling of *throughput per minute of his attention*, which is the charter's actual
> test, and it is worth building. The loops close without him for **content**; they close **to
> a tap** for money — and the council should say so rather than let the ledger imply an
> autonomy the connectors can't deliver.
