I have completed a deep read of the stack. Here is the audit.

---

# THE ARCHIVIST — Memory Stack Audit

## 1. The Memory Map

**Memory** (`memory/memoryService.ts`). Writers: chat `[SAVE:]` directives, `corrections.ts:113` (every correction becomes a memory), `corpus/ingest.ts:99` ("Ingested: …"), research engine, tool engine, Sheets auto-registration, reflection engine. Readers: Layer 5 (`loadMemoriesForOperator`), vector recall, `wiki/engine.ts:32` (categories `facts|research` only), `findClientSheetId`. Honest ratio: decent — but **append-only, never consolidated, never contradicted, never pruned**. `memoryService.ts:8-13` imports `getMemoriesByCategory`, `searchMemories`, `getMemoryTimeline` and uses only `repoSaveMemory` — the timeline and category readers are dead imports; the timeline is a write-only shelf. `memory/memoryEvolutionEngine.ts` (compress→synthesize) is a vestigial engine adapter with no scheduled caller — consolidation exists in name only. Categories `tool_result` and `events` are written and read by nothing specific.

**VectorEmbedding** (`retrieval/vectorStore.ts`). The workhorse: written by every `embedSourceSafe` call (memories, knowledge, wiki, corpus, reasoning cache, pattern when-clauses via `patternIndex.ts`); read by `semanticRecall`, `/ask`, `semanticReuse`, `retrieveFitPatterns`. Best read/write ratio in the system. Model-string partitioning (`retrieve.ts:85`) is correct but means a provider switch orphans the entire index until `backfillEmbeddings.ts --force`.

**KnowledgeEntry** (`knowledge/store.ts`). Written via propose→confirm, corrections, business-profile reconcile; read into Layer 1.5 (`persona.*` in `operatorScore.ts:117`), wiki gathering, the index. Closed. But `history[]` (`store.ts:230-249`) is a write-only shelf — versioned provenance nothing ever reads programmatically.

**CompiledPattern**: written by `detector.ts` (training reasoner + `chatCompiler.ts`), `distill.ts` (curriculum), decayed/ratified by `outcomeLoop.ts`; read every turn by Layer 5.4 (`reasoningHelper.ts:207`). Genuinely closed.

**ReasoningCacheEntry**: written by training `writeCache` and `semanticReuse.recordAnswer`; read by `tryReuseAnswer` (0.93 similarity, 14-day TTL) and training lookups. Closed, narrow.

**WikiPage**: written Sundays + debounced ingestion; read three ways — Layer 5.45 direct injection, embeddings, and as the coverage signal for gap discovery (`curriculum.ts:493`). **WikiRevision** is a write-only shelf (kept forever, read only for a 5-row display list).

**ConversationTurn**: written by `recordTurns`; read by `recentConversationBlock` (**6 turns, 48 hours** — `conversation.ts:45`) and the persona observer. **Never embedded.** This is the largest write-mostly shelf in the system, and it is the channel that contains Cole.

## 2. The Recall Chain — "what did Jake's parent say about scheduling?"

The question routes to a primary operator, then `buildSystemPrompt` (`router.ts:309`) assembles: Layer 5 keyword memory → 5.25 conversation → 5.4 patterns → 5.5 semantic recall.

**Layer 5** (`memoryService.ts:288-324`): keywords `jake`, `parent`, `scheduling` substring-match `Memory.value`. This surfaces the remark **only if a `[SAVE:]` directive fired when it was said**. If the parent's comment arrived in chat and the model didn't emit a save directive, it lives solely in ConversationTurn — recallable for 48 hours and 6 turns, then *unreachable by any path in the codebase*. There is no conversation embedder, no nightly distillation of turns into memories.

**Layer 5.5** (`retrieve.ts:61`): embeds the query, searches the index. ConversationTurn is not an `EmbeddingSourceType` (`vectorStore` sources: knowledge, memory, reasoning_cache, note, task, corpus_doc, wiki_page). Degradations, in order of severity:

- **Mock-mode blindness**: `EMBEDDINGS_PROVIDER=mock` (the documented sandbox default, CLAUDE.md) returns hash vectors — "similar texts do NOT map to similar vectors" (`embeddingAdapter.ts:115-118`). Above `MIN_SIMILARITY=0.25`, hits are *random but confident*. Mock is worse than keyless: keyless warns loudly once (`embeddingAdapter.ts:162-174`, written after exactly this failure); mock passes smoke and silently serves noise. `measureEmbeddingFit.ts:44` refuses mock honestly — but only when someone runs it.
- **Operator scoping**: `searchSimilar` filters `operatorId = X OR NULL` (`vectorStore.ts:113`). A memory saved under `training` will not surface when chat routes primary `strategy` — Jake's parent is invisible to half the lenses unless `relatedOperators` was set at save time.
- **Recency bias**: mild in the reranker (weight 0.12, 45-day half-life — `retrieve.ts:40-41`), but Layer 5's tier-2/3 are `createdAt desc` — a six-month-old parent comment loses its slots to recent "Jake" mentions.

