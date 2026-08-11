I have what I need. Here is my seat's report.

---

# THE PLATFORM ARCHITECT — the substrate the decade stands on

*Read-only survey complete. The reliability fixes (SYNTHESIS Tier 0–1) are assumed landed; this is the leap that stands on them.*

## The one-sentence diagnosis

Today Aurelius is a **single Express process that wakes on a clock** (`index.ts` — ~25 `scheduleNamed` crons behind `JobRun` daily-claims, `core/catchUp.ts` for naps) and **assembles one monolithic prompt per turn** (`router.ts::buildSystemPrompt`, scanning `Memory` up to 11× a call) across **six cloud providers with no local tier** (`TIERS`: groq/openai/anthropic/xai/gemini/deepseek). The reactive nervous system the Chief-of-Staff wants already has a *seed* — `core/salience.ts::shouldPushNow` — but it fires from exactly one place: `core/bridge.ts` when a `BridgeSignal` is filed. Everything else is time-triggered. That is the gap between "a very good morning paper" and "someone in the room."

## 1. Event-driven vs cron — the reactive spine

The architectural error to avoid is treating in-day awareness as *more crons*. Cole's life is event-shaped; the spine is clock-shaped. The fix is a **single internal event bus** with the salience router as its central nervous system.

Design it as: **event sources → normalized `AureliusEvent` → salience router → {suppress · Bridge · push · trigger a reaction}**. Sources are already half-present and just need to publish instead of side-effect: the webhook handlers (`/webhooks/{stripe,twilio,instagram}`, `/intake`) that today write a row and hand-file a signal; calendar sync (15-min poll → emit `event.starting_soon`, `event.ran_over`, `event.declined`); Gmail/inbound; and eventually voice and sensors. `core/salience.ts` graduates from a push/no-push boolean into the **router**: it already scores severity × kind × urgency × quiet-hours — extend it to also *dispatch* (which reaction engine, at what latency class, or hold for batch). Cron does not disappear — a 07:00 briefing is a legitimately scheduled event — but it becomes **one publisher among many**, not the whole spine. The distinction to encode structurally: **scheduled** = "the clock said so"; **triggered** = "the world changed." Both enter the same bus, carry a `traceId` (the `withTrace` thread already exists), and are subject to the same salience gate so a reactive system doesn't become a chatty one.

This is the cheapest high-leverage move because the plumbing (`BridgeSignal`, salience scorer, push, trace) exists — it needs a bus and event *emission* at the sources, not new organs.

## 2. The always-on runtime — the Mini era

`DEPLOY_MAC_MINI.md` specs one Node process + Postgres on SSD + NAS backups + Tailscale, and notes 32GB RAM "if you want local LLMs later." *Later is the architecture.* The single process is fine for now but must split into **three supervised services** under launchd: the **API/event edge** (Express, webhooks, bus), the **reasoning workers** (LLM calls, missions, reactions — horizontally forkable, so a 40-second research mission never blocks a T-60 prep card), and the **local-model sidecar** (Ollama + whisper.cpp + a local embedding model). Postgres stays the shared substrate and the bus's durable spine (LISTEN/NOTIFY is enough at one-user scale — do not add Kafka).

The routing decision is the heart of the Mini era. Today `router.ts` escalates *everything* to a frontier cloud model or degrades on failover. The target is **hybrid local-cloud routing on a latency-and-privacy budget**:

- **Local, <300ms**: STT/TTS (the voice loop must never round-trip to cloud), embeddings (kills the per-call Gemini latency on the hot retrieval path), classification/routing/salience scoring, the `fast` tier's log/extract/track/summary work now sent to Groq.
- **Cloud frontier, 1–4s, streamed**: strategic reasoning, missions, judgment. `strategic`→Sonnet, `highLeverage`→Opus stay.
- **Privacy override**: anything touching a minor athlete's health or Cole's finances prefers local even at a quality cost.

Add a **local tier to `TIERS`** and a *reason-carrying* downgrade (the failover chain already preserves tier via `isFrontierChoice` — extend it to prefer local before degrading a mini-model). The warm cache is already architected right: the `CACHE_BREAK` static-prefix split means persona/identity/operators/tools are cached; keep that and add a **resident warm process** so the model+context are hot for the voice loop. **Latency budget: perceived response <500ms** (local ack + streamed frontier tokens), voice turnaround <1.5s. Hit it by answering locally-and-instantly for the 60% of turns that are logging/recall, and streaming the rest.

## 3. The memory substrate at full power

Today's substrate is three flat tables doing four jobs: `Memory` (category+value+JSON), one 1536-dim `VectorEmbedding` index over everything, `CompiledPattern` (semantic memory with trust counters — the best-designed piece here), `KnowledgeEntry` (provenance+history), and `ConversationTurn` (a 48h whiteboard, *never embedded* — the forgetting bug SYNTHESIS Tier-4 patches with a distiller). To *know* Cole and every athlete over a decade, three things are missing:

