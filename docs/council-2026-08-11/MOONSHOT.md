# THE MOONSHOT — the architected ceiling

*2026-08-11, second council. The first council (SYNTHESIS.md) found the floor —
the fixes, the fuel, the deletion pass that make Aurelius solid. Cole's response:
"was it really pushing for that super Jarvis level? … think big, don't pigeonhole."
It wasn't, fully — it converged on reliability and treated the vision as a
milestone. This council answers the other half: six seats forbidden from the
fix-list, charged to architect the super-Jarvis END-STATE and the path to it,
plus a three-agent verification pass that costed the dream and reproduced the
risks. The floor is the substrate; this is the building that stands on it.*

Full seat reports in `moonshot/`; verification in `verification/`. Recommendation
only — Cole disposes.

---

## THE NORTH STAR (the Keeper's ruling, which governs everything below)

The dream is not more clients, more revenue, or even more time. Those are
instruments. **The north star is PRESENCE — Cole fully inhabiting his actual
life:** coaching that lands because he's *there* for the athlete, a faith
practiced not scheduled around, a family and a girlfriend who get the
un-distracted man, a body he still trains. Revenue buys freedom; freedom buys
presence; presence is the point. When "more capability" and "more of Cole's
life back" conflict, **the second wins.**

The anti-goal, stated so every proposal can be tested against it: *a man who
reclaimed his evenings only to spend them managing an AI.* The test —
**a capability EMPOWERS when it removes a chore and hands back only the one
judgment that is Cole's to make; it ENGULFS the moment it hands back a second
thing to manage, monitor, or maintain.** The tell is the direction of the
attention arrow: pointed *out* (the athlete, the barbell, the family) or *back
at Aurelius*. Build only what points it out.

