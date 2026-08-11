Sweep complete — all 22 files in the territory read in full (7,957 lines), plus cross-checks into `index.ts` pass-2, `core/time.ts`, `runLLM.ts`, and `corpus/ingest.ts` to verify claims. Report follows.

# LIFE & TRAINING territory — full-coverage sweep

## training/

**volume.ts** — deterministic tonnage/set math. **B-.** DEFECT: plate-notation doc/code contradiction — docstring says `"2 plates + 25" → [115]` (total plates, 45×2+25) but the code at `aurelius/training/volume.ts:131` and `:139` computes `plates*45*2+extra` → 205. One of them is wrong; every plate-notated lift's tonnage and Brzycki 1RM is either ~2× or ~0.5× reality, and a false "PR" announcement follows. `"8/side"` reps deliberately not doubled (documented, fine). Week math is pure date-string UTC — clean.

**prDetection.ts** — Brzycki PR detection. **B+.** First-ever exercise is `isNewPR: true` with improvement 0 — a baseline announced as a PR (minor noise). Caps reps at 10 honestly. Math clean.

**reasoner.ts** — LLM session review. **B.** The observations-only lock ("Never prescribe a future program", `:677`) is **prompt-only** — no output guard scans the returned feedback for prescriptions before it's written to the sheet. One hallucinated "next week go 5×5 @ 205" lands in the athlete's sheet. Also the prompt claims "Cole's eyes only. Athletes never see this" (`:672`) while the artifact is written to the **athlete's own sheet** Feedback tab — the sheet is presumably shared with the athlete. Fallback/parse layers are solid.

**sessionFeedback.ts** — Athletes-page "review latest session" button. **C+.** DEFECT: unlike the chat pass-2 flow (`aurelius/index.ts:748-768`), this path never persists `pr_record` memories or updates the Maxes tab after reasoning — so PRs detected via this button are re-announced as new on every subsequent run. Drift between two invokers of the same engine.

**trendSweep.ts** — Monday stall/slide signal. **A-.** Observations-only respected; deduped per week. Week-number math is crude (not ISO) but only used as a dedup key.

**battery.ts** — test-battery logging + record wall. **A-.** `batteryRecords` runs 7 sequential queries (fine at this scale). Clean.

## calendar/

**engine.ts** — sync, availability, conflicts, nudges. **B+.** Genuinely hardened (prune guard, phantom-availability guard, MAX_PAGES prune skip). DEFECTS: (1) **declined events count as busy** — `attendees[].responseStatus` is stored but never checked (`:108-131`, `:379`); an event Cole declined blocks availability, appears in the briefing, and can trigger a post-session "how did it go?" nudge for a session he never attended. (2) `computeAvailability` day windows use `setHours()` (process TZ) at `:372-374`, ignoring `AURELIUS_TZ` — on a UTC-hosted deploy (the Railway history in bot.ts says this happens) the 8:00–21:00 "waking window" is 01:00–14:00 Phoenix. (3) `nudgePostSessionDebriefs` (`:526`) does not check quiet mode — see quiet.ts.

**googleAuth.ts** — OAuth + token store. **A.** The probeRefresh/doctor-deletes-token story, cache invalidation on reconnect, and invalid_grant self-disconnect are all handled. Clean claim: I looked for a refresh-race (two concurrent `refreshAccessToken` when Google rotates the token) — Google rarely rotates, and last-writer-wins keeps the stored refresh token valid. Acceptable.

## planning/ + productivity/

**productivity/service.ts** — tasks/habits/today/deck. **B-.** THE TERRITORY'S BIGGEST DEFECT: `dayRange` (`:20-25`) builds the "day" as **UTC** bounds (`T00:00:00.000Z`) from an operator-**local** date string. Habits self-consistently write at `T12:00Z` so they survive, but two real-timestamp queries skew by the TZ offset: (a) `getToday`'s calendar window (`:284-287`) — under `AURELIUS_TZ=America/Phoenix` the "today" window is yesterday 17:00 → today 16:59 local, so **every evening event (17:00+) is missing from the Today view, the morning briefing's Calendar block, and session prep** — fatal for a coach whose sessions cluster 4–8pm; (b) `doneToday` counts (`:307`, also midday check at `planning/tools.ts:492-501`) — a task finished at 6pm local counts toward tomorrow. Streak math (`:181-189`): ignores `cadence` (a weekly habit's streak resets to 1 unless done daily), and `habit.streak` only updates on completion, so after a missed day the stored streak is stale — the streak sentinel then warns "7-day streak breaks at midnight" for a streak that already broke yesterday. Deck/risk-line logic itself is excellent.

**planning/tools.ts** — overload, week/day planning, midday check. **B.** `detectOverload` uses `toISOString().slice(0,10)` UTC day keys (`:78`) — same family of skew; the debrief's tomorrow-watch works around it by key-matching, acknowledged in comments. Otherwise honest and well-gated.

**planning/quiet.ts** — quiet mode. **B+.** Careful claim/restore logic. GAP: quiet pauses only the four "pushy" rituals; the **post-session debrief nudge keeps texting Cole's phone every 15 minutes' sync while he's sick/away**, and schedule-protection (06:45) keeps placing holds. "Away or sick: everything shifts" is overstated by exactly those two pushers.

