# THE JARVIS COUNCIL — SYNTHESIS

*2026-08-11. Eleven seats, two rounds, six file-by-file territory sweeps
(every file in the repo read). This is the resolved program. It is not a build
order Aurelius will execute on its own — it is the council's ranked
recommendation for Cole. Nothing here ships without his pick.*

Full evidence: `seats/` (round 1), `round2/` (chairs cross-examined under the
sweep evidence), `sweeps/` (the six territory reads). Every claim below carries
a `file:line` in its source report.

---

## THE ONE-PARAGRAPH VERDICT

Aurelius is **real, mostly honest, and starved** — not bloated, not fake. The
organs of a "super Jarvis second operator" are largely built and genuinely
wired (the executor/keyhole/undo spine, the CRM+lead engine, the compiled-pattern
loop, the battery/record wall, the content lane). What's missing is not
features — it is **fuel** (real embeddings, granted keyholes, a warm list, one
priced offer, a connected calendar), **presence** (the voice can't be heard
when it fails and forgets what it just said), and a **fix-and-delete pass** on
~40 defects and ~1,600 dead lines the sweeps found *inside* the built machinery.
The Jarvis feeling is not a capability count; it is *reliability under use*, and
this system has never had a day of real use. The path is therefore: **fix the
lies, delete the dead weight, pour the fuel, then — and only then — add the
three features that make it feel like someone is in the room.**

The single sentence every future proposal must pass (the Contrarian's test,
adopted): **name the invoker, name the user with evidence he exists, and show
the sweep-defect list is empty in every file you touch.**

---

## TIER 0 — THE SAFETY GATE (constitutional; before any grant flips or any key funds)

These are not features. They are the guards that must be green before the
autonomy grants get flipped or the keys get funded — because funding the keys
and flipping the grants is exactly what makes these paths *live*. The Steward
owns this gate; the mind and tools sweeps supplied the evidence.

- **G1 — Scope allowlist at every keyhole choke.** `proposals.ts:167` and
  `queueSweep.ts:52` block only `autonomy`/`persona`; `system` scope passes,
  and `researchEngine.ts:452` forwards an **LLM-emitted scope verbatim** with
  keyhole-eligible `origin:"research"`. Re-derive scope+origin *inside* the
  `knowledge.apply_proposal` finalizer (`registerActions.ts:100-121`) and throw
  unless scope is an explicit content scope. Closes the worst path in the repo:
  an injected web page auto-applying a `system`-scope write with no Cole in the
  loop. **(C1+C2)**
- **G2 — Never embed non-content scopes.** `store.ts:219` indexes every
  knowledge write into the vector index — `system` scope included (hard rule 6
  breach). Guard before `embedSourceSafe`. **(C1-embed)**
- **G3 — Defuse at every door + quarantine external tool output.**
  `defuseDirectives` inside `ingestDocument` (closes Paperless + media + corpus
  in one move), on Gmail adapter outputs (`gmail.ts:48-67` — the cheapest
  attacker channel, today raw into the native-tool loop at `index.ts:1169`),
  and on `analyzeMedia` text before `handleCommand` (`telegram/bot.ts:619`).
  Deny immediate-execution tools (calendar mutate, CRM write) in agentic rounds
  seeded by external tool output. **(C3+C4)**
- **G4 — Authenticate the confirm route.** `frontend/app/api/autonomy/confirm`
  calls `confirmAction` (which runs finalizers "regardless of grant state",
  `executor.ts:240`); the frontend `middleware.ts` gate holds *only when
  `APP_UNLOCK_SECRET` is set*. Add a runtime assert that production ⇒ secret
  present; the frontend sweep confirms every one of the 41 API routes is
  one-dormant-env-var from anonymous autonomy/money writes. **(C6)**

