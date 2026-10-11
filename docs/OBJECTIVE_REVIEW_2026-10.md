# Aurelius — Objective Review (2026-10-11)

> Commissioned by Cole: *"take an objective view of the project and of the actual
> code itself… from at least 6 different perspectives… see what I am missing or
> what we have produced too much of for no reason… what is possible to make and
> what can really push me forward."*

**How this was produced.** Because I built much of this code and cannot review my
own work objectively, the assessment was run by **ten independent reviewers**, each
reading the real codebase through one lens with no stake in having written it, plus
**two external research tracks** (web-sourced, cited) to test the recommendations
against the market rather than against my own opinion. The ten lenses: daily-life
operator · revenue/passive-income realist · architect · dead-weight auditor ·
reliability/SRE · Jarvis-gap strategist · CEO/capital-allocator · senior developer/DX
· security/trust · AI-leverage futurist. Their findings agreed to a degree that is
itself a finding.

---

## The one-paragraph verdict

Aurelius is an **extraordinary brain bolted onto a business that does not exist yet.**
The core — memory, judgment, the gated action executor, the self-diagnostic, the
morning briefing — is genuinely world-class and is a real asset. But roughly **40% of
the ~68,000 lines is machinery built *ahead* of its first customer** (a full CRM,
marketing engines, an attribution funnel, client-lifecycle automation) for a coaching
business with **zero clients and zero inbound**, while the two things actually named in
the goal — *"stay on top of my life"* and *"passive income"* — are thin and absent
respectively. The market sells every commodity piece of this for **$0–30/month**. The
binding constraint was never software; it is **demand**, and the only thing that
produces demand at zero audience is human warm outreach the system can draft but cannot
do for you. The move is not "finish it" and not "throw it away" — it is **point the
bespoke brain at the few things the market can't sell (your life + your judgment +
your outreach), rent the limbs, cut the dead weight, and go get the first client.**

---

## Part 1 — What's genuinely good (the moat — protect this)

Every lens, including the harshest, agreed these are real and worth keeping:

| Asset | Why it's a moat | Where |
|---|---|---|
| **The gated action executor** (act-inward / gate-outward / undo / trust ledger) | Exactly the right abstraction for a system that acts on your behalf; security review found **no path** for an outward action to fire without your confirm, *by construction* | `autonomy/executor.ts`, `actionClasses.ts` |
| **The doctor** (self-diagnostic) | The one component that tells the truth — it caught the 100% failover, the stranded vectors, the rotting OAuth. Call it the home screen | `core/doctor.ts` |
| **4-layer memory + judgment + one voice** | Context on *your* data, philosophy, corrections, persona — this is the part no SaaS can sell you | `memory/`, `knowledge/`, `retrieval/`, `llm/router.ts` (used by 44 files) |
| **Morning briefing / debrief / rituals** | The single delivered daily-life value: one fused push (calendar + tasks + commitments + risk line). Still ships if every key is missing | `rituals/engine.ts` |
| **Telegram capture** (voice → Whisper, photo-of-schedule → calendar, brain-dump split, inline confirm/undo) | A legitimately low-friction pocket command channel | `telegram/bot.ts` |
| **Reliability + honesty discipline** (reachability audit, smoke suite, dormant-until-configured, honest-failure, "render zero as zero") | Best-in-class anti-rot machinery; these are what make an *agentic* system trustworthy | `scripts/reachabilityAudit.ts`, `scripts/smokeSuite.ts` |
| **Secret handling** (hard rule 6) | Verified honored in code — OAuth tokens written raw, excluded from the index, never reach a prompt or log | `knowledge/store.ts`, `google/oauth.ts` |

---

## Part 2 — What's overbuilt (cut / freeze / kill)

The numbers, triangulated independently by the architect and the dead-weight auditor:

- **~40% of the backend** is reachable-but-pointless — it passes every check the repo
  enforces, but acts on data (clients, leads, roster, Instagram) that doesn't exist.
- **~21 of 53 DB models** model a business/marketing pipeline with no data; **1 model
  is fully dead** (`AutonomyGoal`, 0 references).
- **~13 of 27 scheduled jobs** fire into empty tables every day (`outreach_sweep` →
  0 leads, `retention_sweep` → 0 clients, `marketing_pass` → no offer, etc.).
