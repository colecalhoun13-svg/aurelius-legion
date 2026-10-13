# STATE OF AURELIUS (2026-10-13)

**Method:** Scores below use only evidence I could verify this session — `file:line`,
a command + its output, or Cole's production `/doctor` paste (2026-10, "core alive,
on backup generators"). Anything needing live usage data (levels 4–5) is marked
**UNVERIFIED** pending the 30-day SQL. Past docs/comments were treated as hypotheses,
not facts. Nothing rounded up.

## Headline (3 sentences)
Aurelius is a genuinely strong *brain and spine* — the LLM router, the gated action
executor, the scheduled rituals, and the self-diagnostic all work and are reachable
(reachability audit clean; `tsc` 0 errors both trees). But in production it is running
degraded (Anthropic/xAI billing down → 100% failover; Google/Gmail OAuth rotting; **208
stranded memory vectors** so recall is silently lossy) and it carried a **critical
auth-bypass** (`next@14.2.3`, CVE-2025-29927) now patched in PR #91 but **not live until
the frontend redeploys**. The capabilities that would make it feel like *Jarvis for your
day* — reminders that fire, missions that act, a life-aware event bus — are built as
substrate but **wired to nothing**, so today it mostly speaks on a clock, not in the moment.

## Scorecard (0 Absent·1 Code·2 Wired·3 Works in prod·4 Reliable+alerts·5 Used/valued)

