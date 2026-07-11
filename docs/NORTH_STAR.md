# AURELIUS — NORTH STAR

The single source of truth for *where we're going and why*. This fuses four inputs
into one direction:

1. The original **Aurelius 3.4 operator-OS roadmap** (engines, autonomy, calendar,
   ops rigor, and the operator-experience Definition of Done).
2. **CLAUDE.md** — the four-layer brain, Living Knowledge, recursive compilation,
   continuous learning.
3. The **Command Deck spec** — two-lane + bridge product, productivity plane,
   local-first deployment.
4. The **actual code on the branch** (audited), which supersedes every stale
   "current state" snapshot in the docs above.

CLAUDE.md remains the working-rules / hard-rules / voice doc. This is the map.
Where they disagree on phase numbers or state, **this doc wins** and CLAUDE.md gets
reconciled to it.

---

## 1. Vision

Aurelius is one system that is three things at once, in one voice:

- **A Jarvis-level operator OS** — takes natural-language missions, plans, routes,
  and executes across engines, tools, memory, and a real calendar; surfaces its
  thinking and state through a cockpit.
- **A second brain** — persistent, structured, recall-able understanding of Cole,
  his work, and his world; capture in, the right thing back out at the right moment.
- **A compounding intelligence** — reasons from accumulated, provenance-tracked
  understanding rather than from scratch, and leans on the base LLM *less* over time
  as its own knowledge and reasoning compile.

Coaching-origin, whole-life scope, local-first and sovereign. Not a chatbot, not an
LLM wrapper. An operator Cole works *with*.

---

## 2. Definition of Done — the operator experience

These are acceptance tests, not vibes. Aurelius is "there" when all of them hold.

**From the original roadmap (preserved — still the sharpest bar we have):**

- Cole says *"Plan my week around training, deep work, and calls."* Aurelius inspects
  the calendar, inspects projects, proposes a schedule, creates tasks, updates the
  deck.
- Cole asks *"What are you working on right now and why?"* Aurelius explains its
  current tasks, goals, and reasoning.
- Runs for days without crashing. Recovers from restart without losing memory,
  tasks, or goals.
- Every decision, route, model call, tool call, and error is visible in the cockpit.
  Cole can debug Aurelius from the cockpit alone.

**Added by the newer vision:**

- A **morning briefing** and **nightly debrief** reach Cole's phone on their own;
  a **weekly planning** session sets the week.
- The **Command Deck** shows Cole's lane, Aurelius's lane, and the bridge between
  them; the hero metrics **confront** ("2 days behind on launch"), never flatter
  ("Files Ingested: 1,245").
- Knowledge Cole confirms **changes what Aurelius knows** (propose → confirm), and
  a scoreboard shows Aurelius visibly leaning on the LLM **less** week over week.

---

## 3. The unified architecture

Layered, bottom to top. Each layer already has a home in the code except where noted.

**Brain (four layers — CLAUDE.md §3):**
- L1 Operator Core — stable persona/voice/hard-rules. Never auto-mutates before the
  self-upgrade phase.
- L2 Living Knowledge — DB-backed, provenance-tracked taxonomies; propose→confirm.
- L3 Compiled Understanding — patterns learned from experience; reduces LLM calls.
- L4 Research Memory — external knowledge ingested continuously and compounded.

**Reasoning plane:**
- Operator-as-lens LLM router across 6 providers (`llm/router.ts`) — the live spine.
- Multi-operator routing (1 primary + up to 2 secondary lenses).
- **Retrieval (new Layer 5.5)** — semantic recall over knowledge + patterns +
  research + notes, injected at prompt-assembly time. Load-bearing; see §6.

**Capability engines (the roadmap's engine model — mostly built as `core/engine*` +
`autonomy/`):**
- research · memory · autonomy loop (perception→planning→action→reflection) · tools
  (Google Sheets today) · task · system · **calendar (not built — required by DoD)**.

**Productivity plane (Command Deck spec — not built):**
- Project · Goal · Task · Habit · Note/Capture · DailyPlan · Ritual/RitualInstance ·
  CalendarEvent · **BridgeSignal** (the core surface) · IntentActionGap (the push).