Then, gating the specific grant/spend that touches each surface:
- **G5** — prescription output-scanner before any `write_feedback` (the
  observations-only lock is prompt-only today, `reasoner.ts:677`; a hallucinated
  "5×5 @ 205" reaches a minor's shared sheet). Before any training autonomy.
- **G6** — `detector.ts:160` must never *raise* confidence on re-detection, and
  `tryReuseAnswer` must filter `correctedAt:null`. Corrected knowledge currently
  resurrects (repetition overwrites decay; corrected answers re-serve 14 days).
  Before the trust-flywheel's confirm-counts are trusted to suggest a grant.
- **G7** — `maxRetries:0` on autonomy/business/planning/corpus adapters (today
  they double-fire duplicate grant-confirm cards) + route the agentic loop
  through `runLLM` so the budget alarm can see the priciest turns. Before the
  spend rung.

---

## TIER 1 — THE FIX SPRINT (make the daily artifacts true; ~1 week of build)

The reliability floor. Nearly every seat converged here independently; the
Engineer names the root: **a single-source-of-truth problem that manufactures
bugs.** Fix the meta-defect, not just its instances.

1. **One TZ-correct `dayRange` in `core/time.ts`** — the highest-frequency lie.
   `productivity/service.ts:20` builds "today" in UTC; under America/* this
   **hides Cole's evening (4-8pm) sessions from Today, the morning briefing, and
   session prep** — the flagship artifact wrong daily, for a coach who works
   evenings. One fix, ~8 call sites (service.ts, tools.ts, promises.ts,
   nowContext.ts), five skews closed. *(Hole-Finder #1, Operator #1, both
   sweeps.)*
2. **Delivery-verified sends.** `sendToCole` never throws (`bot.ts:210`); the
   trace pings the Healthchecks dead-man on trace-ok, not delivery
   (`trace.ts:130`) — so the external monitor **certifies briefings Cole never
   received.** Send failure ⇒ job failure ⇒ retry; ping only after confirmed
   delivery; briefing/debrief claims fail-closed. *(Engineer #3, the "can be
   heard when it fails" floor.)*
3. **Ritual conversational closure.** Rituals never enter `recordTurns` (only
   chat does, `index.ts:886`) — reply "why is that at risk?" and Aurelius has no
   record it spoke. And ritual BridgeSignals file without `status`
   (`rituals/engine.ts:90`), re-inflating the awaiting-decision badge +2/day —
   the exact 460-receipts failure the schema comment memorializes. Add the
   status; write ritual output to conversation memory; add a `sendChatAction`
   typing indicator and unserialize the Telegram poll loop. *(Operator, Cartographer.)*
4. **The trust-integrity trio** (= G6, listed here because it's ~15 lines and
   belongs in the same sprint): detector no-raise, corrected-reuse filter, plus
   domain-scope `gatherDomainMaterial` (`wiki/engine.ts:32` pulls memories
   globally — one business fact bleeds into the `training_science` page injected
   every turn). *(Archivist, mind sweep.)*
5. **Spine manifest unification.** The job roster lives in **four** hand-drifted
   copies (index.ts `scheduleNamed`, `ONCE_PER_DAY`, `catchUp.JOBS`, and the
   frontend `upnext`/`JOB_HOURS`/`SPINE`). Three jobs (`retention_sweep`,
   `content_outcome`, `training_trend_sweep`) are **missing from catch-up** — a
   napping Mini loses them silently, the exact defect the file claims it fixed.
   Derive all consumers from one manifest; make `reachabilityAudit` enforce
   *parity and exclusivity*, not just existence (it treats frontend routes as
   non-invokers — the blind spot that produced three false "dead code"
   verdicts). *(Engineer, all sweeps.)*
6. **The training-craft fix gate** (Coach's non-negotiable, before any new
   capture path): plate-notation math refuses to guess (`volume.ts:131` computes
   205, docstring says 115, real gym speech means 225 — quarantine as "unparsed"
   and ask Cole once, because a false PR on the record wall is unrecoverable
   trust); share PR-persistence between both feedback invokers
   (`sessionFeedback.ts` re-announces old PRs forever); decide the feedback
   artifact's audience (candid "Cole's eyes only" text lands in the athlete's
   shared sheet). *(Coach, life sweep.)*
7. **The outreach touch-cap + phantom-follow-up fix** (before the warm-list
   paste): `leadEngine.ts:134` counts gated-never-sent drafts as touches, so an
   ungranted week emails "This is a FOLLOW-UP" to people who received nothing,
   and no cap means dead leads re-draft every 4 days forever — saturating the
   3/day sweep within three weeks at 50 leads. Cap at 3 → `dormant` + one
   closing signal; count only finalized touches. Plus the `kind:"client"` filter
   in `ledger.ts:40` and `scoreboard.ts:81` (the one gym-boundary query miss).
   *(Business, business sweep.)*
8. **Complete `.env.example`** (before Fuel Week) — it omits `AURELIUS_API_KEY`
   (the lock itself), the Twilio/Instagram/Stripe/FRED families, and the frontend
   has none at all. Cole would be guessing variable names from source. Plus the
   funnel-link origin fix: `/l/:code` is built as `window.location.origin` but
   served only by the backend — "copy link" hands Cole a 404. One Next rewrite.
   *(Tools + frontend sweeps.)*

---

## TIER 2 — THE DELETION MANIFEST (~1,600 verified dead lines)

Zero live importers, verified in round 2. **Keep `engines/` (670 lines — live,
imported by `llm/router.ts:12`).** Delete: the v3.4 core scaffold (~496 —
engineRouter/engineRegistry/engineTypes/registerEngines/operatorModes/
nervousSystem/memoryEngine/operatorHelpers/logger/config + `router/engineTest.ts`
+ the `/tick` handler); the autonomy legacy chain (~359 —
decisionEngine/taskPlanner/stateStore/autonomyConfig/autonomyTypes/types/
autonomyEngineDB); the operator stubs (~446, all of `operators/` except
`operatorCores.ts`); dead scripts (~171); the duplicate `business.draft_offer`
block; `chainId`; dead deps (uuid, groq-sdk, @google/generative-ai, ts-node,
nodemon). `/api/autonomy/tick` routes to an unregistered engine and always
200s an error — a feature-shaped trap; unmount it.

---

## TIER 3 — FUEL WEEK (Cole's ~1 evening; only after Tier 0-1)

The Optimist's ignition list, now safe to light because the gate and the fixes
are green:

1. `GEMINI_API_KEY` + `EMBEDDINGS_PROVIDER=gemini` + `backfillEmbeddings --force`
   — flips **four** capability rows at once (memory, vision, web search,
   semantic reuse). **Must follow G6/Fix-4** — real embeddings *arm* the
   un-learning bugs mock kept dormant. Also make the doctor report `mock` as
   `config`, never `live` (mock recall is confident noise; keyless at least
   warns).
2. Google OAuth + **publish the consent screen** (kills the weekly 7-day token
   death) — wakes Calendar, Sheets, Gmail.
3. `TELEGRAM_BOT_TOKEN` + `GROQ_API_KEY` — the pocket channel + voice capture.
4. `APP_PUBLIC_URL` / `MEDIA_PUBLIC_BASE_URL` — the funnel's front door and IG
   publishing.
5. Paste the warm list; answer `first_ten`; price one offer; flip
   `calendar.schedule_protection` and (now guard-enforced) `knowledge.apply_proposal`.

---

## TIER 4 — THE THREE FEATURES ALLOWED THIS MONTH

The only net-new builds that survived the Contrarian's test, all riding
existing plumbing:

- **The nightly conversation distiller** (~100 lines; Archivist). Reclassified
  as a *fix*, not a feature: ConversationTurn is a 48-hour/6-turn whiteboard,
  **never embedded** — so unless the model fired a `[SAVE:]` in the moment,
  "what did Jake's parent say?" is unanswerable after two days. The distiller
  stops the system discarding data it already captured. Gated behind real
  embeddings (worthless under mock). *This is the single change that most
  converts "Cole talked to it" into "it knows Cole."*
- **The clock-anchored session-prep push** (Visionary #4 = Hole-Finder #1 =
  Operator Rung 2 — three seats, one move). A T-60 prep card riding the salience
  gate. Only after the TZ fix (Fix-1) and delivery verification (Fix-2), because
  a prep engine reading a day-window that hides evening sessions preps the wrong
  day. This is the felt "second operator" gap: the spine is cron-shaped, Cole's
  life is event-shaped.
- **The funnel-affordance pair**: the "I texted them" tap on lead cards (the
  phone lane, the only warm-list channel that works today) + a Stripe payment
  link on the one-off "program" offer (the lowest-friction yes a warm list can
  give). Hours, not weeks; the Business seat's 30-day plan needs exactly these.

Everything else the Visionary dreamed — the Earpiece/voice-out, Gym-Floor
Capture, the Film Room, the Apprentice, the Delivery Cockpit, Athlete Zero —
is **deferred with a named precondition**, not rejected. Voice-out earns its
build after `GROQ` is set and ~10 real voice notes transcribe (don't build
voice-out for a channel with zero observed voice-in). Gym-Floor Capture waits
on the plate-math fix (a false floor-audible PR callback is the worst
credibility event available). The Film Room, Apprentice, and Delivery Cockpit
wait on the Mini, one real training block of sheets, and client #1 respectively.

---

## THE DEFINITION OF DONE (the Hole-Finder's acceptance test)

"Second operator" is not declared; it is *passed*. After the fix wave, Cole
can run these:

1. Put a 6pm session on the calendar → it appears in the 07:00 briefing, Today,
   and midday; a prep card lands ~60 min before.
2. Let a 3pm session run into the 4pm slot → Aurelius says something useful
   before 21:30.
3. Decline an event → it never shows busy, never briefs, never triggers a
   post-session nudge.
4. Forward a lead DM at 2pm → same-day push within the hour, channel-aware
   draft; a lead ignored 3 touches goes dormant, not to touch #10.
5. Go dark 48h → Aurelius proposes quiet itself; streaks/promises survive
   excused; no nudges fire; re-entry is a triage, not a wall of red.
6. Correct an answer, re-ask in 3 days → the corrected version, never the cached
   one; the decayed rule stays decayed.
7. Reply "why is that at risk?" to the briefing → a coherent answer referencing
   its own words; typing indicator; badge unchanged by the ritual.
8. Revoke the Telegram token for a morning → the job fails loudly and retries;
   nothing pings "healthy" for a briefing that never arrived.
9. Voice-note "Jake trap bar 2 plates + 25 for 3" → logs as a metric with the
   load Cole means, PR announced once; re-running feedback re-announces nothing.
   "My elbow's barking again" → third mention in three weeks yields one health
   signal; Cole has his own row.
10. Sleep through Monday 08:30 → on wake, catch-up runs retention + trend
    sweeps, traced.

Pass all ten and it is no longer a well-written morning paper — it is someone
in the room.

---

## THE MINI-READINESS GATE (before Railway → Mac Mini)

Deploy blockers, not nice-to-haves (Engineer): Tier-0 + Fix-1..5 shipped; SMB
mount off the critical path (logs → local SSD, backups → local-first, NAS as
copy); no plaintext secrets at rest (the pg_dump holds every OAuth token in
plaintext on an SMB share — encrypt it, add one offsite copy, automate a monthly
restore test); doctor fix-strings localized off "press Apply Changes in Railway";
smoke suite refuses a non-sandbox DSN (its cleanup `deleteMany`s would destroy
real rows); the v3.4 side door removed before the origin is Tailscale-exposed.
Verdict: **Mini-ready for a supervised soak, not yet trustable unattended — and
the gap is exactly this gate.**

---

## THE ORDER, IN ONE LINE

**Gate (Tier 0) → Fix (Tier 1) → Delete (Tier 2) → Fuel (Tier 3) → the three
features (Tier 4) → prove it with the ten scenarios → then the Mini soak.**
Fix the forgetting before adding the remembering; make it true before making it
talk; pour fuel only into gears cut straight. The dreams didn't shrink — they
found their footings.