- A clean **~30% (~16k LOC) can be cut** with zero loss to anything used on a normal day.

### KILL — delete now, zero loss (~2,000 LOC)
- **Dead modules (0 importers, ~1,100 LOC):** `assessment/benchmarks.ts`,
  `self/selfUpgradeEngine.ts`, `engines/engineAdapter.ts`, `identity/preferences.ts` +
  `identity/profile.ts`, the `memoryEvolution/` orphan cluster, the `nervousSystem` +
  `autonomyEngineDB` + `/api/autonomy/tick` cluster (reachable from nothing live).
- **Redundant second routing stack (~900 LOC):** `core/engineRouter.ts` +
  `registerEngines.ts` + `engineRegistry.ts` + `engineTypes.ts` — re-implements
  `llm/router.ts` provider-for-provider. NORTH_STAR has flagged this as debt since July.

### FREEZE — good code, ahead of demand (stop adding; flag `config`, not `live`)
- The speculative **Business Engine** that CLAUDE.md itself marked *"do not build"* and
  that got built anyway (~90 KB): `offers.ts`, `positioning.ts`, `marketing.ts`,
  `paidBoost.ts`, `partnership.ts`, `productization.ts`, `marketIntel.ts`, `brand.ts`,
  `flightSim.ts`, `analyst.ts`. Offer engines with no price, campaign engines with no
  audience, a flight-sim with no numbers.
- **CRM past Lead → Client → Invoice/Payment:** `retention.ts`, `performance.ts`,
  `sms.ts`, `onboarding.ts`, `paperwork.ts`, `trackLinks.ts` — lifecycle automation for
  a roster of zero.
- The **empty-table cron jobs** — gate them behind a "has leads / has clients / has
  roster / has Instagram" boot check so the spine only schedules what can produce.

### DEMOTE — the futurist's subtraction: machinery fighting a war that's over
The "lean on the LLM less over time" thesis was a 2024 scarcity bet that cheap
long-context frontier models have invalidated. These now cost more complexity than they
save and should be demoted or retired:
- `compiled/shortCircuit.ts` + `semanticReuse.ts` (the ≥93% answer-reuse cache that has
  **avoided 0 LLM calls** and may never trip its own gate at single-user volume).
- The `llmDependenceRate` scoreboard metric (treats the now-cheap part as a defect).
- `llm/directiveParser.ts` — the regex `[TOOL: …]` path, legacy scaffolding for weak
  models; consolidate on native function-calling and delete a whole class of bugs.

---

## Part 3 — What's missing / what's possible (ranked by leverage)

The good news from the futurist lens: most of what would make this *feel* like Jarvis
is **connection work on substrate that already exists**, not new foundations.

| # | Capability (what's possible) | Why it matters | Effort | Status today |
|---|---|---|---|---|
| 1 | **Missions that ACT** — connect the autonomous loop to the executor | Chat already runs a full gated tool-loop; scheduled missions can only `recall/research/synthesize`. This is *the* Jarvis unlock — "finalizes inward work on its own" | MEDIUM | Substrate ~100% built, unconnected |
| 2 | **Horizon watcher / life reminders** — fire on upcoming events + due tasks | The #1 daily-life gap: it knows your 9am but will never ping you at 8:45. No reminders primitive exists at all | SMALL–MED | Data + delivery rail exist; the firing job doesn't |
| 3 | **Daily doctor push to your phone** | The #1 reliability risk is *silent degradation* — it runs on backup generators for weeks and you only know if you open the doctor. One scheduled job closes all three recurring failures (credits, token rot, stranded vectors) | SMALL | Reuses existing `runDoctor()` + push path |
| 4 | **Unlock rate-limit + high-entropy secret** | The #1 security hole: `/api/unlock` takes unlimited guesses, and that one cookie = authority to tap "Confirm" on any send/publish | SMALL | Trivial fix, high severity |
| 5 | **Warm-list outreach, pointed at the real constraint** + one-tap send from the briefing | The only channel that produces clients at zero audience. The engine exists; it needs an import box, a Send button, and to be *aimed* | SMALL | ~80% built in `crm/leadEngine.ts` |
| 6 | **Close the voice loop** — auto-deliver TTS as a voice note + mic in the app | The difference between "has TTS" and "talk to it like Jarvis" | SMALL–MED | STT live, TTS exists but not wired |
| 7 | **Content → distribution flywheel** — one researched angle → a week of grounded posts | The right place to spend AI leverage (top of funnel); a *parallel, long-horizon* audience build | MEDIUM | `deepWork` + content queue + IG publisher exist |
| 8 | **Stripe checkout + auto-fulfilled digital product** | The first genuinely *passive* loop — but audience-gated, so later | MEDIUM | Billing shape modeled; collection + fulfillment absent |
| 9 | **Life-people / relationship layer** (non-client CRM) | "Stay on top of things" is largely a people problem; today it only models *paying* people | MEDIUM | Absent |
| 10 | **CI + one `verify` command**, then `strict: true` | Every quality gate is currently unenforced; `strict:false` is off in both trees; green means "wired," not "works" | SMALL | World-class tests exist, just not enforced |