- **An entity graph.** `Client`, `Lead`, `Athlete`, `Metric` are relational rows, but nothing links "Jake" across a memory, a compiled pattern, a conversation, and a calendar event. Add an **Entity + Edge layer** (person/offer/injury/goal as nodes; `coaches`, `mentioned_in`, `caused` as typed edges) so "what did Jake's parent say and how's his elbow?" is one graph walk, not a cosine prayer. This is the difference between recall and *understanding*.
- **Temporal knowledge.** `KnowledgeEntry.history` preserves versions but there is no *validity interval*. "Cole's elbow" needs "true from → true until." Bitemporal edges make the entity graph answer "as of March" instead of only "now."
- **Consolidation & forgetting.** Freshness half-lives (`connectorFreshness`, the Sunday sweep) decay *knowledge*; nothing consolidates *episodic → semantic*. The nightly distiller is the first consolidation pass; the mature form is a sleep-cycle job that promotes recurring episodes into `CompiledPattern`s and lets un-referenced episodes decay. The `CompiledPattern` trust ledger (validated/ratified/correctionsSinceConfirm) is the template — extend that rigor to the whole substrate.

## 4. The capability surface

Capabilities are hard-coded in a tool catalog today (`buildToolCatalog`, native `invoke_tool`). For a decade of growth, make the surface **MCP-native**: an internal MCP registry so a new capability (a browser hand via Hammerspoon, a new data source) *registers* rather than being wired into the prompt. Critically — **the two-lock executor (`actionClasses.ts`: `checkGrantable` + `isActionGranted`) becomes the universal choke every MCP tool passes through.** A new hand can plug in and *cannot* self-escalate past a gate, because grant-checking lives at the executor, not the tool. That invariant is what makes an open capability surface safe. The gated outward tier (publish/send/spend) stays non-grantable by construction regardless of how tools arrive.

## 5. Multi-agent internally — my position

**Take the position: a coordinated society, not a monolith — but evolve the lens system, don't replace it.** Today operators are *prompt fragments* blended into one call (`formatPrimaryOperatorCore` + secondaries). That's the right primitive; it's under-powered because it's one model reasoning through blended text. The target is an **orchestrator + specialist minds** where a coaching mind, a business mind, and a presence mind are *separate reasoning contexts with their own working memory and tool subsets*, convened by an orchestrator that owns the event and delegates. The "council tribunal" is already this idea run manually — productize it as the default internal architecture. Specialists run local when cheap, escalate when hard. The orchestrator, not each mind, owns the Bridge and the trace thread, so §2.5 (act inward, gate outward) holds at exactly one place.

## The target architecture, in one breath

Event sources (calendar · webhooks · voice · cron) publish `AureliusEvent`s onto a Postgres-backed bus → the **salience router** (evolved `salience.ts`) scores and dispatches → an **orchestrator** convenes specialist minds (coaching/business/presence), each routing through a **hybrid local/cloud tier** with warm cache and streaming → all writes/actions pass the **two-lock executor** and land traced on the Bridge → a **memory substrate** of entity-graph + temporal knowledge + episodic/semantic + consolidation feeds every reasoning context → local models (STT/TTS/embeddings/fast tier) hold the latency floor on the Mini. One process becomes three services; one prompt becomes a society; one clock becomes a bus.

## Migration path (standing on the reliability substrate)

1. **Unify the spine manifest first** (SYNTHESIS Fix-5 — the four drifted job copies). You cannot build a bus on four disagreeing rosters.
2. **Introduce the bus alongside cron.** Wrap `scheduleNamed` handlers to `emit()` instead of act directly; the salience router routes both scheduled and (new) triggered events. No behavior change day one — just the seam.
3. **Emit real triggers** from sources that already exist (calendar over-run, inbound DM) — this is where the felt "second operator" appears (the T-60 prep card, SYNTHESIS Tier-4).
4. **Land the local-model sidecar** on the Mini; move embeddings + fast tier local; add the `local` tier to `TIERS`.
5. **Split the process** into edge/workers/sidecar under launchd for the soak.
6. **Grow the entity graph** incrementally beside the flat tables (write-both, read-graph), then the specialist minds last — they're the highest-risk, lowest-until-proven change.

## The one architectural investment that unlocks the most

**The internal event bus + salience router as the central nervous system.** Everything else is gated on it. Multi-surface presence, in-day reactions, voice, cascade management, the reactive prep card — none exist without a spine that carries "the world changed." The memory graph makes it *smart*, local models make it *fast*, the society makes it *deep* — but the bus is what makes it **awake**. It is also the cheapest: the salience scorer, the Bridge, push, and tracing are already built; what's missing is the bus and event emission at sources that already fire. Build the nervous system, and the organs already in this repo finally get to *react*.
