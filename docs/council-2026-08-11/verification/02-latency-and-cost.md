I have everything I need. Compiling the analysis now.

---

# PERFORMANCE & COST — Verification Pass

## 1. The chat-path latency budget (measured from code)

A single `POST /api/aurelius` turn (`index.ts:802`) executes this **strictly sequential** chain before the user sees anything:

**Pre-LLM assembly (all `await`ed in series):**
- Mirror/council regex + dynamic imports — negligible warm.
- `routeOperatorsSemantic(message)` (`index.ts:915` → `operatorRouter.ts:341`) — **embedding round-trip #1** (`semanticScores` embeds the message, `operatorRouter.ts:318`; operator-profile vectors are cached, `:288`).
- `runLLM` reuse check (`runLLM.ts:23-44`) — `tryReuseAnswer` embeds the input again = **round-trip #2** (chat isn't `noReuse`).
- `buildSystemPrompt` (`router.ts:309`) runs ~11 layers **one after another**, each its own DB hit: operator-score (`:378`), NOW block (`:389`), memory load (`:398`), recent conversation (`:413`), `resolveOperatorId` (`:424`), **compiled-pattern fit-rank** — embeds the query yet again via `retrieveFitPatterns` (`reasoningHelper.ts:239`) = **round-trip #3**, field-synthesis `wikiPage.findMany` (`:496`), and **`semanticRecall`** which embeds the query once more + pgvector search (`retrieve.ts:72`) = **round-trip #4**, corpus awareness (`:535`).

So the **same user message is embedded 3–4 times per turn**, none shared, each a separate cloud call (Gemini free tier ≈ 200–500 ms each) → **~0.7–1.8 s in embeddings alone**, plus ~50–200 ms of serial DB layers.

**The LLM call itself:** `runAdapter` → `anthropicEngine.ts` does **one blocking `fetch` + `await res.json()`** (`:71,:84`). There is **no streaming** — the promise resolves only after the *entire* completion is generated. Default chat model is Sonnet 5 (`router.ts:118,183`), `max_tokens: 8192` (`anthropicEngine.ts:23`).

**Realistic wall-clock to first visible text, plain chat turn:**
- embeddings + DB assembly: ~1–2 s
- Sonnet: first-token ~0.4–0.8 s, but the user waits for the *whole* answer (300–800 tok @ ~50–70 tok/s) = **5–12 s**
- **Total ≈ 6–14 s.** A voice target of <1.5 s TTFT is **~4–10× over on a plain turn.**

**The tool path is far worse.** The bounded agentic loop (`index.ts:1133`, `MAX_TOOL_ROUNDS = 3`) calls `routeLLM` **once per round** (`:1177`) — and every call **re-runs the full `buildSystemPrompt`** (all DB layers + 2–3 re-embeds) and blocks on a full completion. Initial call + up to 3 synthesis rounds = **up to 4 sequential full completions**, each re-paying assembly → **20–40 s** for a chained tool turn.

**Top-3 bottlenecks and what each fix buys:**
1. **No streaming (biggest).** The user gets nothing until generation finishes. Switching adapters to SSE (`stream:true`, parse `content_block_delta`) drops TTFT from full-generation (6–12 s) to first-token (**~0.4–0.8 s**). Mandatory for voice — you TTS sentence 1 while the rest generates.
2. **The tool loop re-assembles from scratch each round.** Carrying a `messages[]` array across rounds (reuse the cached prefix, append tool results as turns) instead of rebuilding `buildSystemPrompt` removes 2–3 redundant prompt builds, each with its own embeds — a tool turn drops from ~4× assembly to 1×.
3. **Redundant serial embeddings + serial DB.** Embed the query **once** and pass the vector to routing, fit-rank, recall, and reuse; run independent layers under `Promise.all`. Buys **~0.7–1.5 s** and cuts embed calls 3–4 → 1.

(Prompt caching helps cost, not latency — TTFT on a ~14 K-token prompt is ~0.5–1 s even on a warm cache. And chat hardcodes the *strategic* tier; a voice tier wants the existing `fast`/`realtime` tiers with frontier escalation.)

## 2. The streaming gap — verdict

**Nothing streams today.** `anthropicEngine.ts` issues a single POST and `await res.json()` (`:84`); every adapter returns a complete `LLMResponse.text`. `routeLLM`/`runLLM` resolve to a finished string, and the Express handler returns one JSON blob. **Streaming would require a cross-cutting rewrite of the entire return path**, not an adapter tweak: (a) adapters open SSE and yield deltas; (b) `runAdapter`/`routeLLM`/`runLLM` expose an async iterator/callback; (c) the endpoint switches to SSE/chunked; (d) all post-processing that runs on the *complete* text — directive/`[TOOL:]` extraction (`index.ts:1049`), the reuse-cache write (`runLLM.ts:96`), logging (`:53`) — moves to end-of-stream. Every consumer currently assumes a whole string.

