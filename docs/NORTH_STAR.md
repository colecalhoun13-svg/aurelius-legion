# AURELIUS — NORTH STAR

The single source of truth for *where we're going and why*. It fuses every input
we've ever written into one direction:

1. The original **Aurelius 3.4 operator-OS roadmap** — both halves: the phased
   engineering plan (engine/router architecture, autonomy loops, calendar, cloud,
   self-reflection, ops) **and** the 20-part v3.4 architecture bible (8 engines,
   memory categories, operators, tools, living documents, knowledge modules,
   business/wealth/training engines, notifications, dashboard).
2. **CLAUDE.md** — the four-layer brain, Living Knowledge, recursive compilation,
   continuous learning, and the hard rules / one-voice discipline.
3. The **Command Deck spec** — two-lane + bridge product, productivity plane,
   local-first deployment.
4. **Cole's operating decision** (2026-07-13) — Hybrid Autonomy: *Aurelius acts,
   then comes to Cole for anything outward and for "are we on track" checkpoints.*
   See §2.5.
5. The **actual code on the branch** (audited), which supersedes every stale
   "current state" snapshot in the docs above.

CLAUDE.md remains the working-rules / hard-rules / voice doc. This is the map.
Where they disagree on phase numbers or state, **this doc wins** and CLAUDE.md gets
reconciled to it.

---

## 1. Vision

Aurelius is one system that is three things at once, in one voice:

- **A Jarvis-level operator OS** — takes natural-language missions, plans, routes,
  and **executes** across engines, tools, memory, and a real calendar; surfaces its
  thinking and state through a cockpit. Operator-class and sovereign: it doesn't just
  answer, it *operates*.
- **A second brain** — persistent, structured, recall-able understanding of Cole,
  his work, and his world; capture in, the right thing back out at the right moment.
- **A compounding intelligence** — reasons from accumulated, provenance-tracked
  understanding rather than from scratch, and leans on the base LLM *less* over time
  as its own knowledge and reasoning compile.

Coaching-origin, whole-life scope, local-first and sovereign. Not a chatbot, not an
LLM wrapper. **An operator Cole works *with* — that does the work and hands back the
decisions that are Cole's to make.**

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

**Added by the acting decision (the frontier — see §2.5):**

- Aurelius **finalizes** inward work on its own inside a granted keyhole — the "plan
  my week" test above completes with *created* time-blocks, not just a proposal —
  and the change is traced and reversible.
- Aurelius **stops at every outward gate.** Nothing publishes, sends, or spends
  without Cole's confirm. This is enforced by construction, not by prompt.
- Aurelius **checks in on track.** It surfaces "here's what I did / here's where we
  stand" on Cole's rhythm (morning tactical, midday corrective, evening reflective).

---

## 2.5 The Autonomy Model (Cole's decision, 2026-07-13)

The one decision that unlocks "operator" from "advisor." Stated in Cole's words:
*"It's supposed to act, but come to me for publishing and to make sure we're on the
right track. I give it ideas, and let it work."*

This is the OG doc's own **System Philosophy #1 — Hybrid Autonomy: Aurelius proposes
→ Cole negotiates → Aurelius finalizes** — finally built, not just aspired to.

**The shape:**

- **Inward actions** (schedule the week, organize, draft, ingest research, generate
  tasks) — Aurelius *does* them inside a granted intent-class. Every action is a
  LogEntry trace row and lands on the Bridge as an **executed proposal** Cole can
  veto after the fact. Reversible by construction.
- **Outward actions** (publish, send an email, post content, move money) — Aurelius
  prepares them to the edge (a draft, a queued post) and **stops for Cole's confirm.**
  Non-grantable at the outward tier; the publish gate never opens on its own.
- **Checkpoints** — Aurelius surfaces what it did and where things stand on Cole's
  cadence, so "are we on track" is answered without Cole chasing it.

