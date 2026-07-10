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
