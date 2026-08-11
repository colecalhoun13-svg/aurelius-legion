Ground truth gathered. Here is the Optimist's seat report.

---

# THE OPTIMIST — Leverage Report (verified against code, 2026-08-11)

What I verified first: this system's loops are unusually **complete**. `reachabilityAudit.ts` runs inside the smoke suite precisely because "built but uninvokable" was the recurring defect — and the recent waves closed it. The PR-to-proof chain is fully wired: `crm/retention.ts::logMetric` auto-flags PRs → `onPeak` files a Bridge signal → the Business page has a real "Draft proof post" button (`frontend/app/(chrome)/business/page.tsx:1790`) → `draftProofContent` writes into `content/queue.ts` → `stageForPublish` gates through the executor → `content/outcomeLoop.ts` reads reach back 72h later and credits the angle. Testing day just landed as ONE entry pass (`training/battery.ts`, commit e6194a0: "TESTING DAY mode, the Record Wall, the Combine Card"). The machine is not missing gears. It is missing **fuel and three keys**.

## 1. THE UNLOCK LIST (ranked by compounding effect)

**Cole-side — keys and clicks:**

1. **`GEMINI_API_KEY` + `EMBEDDINGS_PROVIDER=gemini` + `scripts/backfillEmbeddings.ts --force`.** One free key flips FOUR ladder rows at once (`tools/integrationStatus.ts`): Memory/recall from `partial (MOCK)` to live semantic, Vision, Live web search, and — critically — `compiled/semanticReuse.ts`, which the funded council found *could never fire under mock geometry* (COUNCIL_FUNDED §4.4). This is the single highest ratio of keystrokes to unlocked capability in the repo. Everything downstream — Layer 5.5 recall, the llmDependenceRate trend, grounded research — starts compounding the same day.
2. **The Google OAuth click at `/api/calendar/auth` + publish the consent screen** (2 minutes, documented in NORTH_STAR's standing note). One login wakes Calendar AND Sheets; Gmail is one more click. This is the fuel line for three scheduled jobs already on the spine (06:45 schedule-protection, 05:30 inbox triage, 07:30 outreach sweep) and for the entire athlete-sheet ingestion path (`crm/performance.ts::resolveAthleteSheet` even auto-finds sheets in Drive by athlete name).
3. **Paste the warm list + price ONE offer** (habit + decision, no key — COLE_CHECKLIST Part A #1–2). `crm/leadEngine.ts` names this plainly: every prior `addLead` caller was Cole typing. The warm list is the only channel that works at zero audience, and the 07:30 sweep is already scheduled and bounded to 3/day.
4. **Flip the earned grants on the Autonomy tab.** `trustLedger.ts::freshGrantSuggestions` now pushes suggestions into the briefing with a 14-day cooldown — the pull-only gap is fixed. The 21:15 queue sweep turns a proposal pile into executed-with-receipts the night a grant lands.
5. **`TELEGRAM_BOT_TOKEN` + `GROQ_API_KEY`.** The briefings, streak sentinel, and debrief→dawn thread exist but don't reach a phone without them; voice capture rides the same pair.
6. **`MEDIA_PUBLIC_BASE_URL` + IG connect** — the last gate on the outward lane (Meta fetches by URL; `content/queue.ts:150` correctly refuses to stage an imageless IG draft).

**One-day code splices (genuinely small, high yield):**

- **Render the Combine Card to a shareable image.** `CombineCard` exists only as a React component (`athletes/page.tsx:746`). A server-side SVG/canvas render into `media/host.ts` gives every proof draft an `imageUrl` — the exact field that currently blocks IG staging. This splice converts a testing day into a publish-ready asset automatically.
- **`onPeak` → auto-`draftProofContent` for `kind="client"`.** Today the PR signal tells Cole to go click a button. Drafting is inward (`content.draft`), so Aurelius could finalize the draft itself and the signal could carry "draft ready in the queue" instead of directions.

## 2. THE FLYWHEEL MAP

**Loop A — the proof flywheel:** testing day (one battery pass) → PR auto-flag → Record Wall + Bridge signal → proof draft → IG publish (Cole's tap) → tracked link (`crm/trackLinks.ts` mints real codes with click counters) → `/intake` → warm lead → CRM → next testing day. **Broken links, precisely:** (a) zero metrics exist because no athlete sheet is connected — Google auth, unlock #2; (b) `stageForPublish` blocks at `queue.ts:150` for want of an image — the Combine Card splice; (c) `MEDIA_PUBLIC_BASE_URL` unset — publish physically cannot complete. Three links, all named, all cheap.

**Loop B — the compounding-brain flywheel:** chat/voice → `compiled/chatCompiler.ts` mines heuristics → Cole confirms on the Bridge → `loadOperatorPatternsForPrompt` grounds every future prompt → `semanticReuse` serves repeats at zero tokens → llmDependenceRate falls on the Scoreboard. **Broken link:** `EMBEDDINGS_PROVIDER=mock` — reuse can never hit and Layer 5.5 recall isn't semantic. One env var + one backfill script.

**Loop C — the trust flywheel:** granted act → receipt → confirmed/undone counts in `trustLedger.ts` → `freshGrantSuggestions` in the briefing → Cole flips the next grant → more inward work finalizes → 21:15 sweep clears backlog nightly. **Broken link:** the first grants aren't flipped, so the ledger has nothing to earn with. This one is purely a tap on the Autonomy tab — the push side is already built.

**Loop D — the outreach flywheel:** warm list → 07:30 sweep drafts into Gmail drafts → Cole sends → Gmail reply-matching flips the lead to "conversing" and credits the angle → analytics rank what works. **Broken links:** empty warm list (a paste) and no Gmail auth (a click).

## 3. THE 2-WEEK PUSH: "Fuel Week, then Proof Week"

**Week 1 (Cole, ~one evening total):** Gemini key + embedding backfill; Google OAuth + published consent; Telegram + Groq; flip `calendar.schedule_protection` and `knowledge.apply_proposal`; paste the warm list; price one offer. **Week 2 (code, ~two days):** Combine Card image render + `onPeak` auto-draft splice; then run one real testing day.

Why this is the "second operator" moment, argued from what exists: the morning briefing already carries the risk line and grant suggestions, the debrief already names tomorrow's opening move, schedule-protection already fires daily at 06:45 — but today all of it either doesn't reach a phone or acts on an empty database. After Fuel Week, Cole wakes to a briefing that arrived on its own, references what he said yesterday (Layer 5.25 + real recall), defends blocks it already placed, and hands him three outreach drafts it wrote at 07:30. That is the felt difference between a console he visits and a colleague who was up before him — and every single piece of it is already merged, smoke-tested (218+ checks), and waiting on the ignition list above.