| # | Capability | Score | Evidence | Gap → smallest next step |
|---|---|:--:|---|---|
| 1 | Capture (voice/text/photo/share) | **3** | `telegram/bot.ts` pipes voice→Whisper, photo→vision, text, `share/` route; Telegram live in prod (briefings arrive) | Filing accuracy + usage UNVERIFIED → SQL #1; confirm captures land in the right table |
| 2 | Notes (store/search/recall) | **2** | `Note` model + semantic recall wired; thin usage (2 refs) | Prod use UNVERIFIED → verify a note is retrievable in chat |
| 3 | Tasks & **reminders** | **2** | tasks store/read works (`productivity/service.ts:58`); `dueDate` read into briefing only — **no job fires at due time** (`nowContext.ts:74-78`) | Reminders are the gap → add one due-task/event nudge job |
| 4 | Daily rhythm (brief/next/debrief/weekly) | **3** | crons live `index.ts:1766,1870,1863,1885`; delivered to phone (doctor) | Weekly-review value UNVERIFIED → SQL #3 briefings done |
| 5 | Memory & recall | **2** | writes work; **recall degraded** — 208 stranded vectors (doctor), filtered out of every search | Run backfill `--force` under a real provider → re-measure coverage (SQL #7/#8) |
| 6 | Proactivity (background, silent) | **3** | scheduled spine + salience gate live; midday silent-when-on-pace `planning/tools.ts` | Noise/over-filing UNVERIFIED → SQL #4 (receipts vs decisions) |
| 7 | Lead generation | **2** | `crm/leadEngine.ts` warm-list/draft/intake wired; public `/intake` live | 0 leads (UNVERIFIED → SQL #5) → surface a warm-list import + one-tap send |
| 8 | Client & business ops | **2** | CRM models + engines wired | 0 clients (UNVERIFIED → SQL #6) → nothing to build until client #1 |
| 9 | Instagram content | **2** | `content.draft` wired; **publish+metrics dormant** — Meta app not configured (doctor) | Publish needs Meta app + `MEDIA_PUBLIC_BASE_URL` → config, not build |
| 10 | Research (current/graded) | **2** | `research/deepWork.ts` wired | Live web-search config + graded usefulness UNVERIFIED → confirm Tavily/Gemini key |
| 11 | Model routing & cost | **3** | tiered router + failover **proven live** (doctor shows 100% failover working); budget metric exists `llm/` | No alert when failover/budget trips → push it (ties to #14) |
| 12 | Safety & trust (auth/gate/privacy/minors) | **3** | outward classes non-grantable by construction (`autonomy/actionClasses.ts:88-134,216-254`); gym/minor rules in schema (`Client.isMinor`, `kind`) | **Auth was the hole** (CVE) — patched PR #91, **compromised until deployed** |
| 13 | Interfaces (Telegram/app/voice) | **3** | Telegram live; Next PWA (19 pages); voice-in live (`telegram/voice.ts`); voice-out exists, not looped | Close voice-out loop → auto-deliver TTS as a voice note |
| 14 | Self-monitoring (doctor/alerts/evals) | **2** | doctor works + Cole runs it (`core/doctor.ts`); **but pull-only, no scheduled push, no evals** | Add a daily doctor push of FAILs → moves to 3 |
| 15 | My time cost (<20 min/day target) | **UNVERIFIED** | no usage data this session | Needs SQL #1/#2/#4 (captures, chat turns, cards decided) to measure |

## 5 truths that might surprise you (with evidence)
1. **The "Jarvis" substrate exists but points at a business, not your life.** The event
   bus has exactly three types and all are CRM: `lead.inbound`, `lead.reply_received`,
   `pr.recorded` (`core/events.ts:45,59,71`). Nothing in your day (a mail that needs you,
   a moved meeting, an overdue promise) is on it.
2. **Your autonomous missions can research but can't act.** `missions/engine.ts:27` —
   `STEP_KINDS = {research, recall, synthesize}`. Chat can run gated tools; the scheduled
   loop cannot. The acting machinery exists (`autonomy/executor.ts`) with no autonomous caller.
3. **Reminders don't exist as a firing capability.** Tasks carry `dueDate`/`scheduledFor`
   (`productivity/service.ts:58`) but they're only *read into* the 7am briefing
   (`nowContext.ts:74-78`); no job pushes you when something is actually due.
4. **Recall is quietly lossy right now.** 208 vectors are stranded in a prior provider's
   geometry (doctor), and search filters by current `embeddingModel` (`VectorEmbedding`
   schema), so those memories return from nothing — the brain "forgets" silently.
5. **The code is cleaner than its reputation.** Despite `strict:false`, both trees compile
   with **0 `tsc` errors**, and the reachability audit is **clean** — every capability has
   a live invoker. The problem isn't dead code; it's live code pointed the wrong way.

## Top 5 risks (ranked)
1. **Auth-bypass live until redeploy (CVE-2025-29927).** Patched in PR #91; prod still
   runs 14.2.3 until the frontend rebuilds. Until then the app lock is skippable. *Act: merge #91.*
2. **Silent degradation, pull-only diagnosis.** Billing/OAuth/vector failures run for weeks
   unless Cole opens `/doctor` (the current prod state is the proof). *Act: daily doctor push.*
3. **Memory loss from stranded vectors.** 208 memories invisible to recall; grows with every
   provider switch. *Act: backfill `--force` under a real provider.*
4. **OAuth token rot (7-day).** Google consent screen in Testing → Gmail+Calendar die weekly,
   taking the two real life-inputs with them. *Act: publish the consent screen + set `GOOGLE_GMAIL_REDIRECT_URI`.*
5. **Single-operator maintenance load.** ~68k LOC, ~70 env vars, no CI, `strict:false` —
   a non-engineer can run it but not safely change it. *Act: CI `verify` gate (see roadmap).*

## Still UNVERIFIED (close with your data)
- All usage: captures/wk, briefings delivered, Bridge cards created/confirmed/dismissed,
  leads, clients, chat turns, LLM calls by provider (SQL #1–#10).
- Retrieval coverage: memories vs embeddings, null vectors, model distribution (SQL #7/#8).
- Whether `AURELIUS_TZ` is set in prod (crons fire in process TZ, UTC if unset — `schedule.ts:168`).
- Live output quality: one briefing, two outreach drafts, one brain-dump classification
  (Step 3 — needs a prod dry-run; sandbox has no DB/keys).
- Whether the smoke suite passes against a real DB (couldn't run here — no `DATABASE_URL`).
- Whether `initiative_pulse` registers at boot (nested under a conditional, `index.ts:1988`).