**Surfaces:**
- **Operator lane** — Command Deck + Today (Cole's day, plan, capture).
- **Observability lane** — Cockpit (the 22 telemetry widgets) + Substrate (review and
  steer Aurelius's autonomous work). This is where "debug from the cockpit alone"
  lives.
- **Corpus** — document/knowledge browser.

**Delivery:**
- Local-first: Mac Mini (backend, reasoning, rituals, embeddings) + UGREEN NAS
  (Postgres, backups) + installable PWA + Tailscale + Neon as cloud failover.

---

## 4. Honest current state (code-grounded — supersedes older snapshots)

**Built and working:**
- 6-provider LLM router, operator-as-lens prompt assembly, multi-operator routing.
- Memory service + reflection; autonomy loop (`autonomy/loop.ts`) with the four phases.
- The roadmap's generic Engine registry/router (`core/engineTypes|engineRegistry|
  engineRouter`, `router/engineTest.ts`) — the "brain skeleton" it called unbuilt.
- Tool Engine + Google Sheets; training engine (volume, Brzycki 1RM, two-pass
  reasoning writing feedback back to sheets).
- Prisma/Postgres real. Living Knowledge **data model + store**, 38 entries seeded.
- Schema has `ReasoningCacheEntry` + `CompiledPattern` (nothing writes to them yet).
- Next.js cockpit: ~22 telemetry widgets (fetching real routes), `/corpus` browser,
  imperial black+gold theme, laurel-"A" crest.

**Partial / debt:**
- Two routing systems coexist; `core/engineRouter` is labeled "legacy." Needs
  consolidation.
- `autonomy/autonomyEngine.ts`, `repositories/operatorRepository.ts`,
  `scripts/smokePhase4.ts`, `self/selfUpgradeEngine.ts` have known TS errors.
- Reflection exists; full self-upgrade does not.

**Not built (the real remaining work):**
- Layer 7.5 knowledge injection → **the 38 seeded entries are invisible to the model
  today.**
- `compiled/` subsystem + propose→confirm directives (designed as "Phase 4.5 v1,"
  never committed — rebuild from design, not a git recovery).
- Semantic retrieval (embeddings / vector store).
- The entire productivity plane and Command Deck / Today / Substrate surfaces.
- Calendar (integration + engine + widget).
- Ritual/push engine.
- Continuous learning substrate (weekend ingestion).
- Local-first deployment.
- Testing, structured logging, ops, docs.

Blended reality: the **brain and data plane are real**; the **product (second-brain +
command deck) and the calendar/ritual/deployment/ops layers are the frontier.**

---

## 5. Conflicts resolved

Naming these explicitly so we stop carrying contradictions.

1. **Deployment — cloud vs local.** The 3.4 roadmap says Vercel/Render/Neon. The
   locked decision is **local-first**: Mac Mini + UGREEN, PWA, Tailscale, Neon only as
   failover. **Local-first wins.** The roadmap's cloud section becomes the failover
   story, not the primary.

2. **Cockpit purpose — observability vs life surface.** The roadmap treats the cockpit
   as a debug/observability panel; the Command Deck treats it as Cole's life surface.
   **Both, split cleanly:** Command Deck + Today = operator lane; Cockpit + Substrate =
   observability lane. Not either/or.

3. **Engine abstraction.** The roadmap's uniform `Engine.run()` registry exists *and*
   is already labeled legacy next to the newer operator-as-lens router. **Resolution:**
   operator-as-lens `llm/router.ts` is the reasoning spine; keep the Engine registry
   for capability engines (research/autonomy/calendar/system/task); **consolidate the
   duplicate LLM-routing paths** rather than build any new generic abstraction. The
   code outgrew the need for more scaffolding here.

4. **Task/Goal duplication.** `Task` is a stub; `AutonomyGoal` already overlaps the
   proposed `Goal`. **Resolution:** rename stub → `TaskLegacy`, real model → `Task`
   (2-line blast radius, verified); decide `AutonomyGoal` (Aurelius's objectives) vs
   `Goal` (Cole's life goals) — lean absorb into one.

5. **Phase numbering.** Three schemes existed (3.4 roadmap, CLAUDE.md, architect
   renumber). **Collapsed into the single sequence in §6.** All other docs defer to it.

---

## 6. The one reconciled sequence

Ordered by what unblocks the most, given retrieval is load-bearing and the DoD needs
calendar. Ship each in verified, independently-checkable blocks.

**Near-term**
- **0 · Layer 7.5** — inject Living Knowledge into prompt assembly. ~20 lines, no new
  infra, makes the 38 seeded entries visible. The cheap win; do it first.
- **1 · Compiled understanding + propose→confirm** — rebuild `compiled/` (similarity,
  cache, detector, `reasonWithCompilation`) and the `[KNOWLEDGE_UPDATE_*]` directives
  from the documented design. Wire the training reasoner through it.
- **2 · Retrieval** — pgvector (available on Neon *and* local Postgres today — use the
  real `vector` type, not `Bytes`), embeddings (local via Ollama, OpenAI as swap-in),
  Layer 5.5 injection.
- **3 · Productivity plane + Today view** — the new schema (Project/Goal/Task/Habit/
  Note/DailyPlan/Ritual/BridgeSignal/IntentActionGap) with the §5 corrections applied;
  quick capture; the Today screen (desktop + mobile).

**Mid-term**
- **4 · Continuous learning substrate** — weekend ingestion, per-operator research
  strategy, Monday-review UX, autonomy escalation (opt-in per operator × intent class).
- **5 · Calendar + Ritual engine + push** — Google Calendar integration + calendar
  engine (`proposeSchedule`), the morning/nightly/weekly rituals generated server-side,
  PWA web push. *This block satisfies the "plan my week" DoD.*
- **6 · Command Deck + Bridge UI** — three-dimension deck (my lane / Aurelius's lane /
  bridge), `BridgeSignal` feed with inline actions, intent-vs-action gap viz, Substrate
  review screen.
- **7 · Whole-life operators** — business, content, finance operators light up
  (foundational knowledge + research strategy + intent classes each), reusing the
  shared compilation/retrieval infra.

**Later**
- **8 · Self-directed research** — Aurelius steers its own ingestion from its own
  detected gaps and correction hotspots.
- **9 · Measurement scoreboard + knowledge freshness** — weekly snapshots proving it
  gets smarter; supersession/staleness scoring; dilution filter on high-volume
  ingestion.
- **10 · Local-first deployment** — Mac Mini + UGREEN migration, Neon failover, cutover.
- **11 · Core auto-evolution** — self-upgrade engine, human-in-loop core mutation,
  long-context "Cole's book" ingestion.

**Standing requirement (not a phase):** reliability, structured logging,
observability, testing, and docs travel with every block. The roadmap's Phase 9
discipline is a continuous bar, not a finish line.

---

## 7. Invariants (carried from CLAUDE.md — never violated without a design conversation)

- Never write training programs or coaching prescriptions. Aurelius reports signals;
  Cole makes the calls.
- Cole always wins over the substrate. Research surfaces conflicts, never overrides
  his confirmed values.
- Provenance on every knowledge entry. Cores never auto-mutate before the self-upgrade
  phase. Structural knowledge changes go through propose → confirm.
- Ship in verified, independently-checkable blocks. Compile-check between them.
- Local-first and sovereign is the target state, not cloud convenience.

---

*This doc is canonical for direction. Update it as decisions change; reconcile
CLAUDE.md to it, not the other way around.*

---

## State update — 2026-07-10 (PR #2, pre-merge)

**Landed and verified on this branch:**
- Second brain, auto-aware: four-write ingestion (vector + memory +
  registry + Bridge), Layer 5.75 awareness in every prompt, `/ask` with
  citations, Second Brain page, ⌘K routing.
- Missions execute: plan (LLM, deterministic fallback) → recall /
  research / synthesize → report auto-ingests into the corpus. Keyless
  synthesis fails honestly.
- Rituals push: morning briefing 07:00, nightly debrief 21:30 —
  deterministic facts always, LLM voice on top.
- The Wiki: one living synthesis page per domain, auto-rewritten on
  ingestion and Sundays, revisions kept, pages feed recall.
- Learning loop durable: proposals persist in Postgres; the Bridge
  opens with the review bench (confirm/deny).
- Initiative pulse (08:00): Aurelius scans gaps, stale/thin domains,
  at-risk projects → proposes missions. Never runs them.
- Research topics steer through Living Knowledge
  (research.standing_topics) — conversation → confirmation → next sweep.
- Weekly scoreboard (Sun 20:00) across both lanes; weekend sweep
  findings ingest into the corpus.
- Telegram bridge built, dormant until TELEGRAM_BOT_TOKEN.
- Prod `next build` green; PWA installable; Engines page live;
  full motion-language visual pass; wreath letterform removed in-asset.

**Blocked on Cole:** merge + `prisma migrate deploy` on Neon (4
additive migrations), funded LLM keys (voiced everything), Telegram
token, Google Calendar OAuth, finance-plane go/no-go.

**Next candidates:** calendar engine, finance plane v1, Mac Mini deploy
runbook, corrections capture UX, engineRouter consolidation, tests.

**Parked for a Cole working session (do not build speculatively):**
Business Engine buildout — Offer Engine · Lead Generation · Content
Engine · Systems/SOP · Workflow · Client Engine · Analytics · Brand
(OG doc Part XI). Build around Cole's real offers, pricing, client
list, and outreach flow once he supplies them. The research lane and
Business OS living document are live in the meantime and will have
compounded context by then.

## State update — 2026-07-10 (calendar engine, PR #4)

**Landed:** the Calendar engine (OG doc Part VIII), end to end.
- One-time OAuth connect flow for Desktop-app credentials
  (`/api/calendar/auth` → Google consent → loopback callback → refresh
  token persisted server-side, never indexed/embedded). Auto-refreshing
  access tokens; a dead refresh token disconnects loudly, never loops.
- Sync engine: primary calendar → `CalendarEvent` mirror every 15 min
  (60 days ahead, 7 back), recurring events expanded, Google-side
  deletions pruned. Everything downstream reads the DB — briefings,
  Today, deck, planning — and never blocks on Google.
- `google_calendar` registered tool: read_events · find_availability ·
  create_event (conversation-only, Cole-in-the-loop) · sync.
- Availability scanner: free blocks in the 08:00–21:00 waking window.
- Planning upgraded in place: `detect_overload` capacity now shrinks on
  calendar-busy days (90-min-per-task heuristic, floor 1); weekly
  planning skeleton carries the week's event shape. Same contracts —
  calendar absent means v1 baseline math, unchanged.
- Calendar page renders the real week (own `/api/calendar` range route),
  with the connect link surfaced until OAuth is done.
- Smoke suite grew to 18 checks (honest-fail + gap math). All green;
  `tsc` clean both sides; prod `next build` green.

**Blocked on Cole:** clicking the one authorization link.

## State update — 2026-07-11 (observability + trust loop)

**Landed:**
- **Structured tracing** (`core/trace.ts`): every scheduled run and every
  non-trivial API request leaves a LogEntry trace row (kind, name,
  duration, ok/error); boot markers give honest uptime. Fire-and-forget —
  telemetry can never break the traced path.
- **Cockpit re-wired to reality**: all 22 widget routes now query live
  Postgres — routing decisions, model latency/token spend from the LLM
  call log, mission steps, bridge events, vector-index composition,
  knowledge graph from actual operators/scopes, machine load. The four
  widgets with no honest data source were replaced (Compiled
  Understanding, Vector Index, LLM Dependence trend, Operator Attention
  from real activity share). Zero mock arrays remain.
- **Knowledge freshness** (block 9's unbuilt half): per-scope half-lives,
  deterministic staleness scoring, Sunday 19:00 sweep files
  freshness_recheck proposals for the stalest few (capped 5/week, 30-day
  cooldown, system scope exempt) + one Bridge summary. Confirming
  re-anchors; scoreboard now carries staleKnowledge.
- **Corrections capture** (the trust loop's missing input): the
  Correction table finally has a write path. "That's wrong" on any Bridge
  signal records why; knowledge-entry corrections apply immediately with
  cole_correction provenance (explicit Cole action needs no
  confirmation); corrected compiled patterns stop steering; every
  correction feeds recall as a memory. Fixed: scoreboard was counting
  compiled patterns by statuses that don't exist.
- Smoke suite: **21 checks**, all green. Both typechecks clean, prod
  build green.

**Still deliberately deferred:** engineRouter consolidation (§5.3),
core auto-evolution (block 11), multi-day soak (needs the Mini).

## State update — 2026-07-11 (Gmail + FRED — the buildable third-party tools)

Everything third-party that could be built without the Mini or the
business session, built. Registered tools: 3 → 5.

- **Gmail** (`gmail/engine.ts`, `google/oauth.ts`): read + draft ONLY.
  The OAuth grant is readonly + compose — there is NO send scope, so
  "Aurelius emailed someone without me" is impossible by construction.
  Scan inbox for what needs Cole, read a message, draft a reply into his
  Gmail drafts for his review. One-time /api/gmail/auth. New shared
  Google OAuth factory backs it; calendar's own auth left untouched.
- **FRED** (`wealth/fred.ts`): the Fed's economic data — fed funds, 10yr
  Treasury, yield curve, CPI, unemployment, mortgage rates. Free key.
  Folded into the 06:30 market pulse (gives a real digest even keyless —
  no LLM needed for the numbers) + a `fred` tool. Dormant-honest.
- Both honest-dormant until their credential; smoke suite → 33 checks.

Blocked on Cole: one Gmail OAuth click, one free FRED key. Everything
else genuinely waits for the Mac Mini or the business session.

## State update — 2026-07-11 (the learning gaps, closed)

The two gaps between "learns" and "compounds", named in the layer audit
and closed the same day:

- **Semantic answer reuse** (`compiled/semanticReuse.ts`): compiled
  understanding's read side now covers EVERY runLLM path, not just
  training. Reusable answers cache with a question-keyed embedding; a
  ≥93%-similar repeat within 14 days serves from cache — zero tokens,
  engine "compiled", usageCount bump feeding llmDependenceRate. Guards:
  never realtime/multimodal tasks, never explicit engine overrides,
  never error text, thin exchanges skipped.
- **Ambient persona observation** (`persona/observer.ts`, Sun 17:00):
  the one voice now learns from watching, not only from being told.
  Weekly deterministic signals — message length, active hours,
  correction rate — become persona.* PROPOSALS on the bench (max 2/run,
  deduped against pending + current values). Confirmed entries flow
  into Layer 1.5 through existing machinery. No LLM in the path: it
  learns keyless from day one.

Smoke suite: **31 checks green** (reuse round-trip, miss isolation,
scoreboard visibility, observer propose-once-dedupe-rerun).

## State update — 2026-07-11 (resilience research pass)

Researched the 2026 agent-reliability and memory literature, triaged
against Aurelius's real gaps, built only what closes a proven failure
mode. All keyless:

- **LLM provider failover** (`llm/router.ts`): the routed model failing
  (thrown error or keyless response) walks the other CONFIGURED providers
  in order (max 3 attempts). All-fail keeps honest failure. Which engine
  actually served + failedOverFrom lands in the call log → cockpit. The
  field calls single-provider dependence the #1 reliability hole in LLM
  apps; Aurelius had it.
- **Missed-schedule catch-up** (`core/catchUp.ts`): on boot, any job
  whose fire-time passed today with no trace row fires now (time-boxed:
  midday check expires 16:00; Sunday jobs check the day). Downtime no
  longer silently eats the morning briefing.
- **Conversation continuity** (`memory/conversation.ts`, Layer 5.25,
  migration 14): every chat turn persists; the last few flow into the
  next prompt. "Like we discussed" now survives restarts and devices —
  the "memory architecture debt" failure in the 2026 agent-memory
  reports.
- **Claude 5 generation** in the router: default strategic tier →
  Claude Sonnet 5 (near-Opus agentic quality, intro-priced below Sonnet
  4.6 until Aug 31); high-leverage + reviewer → Opus 4.8; `claude-fable`
  alias for explicit-only premium calls. Adapter verified clean of the
  params the new models reject.
- **Phone surface**: /plan (weekly session) and /cal (next two days)
  join the Telegram bridge.
- Fixed en route: a real TOCTOU race in wiki synthesis (two calls on a
  new domain both hit create — now upsert).
- Rejected with reasons: external memory frameworks (second brainstem),
  health-scored load balancing (single-user overkill), AutoDream-style
  idle consolidation (reflection + Sunday synthesis already cover it).

Smoke suite: **26 checks green.** One migration this round
(ConversationTurn) — Cole runs `npx prisma migrate deploy` after merge.

**Standing note — Google OAuth consent screen is in Testing mode:**
- The consent screen shows an "unverified app" warning — click Continue
  (it's Cole's own app).
- Testing-mode refresh tokens EXPIRE AFTER ~7 DAYS — the calendar will
  disconnect weekly until fixed.
- Permanent fix (2 minutes, no Google verification needed for personal
  use): Google Cloud console → APIs & Services → OAuth consent screen →
  **Publish app** (Testing → In production), then re-run
  `/api/calendar/auth` once. Do this the first time the weekly re-auth
  gets annoying.
