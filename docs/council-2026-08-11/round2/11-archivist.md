Verification complete. Every load-bearing claim checks out. Here is my round-2 ruling.

---

# THE ARCHIVIST — Round 2

I verified the five contested lines before writing. The mind sweep is right on the facts, and where it reads as rebuttal it is actually resolution. Here is the reconciliation, precisely.

## 1. Keyless warns; mock lies. They are different branches, and only one ships.

`getEmbeddingAdapter()` has two distinct failure geometries. The **keyless path** — `EMBEDDINGS_PROVIDER=gemini|openai` with no key — routes through `warnKeyless` (`embeddingAdapter.ts:162–174`), logs once and loudly, returns `null`, and every caller skips. The result is **honest emptiness**: no recall, no reuse, no pattern retrieval — Aurelius looks forgetful but never *confidently wrong*. The mind sweep's A- and its "fails loudly now" are correct about this branch. My round-1 "confident blindness" was never aimed here.

The **mock path** — `EMBEDDINGS_PROVIDER=mock` — returns `mockEmbeddingAdapter` with **no warning at all** (`:120`, and the resolution at `:186` has no log). It emits deterministic hash vectors where similar texts do *not* map to similar vectors, yet they still clear `MIN_SIMILARITY=0.25`. That is confident noise: recall returns rows, reuse serves answers, and nothing on the surface says the geometry is meaningless. `measureEmbeddingFit.ts` refuses mock honestly — but only when someone runs it.

So: **which bites Cole, and when?** Mock bites, and it bites in exactly the window that matters most. CLAUDE.md documents `EMBEDDINGS_PROVIDER=mock` as *the sandbox default*. Every demo, every first-run, every "let me try it before I fund a key" session runs on mock. That is the moment Cole forms his verdict on whether this thing knows him — and it is the one moment the recall layer is structurally incapable of telling him it's guessing. Keyless is the safer failure. **Mock is the one that lies during the audition.** The fix is one line of doctrine: the doctor must report `mock` as `config`, never `live` — mock recall is a capability nothing real can invoke, which is hard rule 8's exact spirit.

## The three trust-integrity leaks are memory defects. Ruling on each.

The sweep found three wires where the mind *un-learns*. I rule they are not merely trust bugs — each is a direct assault on "a mind that knows Cole," because each lets the system re-assert something Cole already killed.

- **`detector.ts:160` — `Math.max` erases decay.** Confirmed, with a nuance the sweep is right about: the `discardedTwin` guard (`:168`) protects only *fully discarded* patterns. A `confirmed_heuristic` that Cole corrected — decayed 0.5→0.38 by `outcomeLoop` but still `confirmed` status — is restored to ≥0.6 the next time three similar turns re-fire detection. **Repetition overwrites correction.** This is the deepest defect of the three: the outcome loop is the best-built learning surface in the repo, and this line silently reverses its punishment signal. A mind that forgets it was corrected is worse than one that never learned.

- **`semanticReuse.tryReuseAnswer` — corrected answers keep serving.** Confirmed: the function filters domain, operator, freshness, engine-availability — but never `correctedAt: null` (`:53–69`). `corrections.ts:96` stamps the correction; only the scoreboard reads the stamp. So a wrong answer Cole explicitly fixed is re-served verbatim at ≥0.93 similarity for up to 14 days. This is the most *visible* leak — Cole watches his own correction bounce back at him.

- **`gatherDomainMaterial` — memories pulled unscoped by domain.** Confirmed and worse than I'd have guessed: `docs` are `where:{domain}`, but `memories` are the 25 most-recent in `facts|research` **globally**, and `knowledge` is the 25 most-recent active entries globally. (Credit where due: the `scope:"system"` exclusion is already fixed here.) Every one of the five living documents synthesizes from the same undifferentiated memory pool, so a business fact steers `training_science` and one poisoned ingest-memory reaches all five pages. This is cross-contamination of the wiki, which is injected *every turn* at Layer 5.45 — the bleed is not quarantined, it's in the hot path.