**planning/sessionPrep.ts** — pre-session recall. **A-.** Correctly TZ-aware via `AURELIUS_TZ`. Its recall is only as good as the briefing's event list — see the getToday window bug (evening sessions get no prep).

**productivity/promises.ts** — promise ledger. **B+.** `startOfOperatorToday` (`:97-101`) uses **server-process** midnight while `dueDayOf` uses `AURELIUS_TZ` — on a UTC host, promises lapse at 5pm Phoenix the day before their due day ends. Extraction honesty is exemplary.

**productivity/captureSplit.ts** — brain-dump splitter. **A-.** Every failure path degrades to a note; nothing is lost. Conservative gate. Clean.

## telegram/ + media/

**telegram/bot.ts** — the bridge. **B+.** Auth is solid: chat-id gate, callback presser verification (`:167`), narrow token-rejection handling, 409 backoff, loopback timeout. DEFECTS: (1) **Prompt-injection via images** — `analyzeMedia` output (which the vision prompt orders to "transcribe ALL visible text verbatim") is concatenated into `handleCommand` (`:619-622`) and thence the full tool-bearing chat pipeline as if Cole typed it, and `captureMediaNote` → `ingestDocument` files it **un-defused** (`corpus/ingest.ts` has no `defuseDirectives`; `youtubeTranscript.ts:94-97` defuses, so the seam's own rule is violated). A forwarded screenshot containing adversarial text is instructions. (2) Non-chat commands (`/plan`, `/brief`, `/doctor`) run inline in the poll loop with no timeout — a wedged LLM call freezes all message processing (the 90s bound covers only the loopback path). (3) `getUpdates` fetch has no client-side abort; relies on undici's ~300s default before recovery.

**telegram/voice.ts** — Whisper STT. **A-.** Dormant-honest; errors are user-fit. No size guard, but Telegram's 20MB getFile cap fails upstream with an honest message.

**media/vision.ts** — image/video analysis. **B+.** Failover design is good. DEFECT: `MAX_INLINE_BYTES = 18MB` (`:16`) is checked **pre-base64**; encoding inflates ×4/3 → ~24MB request against Gemini's ~20MB ceiling, so a 15–18MB video passes the guard and 400s with an opaque provider error. Cap should be ~14MB.

**media/ingestMedia.ts** — chat-media capture. **B.** Good dedup hash; missing defusing (above). **media/host.ts** — public media host. **A.** Traversal-safe, random names, private-IP rejection.

## research/

**researchEngine.ts** — orchestrator. **B+.** Error-text guards, relevance gating, grounding label all honest. **researchFusion.ts B-** (confidence averaging is ad hoc; LLM tier's constant "LLM Summary" title buckets all LLM output into one insight). **llmResearchAdapter B** (works — `runLLM.ts:117` accepts singular `operator`; verified). **openSourcesAdapter/bookSourcesAdapter/relevance A-** (independent failure, whole-exchange timeouts). **youtubeTranscript B+** (honest about datacenter-IP flakiness; defuses). DEAD CODE: `serpSearchAdapter.ts` — reachable only with a SerpAPI key that .env history says never existed; `embeddingResearchAdapter.ts` is gated (`researchEngine.ts:53`) behind `OPENAI_API_KEY && RESEARCH_EMBEDDINGS_ENABLED` even though it no longer uses OpenAI at all — the gate is stale and the (now-honest) adapter is effectively unreachable. `researchConfig.uncertaintyThreshold` and `operatorDepthBias` are defined and never read (depth bias actually comes from operator profiles).

## Territory summary

**Top 5 by severity:** 1) UTC day-windows in `productivity/service.ts:20` — evening calendar events invisible to Today/briefing/session-prep, done-counts skewed (hits Cole daily). 2) Image-analysis text enters the tool-bearing chat pipeline and corpus un-defused (`telegram/bot.ts:619`, `ingestMedia.ts:56`) — the territory's one real injection hole. 3) Plate-notation load math contradicts its own spec (`volume.ts:106` vs `:131`) — silently wrong tonnage/PRs. 4) Declined calendar events counted as busy (`calendar/engine.ts:108`) — availability, briefing, and nudges all lie together. 5) Observations-only lock is prompt-enforced with no output guard, and the "athletes never see this" premise conflicts with writing to the shared athlete sheet (`reasoner.ts:672-697`).

**Which daily-life touchpoint fails Cole first under real use?** The morning briefing's calendar block. A coach's sessions are evenings; the UTC day-window silently omits them and session prep with them, while showing yesterday-evening's events as today's — the most-read artifact in the system teaches him to distrust it within a week, exactly what its own comments say must not happen.

**Three best opportunities:** 1) One TZ-correct `dayRange` in `core/time.ts` used by service.ts, tools.ts, and promises.ts — fixes five skews at once. 2) Defuse-at-the-door: run `defuseDirectives` inside `ingestDocument` and on media analysis before it reaches `handleCommand`. 3) A cheap deterministic prescription-scanner (regex for load/set/rep prescriptions in future tense) on reasoner output before `write_feedback` — turns the observations-only lock from a promise into a mechanism.