**Passive income, stated plainly:** it is **absent** from the codebase (the "wealth
engine" is a read-only market digest; finance is a manual ledger). And per the research
it is **audience-gated** for *every* model (products, cohorts, membership, affiliate) —
so it is a Phase-3 bet, not a now-build. The one semi-passive asset buildable today at
near-zero cost: a **productized one-off program** (a byproduct of client work) that
doubles as a lead magnet and a low-ticket offer.

---

## Part 4 — The uncomfortable core finding

Three independent lenses (CEO, Jarvis-gap, both research tracks) landed on the same
sentence, so it has to be said plainly:

> **The tool became the project, and the business became the justification for the tool.**

Evidence: the repo ran hot for ~3 months (194 commits, often 15–26/day) and has been
**idle ~7 weeks** (1 commit since Aug 28). Your own `business/profile.ts` names the
binding constraint in writing — *"a pipeline with nothing in it earns nothing… the
unblocking sequence is a defined offer, then a channel that creates demand, then
capture"* — and then ~90 KB of marketing engines got built for customers that have
never existed. You diagnosed the disease in code and then wrote more of the symptom.

This is not a character flaw — it's the most common failure mode for technical founders,
and the research confirms it: *"building before validating"* is **the** mistake solo
coaches make. The fix is not more code. It's four 20-minute human inputs you've been
deferring (pricing, a narrow offer, a warm-name list, publishing the OAuth consent
screen) and sending the messages.

---

## Part 5 — Recommended course of action

This reconciles every input, and it honors both of your goals (make Aurelius your
Jarvis **and** push the business). The key reframe: **Aurelius's job is not to be the
coaching business's software — rent that. Its job is to be your life chief-of-staff and
the force that makes you do the human work that actually moves the business.**

### This week — the highest-ROI moves are human, not code
1. **Decide pricing** for the three shapes (monthly / 8–12 wk block / one-off).
2. **Write one narrow offer** you can say in two sentences (who you help, what changes).
3. **List 30–50 warm names** — your *personal* network only (gym athletes are your
   employer's — off-limits per the boundary rule; be honest that this removes the easy
   pool).
4. **Unblock the brain (≈30 min of ops, not building):** top up Anthropic credit,
   publish the Google OAuth consent screen (kills the weekly Gmail/Calendar death), run
   the embeddings backfill (fixes the 208 stranded vectors). PR #90 (the backfill mock
   guard) is ready to merge.
5. **Point Aurelius's warm-list draft loop at the 50 names** and start sending ~10/week,
   personally, asking every contact for one referral. This is the founding-client
   campaign — days-to-weeks to first revenue, per every credible source (Hormozi's
   first-5 playbook, Goodman/PTDC).

### This month — make Aurelius earn its keep as Jarvis, and subtract
- Build **#2 (horizon watcher)**, **#3 (daily doctor push)**, **#4 (unlock security
  fix)** — small, high-value, all make the thing you already have more trustworthy and
  more Jarvis-like day to day.
- **Rent the limbs** (~$0–30/mo total): a coaching platform (TrueCoach ~$26/mo or
  Everfit free) for client delivery, **Stripe** for money, **Calendly** free, **HubSpot
  free** or a spreadsheet for pipeline, **Kit** free for email. Stop building these.