All three share one signature: **the mind's forgetting is not governed.** It forgets what Cole said (conversation, 48h) and refuses to forget what Cole rejected (decayed patterns, corrected answers, retired facts). Both directions are the same missing organ — consolidation with supersede semantics.

## 2. My three investments, defended against two strong objections.

The **Contrarian** ("starved, not stupid — don't build") and the **Cartographer** ("compilation never closes the loop — `llmCallsAvoided` hardcoded 0, `canShortCircuit` zero production callers") are both correct, and I verified both. I revise accordingly:

- **Entity pages — WITHDRAWN for now.** The Contrarian wins this cleanly. Person-shaped pages are a *feature*, and building a synthesis surface for athletes when zero clients and zero real athlete sheets exist is a second unopened door. It's right *after* one real season of the Sheets loop. Parked.

- **Retrieval health as a doctor check — PROMOTED to prerequisite, not investment.** This is not a build; it's four lines making mock report `config`. It gates everything else honestly. It survives "stop building" because it *is* the honest-failure rule applied to memory.

- **Nightly conversation distiller — DEFENDED, reclassified as a fix.** This is the one that survives "stop building," and here is the argument. The Contrarian's thesis is "when you touch it, it already knows, already did, and was right." Every ingredient for *knows* exists except one: ConversationTurn — the only channel that actually contains Cole — is a 48-hour, 6-turn whiteboard (`conversation.ts:45`) that is **never embedded** (verified: no `conversation_turn` in `EmbeddingSourceType`). Today, "it already knows what you told it Tuesday" depends on the model having emitted a `[SAVE:]` in the moment. The distiller doesn't add a capability; it stops the system from **discarding the data it already captured**. That is a fix — the plumbing (`chunkText`, `embedSourceSafe`, the Memory table) all exists; ~100 lines wire yesterday's turns into durable, deduped, embedded memory. And critically: it is *worthless under mock and honest under it* — which is why it sequences behind the embeddings fix, not ahead of it. On the Cartographer's point: the distiller makes no claim to reduce LLM calls; `llmCallsAvoided:0` is honest shadow-mode and should stay 0 until a real skip happens. The distiller compounds *recall*, not *avoidance* — a different pillar.

## 3. The ordered memory program.

Each step names the foundation it stands on and the honest test that it worked.

1. **Fuel + honesty (config, not build).** Real embeddings key + backfill; doctor reports `mock` as `config`. *Foundation:* existing adapter/backfill. *Test:* `measureEmbeddingFit` in the weekly scoreboard shows fit above the mock floor; doctor shows memory `live`, not green-over-mock.
2. **Stop un-learning (the trust trio, ~15 lines).** `detector.ts:160` never raises confidence on update; `tryReuseAnswer` filters `correctedAt:null`; add `system` to the keyhole blocklists. *Foundation:* outcome loop, corrections table. *Test:* correct a pattern, re-trigger detection three times — confidence stays decayed; a corrected answer never re-serves.
3. **Domain-scope the wiki gather.** Scope memories/knowledge by domain in `gatherDomainMaterial`. *Foundation:* the `domain` column already on docs. *Test:* a business memory never appears in the `training_science` page's synthesis.
4. **The distiller (the one real build, ~100 lines, gated behind step 1).** Nightly: read yesterday's ConversationTurns → extract durable facts/events/people → dedup against Memory → embed. *Foundation:* ConversationTurn, `chunkText`, `embedSourceSafe`. *Test:* something Cole said Tuesday and never `[SAVE:]`'d is recalled Friday, under real embeddings, without a keyword hit.

Steps 1–3 are fixes and cost days. Step 4 is the only build, and it earns its place because it converts data already paid for into a mind that remembers. **Fix the forgetting before adding the remembering** — a distiller feeding a mind that lies under mock and resurrects corrections would just consolidate the leaks faster.