## 3. The cost model (repo price table, `pricing.ts`, PRICES_AS_OF 2026-08-06)

Sonnet $3/$15 per M (cached-in $0.30); Opus $5/$25; gpt-5.4-mini $0.40/$1.60; Groq llama-3.3-70b $0.59/$0.79; Gemini embeddings = **free tier ($0)**. Assumed per turn: ~10 K static-cached input + ~4 K fresh dynamic + ~500 out → **≈ $0.022/Sonnet turn warm-cache**; tool turn (≤4 completions) ≈ $0.05–0.09.

- **(a) Spine + light chat:** ~10–12 daily LLM jobs (many multi-call: briefing, initiative, debrief) ≈ 30–50 Sonnet calls/day @ ~$0.03 = ~$1–1.5/day; curriculum 2×7 units/week ≈ $1–2/wk; ~20 chat turns/day ≈ $0.50/day. **≈ $50–75/mo**, embeddings $0.
- **(b) Fueled + real embeddings + active use:** 100+ chat turns/day, more tool loops, occasional `/deep` Opus (~$0.10–0.20/turn). Embeddings stay effectively free (even on OpenAI `text-embedding-3-small` @ $0.02/M, ~4.5 M tok/mo = ~$0.09). **≈ $150–250/mo.**
- **(c) Always-listening voice Jarvis** (on top of spine): cloud STT (Whisper ~$0.006/min, ~200 VAD-gated utterances/day ≈ 33 min = ~$6/mo); fast conversational tier every utterance — **Groq has no prompt caching so the full ~14 K prompt bills each call**: llama-70b ≈ $0.0085/turn × 200/day ≈ **$50/mo** (Sonnet instead ≈ $130/mo); frontier escalation ~10% of turns via Opus ≈ **$90/mo**; cloud TTS (~$15/M chars, ~2.4 M/mo) ≈ **$15–40/mo**. **≈ $200–350/mo cloud.**

**Where local changes the math:** whisper.cpp (STT), a local TTS (piper), Ollama embeddings, **and the fast conversational tier run local → ~$0 marginal.** That zeroes STT+TTS+embeddings+fast-tier (~$70–170/mo of scenario C). **What must stay cloud: frontier escalation** — the Mini cannot run an Opus/Sonnet-class model — leaving only ~$50–90/mo. **Breakeven:** local removes ~$100–200/mo of conversational spend against a one-time ~$1,000 Mini → payback in **~6–10 months**, and it removes the per-utterance network round-trips that cloud STT/tier/TTS each add.

## 4. Always-on resource envelope (DEPLOY_MAC_MINI.md: recommended **M4 / 24 GB / 512 GB**)

Concurrent local stack, rough RAM: macOS + Postgres + backend + frontend baseline ~6–10 GB; whisper.cpp small.en ~0.5–1 GB; local TTS ~0.5–1 GB; Ollama embeddings ~1–2 GB; **the local reasoning tier is the constraint** — a model good enough to sub for Groq's 70B needs ~40 GB (won't fit); a realistic 24 GB tier is an **8B (Q4 ~5 GB) or 14B (~9 GB)**, a large quality drop. Summed 8B stack ≈ **17–18 GB — fits in 24 GB with headroom** (16 GB tight, 32 GB comfortable). GPU/ANE: M4 base runs an 8B at ~20–40 tok/s, but whisper + LLM generation contend for the **same unified GPU**, so simultaneous STT + generation partially serialize and add latency.

**Verdict — can the planned Mini be a felt-instant voice Jarvis?** The doc's own framing is correct and honest: the base M4/24 GB is enough for **STT + TTS + embeddings + a *small* (8B) local tier** — which is exactly what it scopes ("heavy thinking uses cloud models; the Mini runs OS, database, and small local models"). It is **not** enough to host a *local* conversational tier that rivals the cloud fast tier (70B) or frontier. So:
- **The dollar dream is very reachable** — local zeroes STT/TTS/embeddings/fast-tier; ~$50–90/mo of unavoidable frontier-escalation is the floor.
- **The latency dream is blocked in software, not hardware.** Even a perfect box can't be felt-instant while the architecture (i) **never streams**, (ii) **re-embeds the query 3–4× serially**, and (iii) **re-runs the whole prompt build up to 4× per tool turn.** Fix streaming + single-embed + parallel assembly first; those three changes move a plain turn from ~6–14 s to **sub-1.5 s TTFT** and a tool turn from 20–40 s to a streamed single-digit. **The gap is the return-path rewrite of §1–2, and a RAM/chip bump (32 GB, ideally M4 Pro) if the conversational tier is to live locally rather than on Groq/cloud.**

*(All figures are estimates with assumptions stated inline; the repo price table is hand-maintained and dated 2026-08-06, and its own header warns non-Anthropic rows are unverified.)*