- **KILL + FREEZE** per Part 2: delete the ~2k dead/redundant LOC, flag the business
  engines `config`, gate the empty-table crons. Get the line count *down* — the research
  is blunt that a 68k-LOC system a non-engineer can't fully audit is a compounding
  liability (AI-authored code ships ~1.7× more major bugs, ~2.7× more vulns).

### This quarter — leverage and the genuinely-possible
- **#1 (missions that act)** — the real Jarvis unlock, once the daily basics are solid.
- **#6 (voice loop)** and **#7 (content flywheel)** as a *parallel* long-horizon audience
  build (judge it on conversations started, not followers — content is discovery, not
  your first client).
- **#8 (Stripe + one digital product)** only once the flywheel has produced an audience
  to sell to. That's your first real passive-income line.

---

## Part 6 — Allocation scorecard

| Domain | LOC (approx) | Verdict | Action |
|---|---|---|---|
| Core brain (router, memory, executor, doctor, rituals) | ~12k | **Moat** | Protect, polish |
| Daily-life surfaces (calendar, briefing, Telegram, productivity) | ~5k | **Moat, under-finished** | Finish #2/#6 |
| Business engines (`business/`) | ~2.9k | **Overbuilt for 0 clients** | Freeze → `config` |
| CRM (`crm/`) | ~3.1k | **Keep lead/warm-list door; freeze the rest** | Aim #5; freeze lifecycle |
| Content / Instagram / media | ~1.7k | **Keep `draft`; rest dormant** | Flywheel later (#7) |
| Learning/curriculum/compiled | ~5.5k | **Payoff needs volume you don't have** | Demote reuse cache; keep corpus study modest |
| Dead + redundant | ~2k | **Dead weight** | Delete now |
| Passive income | ~0 | **Absent + audience-gated** | Phase 3 (#8) |

---

## Appendix — the ten lenses in one line each

1. **Daily operator:** proactive on a clock, blind to the moment; no reminders; ~12/27 jobs serve the system, not you. Gap = horizon watcher.
2. **Revenue realist:** ~6k LOC of honest 1:1 machinery that all ends at a *draft*; passive income 0%; marketing never reaches an audience (stops at draft).
3. **Architect:** coherent core, 2–3× over-built shell; ~40% of models speculative; dual router is deletable debt; outgrown a non-engineer's ability to *change* it.
4. **Dead-weight:** ~40% waits on data/clients that don't exist; ~1,100 LOC fully dead; clean 30% cut available.
5. **Reliability:** strong honesty substrate but *silent degradation, pull-only diagnosis*; ~70 env vars / ~9 funded; fix = daily doctor push.
6. **Jarvis-gap:** impressive, strategically misaimed; the ambient event bus exists but is wired to 3 business events and no life events; redirect it at your life.
7. **CEO:** extraordinary engineering, disastrous capital allocation; the one bet is 4 human inputs + 15 messages, not a build.
8. **Developer/DX:** best-in-class dead-path detector, but *no CI and `strict:false`*; green means wired, not working; 7–9 silent wiring points per feature.
9. **Security:** outward gate sound by construction, rule 6 honored, injection contained; one real hole = unthrottled `/api/unlock` = online route to full takeover.
10. **Futurist:** the forward motion is *three connections + one subtraction* — connect missions-that-act, voice, and the content flywheel; subtract the "avoid-the-LLM" machinery.

## Appendix — research sources (external, cited)

**Build-vs-buy / tooling:** coaching platforms (TrueCoach, Everfit, Trainerize — $0–137/mo),
Stripe (2.9%+30¢), HubSpot free CRM, Calendly free, Kit free, Kajabi/Skool/Circle
(course/community, later) — all commodity, team-maintained, rentable. AI-code debt data:
CodeRabbit (Dec 2025) ~1.7× major issues / ~2.7× vulns in AI-co-authored code.

**Zero-to-first-client / passive income:** Hormozi "first 5 customers" + Jonathan
Goodman/PTDC (warm outreach is the only zero-audience channel; paid ads almost never
produce the first roster); first clients in days-to-weeks from 30–50 warm contacts at a
founding rate; every passive model (products/cohorts/membership/affiliate) is
audience-gated → Phase 3; the universal mistake is *building before validating*.

*(Full URLs captured in the research-track transcripts for this session.)*