Three values must get *heavier* as the system scales: **attention protected, not
maximized** (the most valuable thing Aurelius does on a good day is stay quiet);
**the data dignity of the minors it overhears** ("the people Aurelius overhears
are not fuel"); and **Sabbath/rest as things it defends, not optimizes away.**

---

## THE CONVERGENCE — three substrate investments unlock almost everything

The six seats were briefed independently and landed on the same small set of
foundations. That convergence is the signal. None is a "feature" — each is an
organ the features grow from.

### 1. THE EVENT BUS + salience router as the central nervous system
*(Platform Architect's keystone; the Chief of Staff and Presence both require it)*

Today Aurelius is a single Express process that **wakes on a clock** — ~23 cron
jobs — and the reactive nervous system already has a *seed* (`core/salience.ts::
shouldPushNow`) that fires from exactly one place. The leap: a single internal
event bus (Postgres LISTEN/NOTIFY is enough at one-user scale — no Kafka).
Sources publish a normalized `AureliusEvent` — calendar over-run, inbound DM,
`/intake` hit, voice, and **cron as just one publisher among many**. The
salience router graduates from a push/no-push boolean into the dispatcher:
suppress · file to Bridge · push · trigger a reaction. Scheduled = "the clock
said so"; triggered = "the world changed" — both enter the same gate so a
reactive system never becomes a chatty one. *"The memory graph makes it smart,
local models make it fast, the society makes it deep — but the bus is what makes
it awake."* Cheapest high-leverage move in the architecture: the scorer, Bridge,
push, and tracing already exist; what's missing is the bus and event emission
from sources that already fire.

### 2. THE DAY MODEL — one live, event-shaped representation of Cole's day
*(Chief of Staff's keystone; the substrate under the T-60 prep card)*

Cole's attention is a single serial thread — it holds the current block and goes
blind to the horizon the moment a session starts. A chief of staff's whole value
is holding the *whole day* so the principal only holds the *current block*.
Today the day is recomputed independently by the briefing, Today, midday, and
session-prep — each its own query, each drifting (the TZ bug the first council
patches is exactly this disease: four readers, four "todays," one wrong). Build
ONE Day Model — every event resolved (declined ones gone), each person-block
pre-joined to what the Brain holds — that every surface reads and that
**re-solves itself when reality moves.** It's the organ that makes cascade
detection, the self-replanning week, and the declare-a-sick-day-for-him behavior
possible. *"Cole holds the current block. Aurelius holds the day. That is the
second operator a first operator structurally cannot be."*

### 3. THE MEMORY THAT KNOWS HIM — entity graph + temporal knowledge + the distiller
*(Platform Architect + Super-Coach + the first council's Archivist)*

Today's substrate is flat tables; `ConversationTurn` — the only channel that
contains Cole — is a 48-hour whiteboard, never embedded. Three things turn recall
into *understanding*: an **entity graph** (person/offer/injury/goal as nodes;
`coaches`/`mentioned_in`/`caused` as edges) so "what did Jake's parent say and
how's his elbow?" is one graph walk, not a cosine prayer; **temporal knowledge**
(validity intervals — "Cole's elbow, true from → true until"); and
**consolidation** (the nightly distiller the first council already put in Tier 4,
matured into a sleep-cycle that promotes episodes to patterns and lets the rest
decay). The `CompiledPattern` trust ledger is the template — extend its rigor to
the whole substrate. This is the difference between a mind that *narrates* Cole
and one that *knows* him and every athlete over a decade.

---

## THE FOUR DOMAIN KEYSTONES (one per seat, each riding the substrate)

- **Presence → local streamed VOICE-OUT.** Everything upstream already produces
  the *words* (briefings, debriefs, salience pushes, chat replies all land as
  text); the one missing half is that Cole, driving all day, cannot *hear* them.
  TTS converts the entire existing spine from "an app he opens" to "a voice in
  his car" in one capability — and it is the strict precondition for full-duplex
  dialogue. Design rule for every surface (car, wrist, gym, home): **a surface
  never holds state** — thin windows onto the one mind on the Mini. Ambient
  capture is wake-word-gated, never always-transcribing; every capture leaves a
  Bridge receipt; **capture inward, retain gated** — presence widens the
  *channels*, never lowers the *bar*.
- **Coaching → the readiness/stall-precursor signal.** The signal that says "this
  athlete is bending toward a stall — or a strain — before it shows on the sheet"
  is the one that changes real bodies (a decaying bar-velocity trend caught in
  week two, not week six). It rides the Mini's local vision pipeline (bar path,
  velocity loss, jump/sprint kinematics as OBSERVATION, never correction) and
  lives naturally inside observations-only — a precursor is by nature a signal,
  not a prescription. The line under all five coaching organs: *Aurelius sees,
  remembers, and notices; Cole decides.*
- **Business → the owned-audience nurture engine.** The growth loop is ~80% built
  and correctly gated, but captured emails dead-end as static Lead rows — the
  business rents its audience on Instagram and lets the one audience it *owns*
  (Standard-takers) go cold. A bounded nurture sequence (Standard result → the
  gap → the requirement → the program offer), each touch inward-drafted and
  outward-Cole-confirmed, closes the flywheel: *Standard captures an owned email
  → nurture converts a fraction to the one-off program → the program produces the
  first PR → the PR auto-generates proof content → proof distributes the Standard
  to a cold audience → more emails.* The one system that makes "nothing arrives
  on its own" false.
- **Platform → the two-lock executor as the universal capability choke.** Make
  the capability surface MCP-native so new capabilities (browser/Hammerspoon
  hands, new sources) *register* rather than being hand-wired — and every one
  passes `checkGrantable` + `isActionGranted` at the executor, so an open surface
  *cannot* self-escalate past a gate. Internally, evolve the operator-lens system
  toward an orchestrator + specialist minds (coaching/business/presence), the
  council tribunal productized as the default runtime; the orchestrator owns the
  Bridge and trace so act-inward-gate-outward holds at exactly one place.

---

## THE VERIFICATION PASS — the dream, costed and stress-tested

**Latency: the voice-Jarvis blocker is SOFTWARE, not hardware.** A plain chat
turn is ~6–14 s to first visible text today (4–10× over the <1.5 s voice needs),
a tool turn 20–40 s — three causes, all in code: **nothing streams** (adapters
block on the full completion), the message is **embedded 3–4× per turn** (none
shared), and the agentic loop **rebuilds the whole prompt up to 4× per turn**.
Fix streaming + embed-once + parallel assembly and a plain turn drops to sub-1.5 s
first-token. That is a return-path rewrite, and it is the true precondition for
voice — ahead of any TTS.

**Cost: reachable.** ~$50–75/mo today; ~$150–250 fueled-and-active; ~$200–350 for
always-listening voice *before* local offload. Local STT/TTS/embeddings/fast-tier
on the Mini zero ~$70–170/mo of that, leaving ~$50–90/mo of unavoidable frontier
escalation. Payback on the ~$1,000 Mini: ~6–10 months. Caveat: a *local*
conversational tier wants 32 GB / M4 Pro; the base M4/24 GB is enough for STT +
TTS + embeddings + a small 8B local tier (exactly what the deploy doc scopes).

**Security: the constitution holds at the gates today.** With zero grants, the
lock set, and no exposed origin, **nothing is remotely exploitable.** The one
proven-serious path — an injected `system`-scope research write auto-applying and
embedding into the vector index — was **reproduced with a live PoC**, and it
fires *the instant `knowledge.apply_proposal` is granted.* That is the exact grant
Fuel Week's convenience list proposed flipping. **Verdict, load-bearing: do not
flip that grant until the ~three-line scope guard lands** (first council G1/G2).
The reading over-called one thing (hostile email "auto-executes a directive" — the
loop parses model output, not tool results, so the vector is persuasion of
reversible inward writes, never outward send).

**Coverage — the honest answer to "was it deep enough?": deep on INTENT, shallow
on FAILURE.** Four regions remain genuinely un-rigorously examined: (1)
**concurrency & crash-recovery of the write paths** — only 2 backend files use
transactions; `ingestDocument` is a 5-write non-atomic path where a mid-crash
with a dedupKey leaves a 0-chunk document that retry *actively skips* — a
self-defeating orphan, proof the region is unexplored; (2) **the test suite's own
trustworthiness** — ~25 checks are source-regex ("the guard string exists"), and
the suite structurally misses wiring gaps, so "555 green" coexists with the known
G1/plate/TZ/G3 holes; (3) **runtime under real use** — everything is static-read +
synthetic smoke; nothing has run for real, no load or true-concurrency test; (4)
**dependency/CVE, the fragile postinstall copy, the in-memory rate limiter under a
real attacker, and minors' PII lifecycle.** A third pass would need a
crash-recovery/transaction audit, a meta-audit converting regex checks to
behavioral + adding catch-up-parity and constitution red-team tests to the audit
gate, a dependency/CVE pass, and one honest soak against a funded key.

---

## THE PATH — how the ceiling gets built on the floor

The first council's order stands as the foundation: **Gate (Tier 0 safety) →
Fix (Tier 1) → Delete (Tier 2) → Fuel (Tier 3).** The moonshot sequences on top:

1. **Spine manifest unification** (first-council Fix-5) — you cannot build a bus
   on four disagreeing job rosters. This is the seam the whole architecture needs.
2. **The event bus alongside cron** — wrap `scheduleNamed` handlers to `emit()`;
   the salience router routes both scheduled and (new) triggered events. No
   behavior change day one — just the seam.
3. **The Day Model** — after the TZ fix + delivery-verification; the organ under
   in-day awareness. Emit real triggers (calendar over-run, inbound DM) → the
   felt second-operator moment (the T-60 prep card).
4. **The return-path rewrite** (streaming + embed-once + parallel assembly) — the
   latency precondition for voice, valuable for chat regardless.
5. **Local-model sidecar on the Mini** — STT/TTS/embeddings/fast-tier local; add
   a `local` tier to the router. Then **voice-out** (gated behind ~10 real
   voice-notes proving the channel is used).
6. **The memory graph** — grown write-both/read-graph beside the flat tables;
   the distiller first, entity+temporal layer next.
7. **The domain keystones** — the readiness-precursor signal, the nurture engine —
   each when its substrate and the relevant fuel are in.
8. **Specialist minds last** — highest-risk, lowest-until-proven; the orchestrator
   pattern only after the bus and memory substrate are real.

Every step passes the Keeper's test — does it point Cole's attention *out* at his
life, or *back* at the machine? — and the constitution gets *heavier* as the
autonomy grows, never lighter. The dreams didn't shrink under the evidence. They
found their footings, got costed, and got ordered. **Build the nervous system,
and the organs already in this repo finally get to react.**