**The throttle — the Autonomy Grant system** (roadmap Block 4, "opt-in per operator
× intent class"). Cole grants autonomy one operator × intent-class at a time; each
grant is a raw-Prisma record (never embedded), issued by explicit Cole action, and
**revocable with one word** — a dead grant goes dormant honestly, never loops.

**The lines that never bend (from the ethos, tested against it 2026-07-13):**

- **Cole always wins.** A grant is Cole delegating; Aurelius never overrides a
  confirmed value.
- **Autonomy never escalates its own autonomy.** `scope autonomy` is non-grantable —
  the switch is always in Cole's hand, never Aurelius's. This is the one that can
  never bend.
- **Signals only in training/health.** Aurelius never writes programming or
  prescriptions; those intent-classes are non-grantable by construction.
- **No core auto-mutation.** A grant widens *what* Aurelius does, never *who decides
  what it may do*, and never touches L1 or the grant table itself.
- **Every acted step is traced.** No untraced action path exists.

---

## 3. The unified architecture

Layered, bottom to top. Fuses the four-layer brain (CLAUDE.md) with the OG bible's
engine/memory/operator/tools/living-document model. Each layer already has a home in
the code except where marked.

**Brain (four layers — CLAUDE.md §3):**
- L1 Operator Core — stable persona/voice/hard-rules. **One voice, no modes** (see
  §5.6). Never auto-mutates before the self-upgrade phase.
- L2 Living Knowledge — DB-backed, provenance-tracked taxonomies; propose→confirm.
- L3 Compiled Understanding — patterns learned from experience; reduces LLM calls.
  **Now wired into the main reasoning brain (Layer 5.4), not just training.**
- L4 Research Memory — external knowledge ingested continuously and compounded.

**Reasoning plane (OG "Intelligence Layer — 8 engines"):**
- Operator-as-lens LLM router across 6 providers (`llm/router.ts`) — the live spine.
  Maps the OG's 5 external engines (GPT / Groq / Grok / Gemini / DeepSeek) + Claude
  onto task-type routing; the 3 internal engines (memory / workflow / research) are
  live subsystems.
- Multi-operator routing (1 primary + up to 2 secondary lenses).
- **Retrieval (Layer 5.5)** — semantic recall over knowledge + patterns + research +
  notes, injected at prompt-assembly time. Load-bearing.

**Memory Layer (OG Part VI categories):** long-term · session · goals · tasks ·
calendar · preferences · training · business · wealth · identity traits · knowledge
modules · living documents. Rule: **operators read, tools write, no global mutation.**

**Operators (OG Part IV):** WeeklyPlanning · DailyPlanning · Scheduling · Goal · Task
· Business · Content · Training · Reflection · Accountability · Research · Identity ·
System · Athlete. Each is a lens, not a personality.

**Capability engines (OG Parts VIII–XV — mostly built as `core/engine*` +
`autonomy/`):** research · memory · autonomy loop (perception→planning→action→
reflection) · tools · task · system · **calendar (built)** · training · wealth/FRED ·
**business (parked — needs Cole's real data)**.

**Tools / Actions (OG Part VII):** planWeek · planDay · scheduleTasks ·
breakGoalIntoSteps · generateTasks · overloadDetector · calendar read/write ·
research aggregator · wealth analysis · training block builder · (business + content
tools gated behind Block 7). Pure functions; the write side of memory.

**Living Documents (OG Part XIV):** Philosophy · Training Science · Business OS ·
Identity · Wealth — one self-rewriting wiki page per domain, revisions kept, feed
recall. **Built.**

**Productivity plane (Command Deck spec):** Project · Goal · Task · Habit ·
Note/Capture · DailyPlan · Ritual/RitualInstance · CalendarEvent · **BridgeSignal**
(the core surface) · IntentActionGap (the push). **Built.**

**Surfaces:**
- **Operator lane** — Command Deck + Today (Cole's day, plan, capture).
- **Observability lane** — Cockpit (22 telemetry widgets) + Substrate (review and
  steer Aurelius's autonomous work). "Debug from the cockpit alone" lives here.
- **Corpus** — document/knowledge browser.

**Notifications (OG Part XIX):** morning briefing (tactical) · midday check
(corrective, silent when on pace) · nightly debrief (reflective) · overload/
accountability nudges. Time-, event-, score-, and pattern-triggered. **Built (push
via Telegram; PWA web push at deploy).**

**Delivery:**
- Local-first: Mac Mini (backend, reasoning, rituals, embeddings) + UGREEN NAS
  (Postgres, backups) + installable PWA + Tailscale + Neon as cloud failover.

---

## 4. Honest current state (code-grounded — supersedes older snapshots)

**Built and working (through 2026-07-13):**
- 6-provider LLM router with failover, operator-as-lens prompt assembly, multi-
  operator routing, Claude 5 tier map.
- Four-layer brain live: Living Knowledge + propose→confirm, Compiled Understanding
  (now wired into the **main** brain, Layer 5.4), semantic retrieval (Layer 5.5),
  research memory. Semantic answer reuse system-wide. Ambient persona observation.
- Memory service + reflection; autonomy loop with the four phases; **initiative
  pulse proposes missions (never runs them — the acting layer is what changes that).**
- Tool Engine + Google Sheets, **Google Calendar (live, syncing), Gmail (read+draft,
  no send scope), FRED macro data.** Training engine (volume, 1RM, two-pass feedback).
- Missions execute (plan → research → synthesize → report → auto-ingest). Self-writing
  wiki / Living Documents. Weekly scoreboard, knowledge freshness, corrections capture.
- Structured tracing on every scheduled run + request; 22 live cockpit widgets on real
  Postgres. Provider failover, missed-schedule catch-up, conversation continuity.
- Prisma/Postgres real; pgvector. Next.js cockpit; imperial black+gold; PWA installable.
- Reliability primitives: catch-up sweep, continuity, honest-failure guards.

**Partial / debt:**
- Two routing systems coexist; `core/engineRouter` labeled legacy — consolidate.
- `self/selfUpgradeEngine.ts`, some legacy repos have known TS errors (dead paths).
- Reflection exists; full self-upgrade (OG Part IX / block 11) does not.

**The frontier (the real remaining work):**
- **The acting layer — Autonomy Grant system (Block 4's unbuilt half).** The keystone
  of §2.5. Nothing today *finalizes*; everything defaults to propose.
- **Outward engines / Business Engine (OG Part XI, Block 7)** — needs Cole's real
  offers, pricing, clients. The income flywheel.
- **Always-on deployment** — Mac Mini + UGREEN. The one untested DoD claim ("runs for
  days") stays unproven until this lands.
- Google OAuth still in Testing mode (weekly token expiry) until the consent screen is
  published.

Blended reality: the **brain, data plane, second-brain product, calendar, rituals, and
observability are real and live.** The **acting layer, the outward/income engines, and
always-on deployment are the frontier.**

---

## 5. Conflicts resolved

Naming these explicitly so we stop carrying contradictions.

1. **Deployment — cloud vs local.** Local-first wins: Mac Mini + UGREEN, PWA,
   Tailscale, Neon only as failover. The roadmap's cloud section becomes the failover
   story.

2. **Cockpit — observability vs life surface.** Both, split cleanly: Command Deck +
   Today = operator lane; Cockpit + Substrate = observability lane.

3. **Engine abstraction.** Operator-as-lens `llm/router.ts` is the reasoning spine;
   keep the Engine registry for capability engines; **consolidate** the duplicate
   LLM-routing paths rather than build new scaffolding.

4. **Task/Goal duplication.** Stub `Task` → `TaskLegacy`, real model → `Task`;
   `AutonomyGoal` (Aurelius's objectives) vs `Goal` (Cole's life goals) — lean absorb.

5. **Phase numbering.** Collapsed into the single sequence in §6.

6. **Personality modes vs one voice.** The OG bible (Part II) specced five personality
   modes with `"Aurelius: Commander"` overrides. **CLAUDE.md's "one voice, no modes"
   wins, and Cole confirmed it ("excluding the voices").** The *behaviors* the modes
   wanted — harder when Cole drifts, quieter when he's on pace, reflective at night —
   are **kept**, but driven by the Operator Score and learned `persona.*` calibration
   (Layer 1.5), never a costume the assistant announces. One voice that modulates,
   never switches.

7. **Propose-vs-act (resolved by §2.5).** The ethos never forbade action — "signals
   only" is training/health-scoped, "propose→confirm" governs knowledge/core writes,
   and "autonomy never escalates its own autonomy" means the *switch* is Cole's, not
   that autonomy is forbidden. Hybrid Autonomy (act inward, gate outward) is the
   designed model, not a departure from it.

---

## 6. The one reconciled sequence

Ordered by what unblocks the most. Ship each in verified, independently-checkable
blocks. **Blocks 0–3 and much of 4–6 are DONE** (see the state-update log below);
what remains is marked.

**Done (foundation + product):**
- **0 · Layer 7.5** Living Knowledge injection · **1 · Compiled understanding +
  propose→confirm** · **2 · Retrieval (pgvector + embeddings + Layer 5.5)** ·
  **3 · Productivity plane + Today** · **Calendar + rituals + push (satisfies "plan
  my week")** · **Command Deck + Bridge** · observability + trust loop · Gmail + FRED ·
  learning-loop closure (semantic reuse + persona) · resilience (failover/catch-up/
  continuity) · **compiled patterns wired into the main brain.**

**Active frontier:**
- **4 · The acting layer — Autonomy Grant system.** Build the grant record (operator ×
  intent-class, Cole-only writer, training/health + `autonomy` non-grantable by
  construction), the action-with-review executor (inward acts run + land on the Bridge
  reversibly; outward acts stop at the publish gate), and the checkpoint surfacing.
  **First grant to go live: `calendar × schedule-protection`** — safest (calendar edits,
  not email/money), fully reversible, substrate already built, fires daily so it earns
  trust fast. This is the advising→operating crossing.
- **Memory lit + always-on** (Cole-side + deploy): `EMBEDDINGS_PROVIDER=gemini` +
  re-embed; publish OAuth consent; **10 · Mac Mini + UGREEN** migration + multi-day
  soak. Proves "runs for days."

**Then (outward / income):**
- **7 · Whole-life operators + Business Engine (OG Part XI).** Light ONE outward engine
  first (Content or Lead/Offer) on Cole's real offers/pricing/clients — mission drafts
  outreach/content into a Gmail-draft/Bridge review queue, Cole confirms, results
  ingest and compound. The research lane + Business OS living doc are accreting context
  in the meantime.

**Later:**
- **8 · Self-directed research** · **9 · Measurement + freshness** (largely built) ·
  **11 · Core auto-evolution** (self-upgrade, human-in-loop core mutation).

**Standing requirement (not a phase):** reliability, structured logging, observability,
testing, and docs travel with every block.

---

## 7. Invariants (carried from CLAUDE.md — never violated without a design conversation)

- **Aurelius acts, but never past a gate it wasn't granted.** Inward actions run inside
  a Cole-granted intent-class and stay reversible + traced; outward actions (publish/
  send/spend) always stop for Cole's confirm. (New — the acting invariant.)
- **Autonomy never escalates its own autonomy.** `scope autonomy` is non-grantable.
- Never write training programs or coaching prescriptions. Aurelius reports signals;
  Cole makes the calls. (Training/health intent-classes are non-grantable.)
- Cole always wins over the substrate. Research surfaces conflicts, never overrides his
  confirmed values.
- Provenance on every knowledge entry. Cores never auto-mutate before the self-upgrade
  phase. Structural knowledge changes go through propose → confirm.
- One voice. No personality modes. The register modulates from state + learned
  calibration, never a announced switch.
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

## State update — 2026-07-13 (OG roadmap fused · chat fixes · loop closed · acting decision)

The full OG 3.4 roadmap (both the phased engineering plan and the 20-part
architecture bible) is now folded into §1–§7 above, reconciled against the
built code and against Cole's acting decision. Highlights this session:

- **Chat fixed, live-deploy hardening.** The chat box was POSTing to a
  hardcoded stale Codespaces URL and rendering empty bubbles when the model
  answered with only a directive. Added a same-origin `/api/aurelius` proxy
  (loopback, never goes stale), a never-empty reply fallback that
  acknowledges silent saves/tools, and surfaced real error text.
- **Provider-safe embeddings.** `searchSimilar` now filters by
  `embeddingModel` (matched to the write convention `${name}:${model}`), so
  switching `EMBEDDINGS_PROVIDER` (OpenAI → Gemini) can never cosine-compare
  incompatible geometries. Makes the Gemini switch safe with zero migration.
- **Learning loop closed into the main brain (Layer 5.4).** Confirmed
  compiled patterns (`loadOperatorPatternsForPrompt`) now ground everyday
  chat, not just the training reasoner — Aurelius reasons FROM what it has
  learned about Cole. `tsc` clean both sides; smoke suite **33/33 green**.
- **The acting decision (§2.5).** Hybrid Autonomy locked: Aurelius acts on
  inward work inside Cole-granted intent-classes, stops at every outward
  (publish/send/spend) gate, and checks in on track. Tested against the full
  ethos — the constitution *plans* this (Block 4), it doesn't forbid it.
- **Conflict resolved in writing:** OG personality modes (Part II) →
  one voice that modulates from Operator Score + learned calibration.

**Next block (active frontier):** the Autonomy Grant system (§6 Block 4) —
grant record + action-with-review executor + first live grant
`calendar × schedule-protection`. **Blocked on Cole:** the Plan A switches
(`EMBEDDINGS_PROVIDER=gemini` + re-embed, publish OAuth consent) and the
Mac Mini deploy to prove always-on.