Verdict: today, this question is answered only if the remark was explicitly saved, with real embeddings, under a matching operator. Three conjunctive conditions, each silently failable.

## 3. The Learning Loops

- **Compiled patterns / outcome loop** — **closed, and the best-engineered loop here**: fire (`recordPatternsFired`), decay on correction (−0.12), trust rises *only* on explicit ratification (+0.02, capped 0.9 — `outcomeLoop.ts:24-28`), confirmed rules clamp at the floor with a gated retire proposal, the Sunday judge (`decisionCurriculum.ts:78`) tries misfiring rules. Weakness: every signal enters through conservative regexes in `mirror.ts:52-73` ("rule 2 is wrong", "good call" ≤60 chars). Cole must speak the mailbox's dialect; most weeks will produce zero error signal, and a zero-signal week leaves the lens exactly as sharp as before.
- **Corrections → heuristics** — closed via propose→confirm, cursor-advancing, honest on keyless. But its input is the Correction table, which fills only through the mirror/mailbox or an HTTP endpoint — the loop is closed and *starved*.
- **Persona observer** — closed (proposal → Cole confirms → `persona.*` → Layer 1.5) but three deterministic signals, max 2 proposals/week. Real, narrow bandwidth.
- **Curriculum ingest** — the write half is fully closed (research → four-write ingest → wiki → distilled heuristic proposal); the *steering* half closes only on Cole's Bridge tap. Unattended, it makes Aurelius sharper about **the canon**, not about Cole — 14 units/week of book synthesis enters the same retrieval window as Cole's life, with `corpus_doc` even carrying a +0.02 source prior.
- **Wiki/field synthesis** — closed: the page is injected every turn (`router.ts:489-509`). But `slice(0, 1400)` injects only "State of play" plus a paragraph; the rest depends on chunk recall (mock-vulnerable).

The honest asymmetry: **the loops that run without Cole make it sharper about books; the loops that make it sharper about Cole all bottleneck on Cole's explicit taps and phrasings.** Week two is measurably sharper only if week one contained ≥10 turns, ≥3 same-topic exchanges, corrections in the right dialect, and Bridge confirms.

## 4. The Second-Operator Gap (ranked)

1. **Episodic durability of conversation.** The richest channel of Cole is discarded after 48h/6 turns. Foundation: ConversationTurn persists everything; `chunkText` + `embedSourceSafe` exist; only a distill-and-embed job is missing.
2. **Entity pages.** "A mind that knows his athletes" has no per-person surface — memories key on *operator*, patterns on `entityKey` (used only in training), CRM rows hold billing, not understanding. Jake's parent has no home. Foundation: `wiki/livingDocs.ts` pattern, Client table, `entityKey` column.
3. **Forgetting/consolidation.** Append-only Memory with no supersede/dedup/contradiction resolution; stale facts co-surface with corrections forever. Foundation: `memoryEvolution/` stubs, `KnowledgeEntry.history` semantics to copy.
4. **Preference learning with teeth** beyond three persona signals — nothing mines what Cole ignores, re-asks, or reformats.
5. **Cross-operator recall** — operator-scoped vectors hide one lens's memories from another.

## 5. Three Highest-Leverage Investments

1. **A nightly conversation distiller** — read yesterday's ConversationTurns, extract durable facts/events/people into Memory (deduped against existing), embed them. Kills gap #1 with ~100 lines riding existing plumbing, and stops depending on the model remembering to emit `[SAVE:]` in the moment. This is the single change that most converts "Cole talked to it" into "it knows Cole."
2. **Entity pages** — per-person synthesized pages (athletes, leads, family) on the wiki engine, injected when a name appears (as field synthesis already is per domain). The second-operator promise is person-shaped; the stack is currently domain-shaped.
3. **Make retrieval health first-class** — doctor reports `mock` as `config`, never `live` (hard rule 8's spirit: mock recall is a capability nothing real can invoke); run `measureEmbeddingFit` inside the weekly scoreboard; widen the mailbox dialect so the outcome loop's error signal actually flows. The best-built loop in the repo is fed through a straw.

**Bottom line**: the architecture is honest and the compiled-pattern spine is genuinely closed — but as deployed, the mind's deepest shelf (conversation) is a 48-hour whiteboard, its recall can go confidently blind under mock embeddings, and its unattended learning compounds canon faster than it compounds Cole.
