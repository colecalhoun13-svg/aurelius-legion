# ROADMAP TO NINE

**Basis:** HEAD is `f77eb2a`, `git status` clean. Five chairs (Systems Architect, Reliability
Engineer, Revenue Operator, Chief of Staff, Product Skeptic) wrote roadmaps; the Adversary
attacked all five; each chair re-costed having read the others. This is the merged instruction
set. Nothing here is invented — every item, cost, and citation is a chair's or the Adversary's,
attributed. Where chairs still disagree, both positions are shown.

Written 2026-08-07 against `docs/AURELIUS_3.4_VISION.md` (Cole's own words, 2026-08-07),
`docs/NORTH_STAR.md` (architecture of record), and `CLAUDE.md`.

**Live database state, verified by four chairs independently, quoted here once so the rest of
the document can stop repeating it:**

```
BridgeSignal   expired 785 · noted 468 · pending 102 · acted 3 · dismissed 1   (1,359 all-time)
  of the 102 pending: 16 carry a confirm button · 15 distinct titles
  severity spread:    notice 49 · attention 35 · info 15 · critical 3
Lead 0 · Client 0 · Offer 0 · MarketingAngle 0 · Invoice 0 · Payment 0
CompiledPattern 0    (against 1,347 ReasoningCacheEntry rows, 1,345 of them audit-log writes)
JobRun 43 done · 1 failed
llmDependenceRate  100, 100, 100  (three consecutive weekly snapshots)
```

Four human interactions in 1,359 signals. **This system has never met its user.**

---

# 0. VISION VS HEAD

A section-by-section read of `AURELIUS_3.4_VISION.md` against the code. Cole wrote that spec; he
is entitled to know which parts already exist before he reads a list of work.

## §1 — What Aurelius 3.4 is / what it runs on

| Claim | Verdict | Evidence |
|---|---|---|
| Personal OS, not a chatbot | **REAL** | Five operators, scheduled spine, Bridge, autonomy gate |
| Mac mini always-on compute node | **PARTIAL** | `docs/DEPLOY_MAC_MINI.md` is genuinely detailed, but PART 5 installs a **per-user LaunchAgent** requiring a logged-in GUI session. After a power blip with FileVault on (macOS default), the Mini boots to the unlock screen and Aurelius is dark until Cole walks to it (Reliability Engineer 7) |
| Ugreen NASync → storage/sync/ingestion | **PARTIAL** | `AURELIUS_BACKUP_DIR` is a one-variable swap and the runbook maps every path — genuinely well-prepared. But `core/backup.ts:40`'s `mkdirSync(BACKUP_DIR, {recursive:true})` **recreates a dropped `/Volumes/…` mount as a local directory on the internal SSD**; `pg_dump` succeeds, the `bytes < 1024` check passes, every instrument reads green, and the only off-box copy of the second brain doesn't exist |
| Local + cloud connectors | **PARTIAL** | See §6 |

## §2 — The four-layer stack

### §2.1 Operator cores — **REAL**
Chief of Staff: *"real, and they genuinely never auto-mutate. `persona` scope never auto-applies
even when granted."* Matches NORTH_STAR §2.5 and CLAUDE.md hard rule 1.

### §2.2 Living Knowledge — **REAL**
Postgres-backed, propose→confirm, queried during reasoning. Taxonomies live where the spec says
they should: `crm/service.ts:47-54` (lead stages, offer types), `business/profile.ts` (facts,
revisioned). Training taxonomies real. **Wealth taxonomies (accounts, categories, recurring
patterns) — ABSENT**, see §3.4.

### §2.3 Compiled Understanding — **PARTIAL, and the metric is misleading**
This is the largest single gap between the spec and HEAD, and the one Cole named first.

- `ReasoningCacheEntry` — real, 1,347 rows. **But 1,345 are `domain='taxonomy_update'`,
  `entityKey='cole'`, written by `knowledge/proposals.ts:132,349` — an audit log, not operator
  reasoning** (Product Skeptic). `detectPatterns` (`compiled/detector.ts:30-35`) scopes by
  `(operatorId, domain, entityKey)`, so it has one bucket to work in and that bucket is
  bookkeeping.
- `CompiledPattern` — **0 rows.** Layer 5.4 has never decorated a prompt.
- *"Over time, reduces LLM calls"* — **not true at HEAD, and the metric cannot make it true.**
  `compiled/reasoningHelper.ts:66` hardcodes `llmCallsAvoided: 0` with the comment `// v1 always
  0`. Layer 5.4 (`llm/router.ts:427`) *decorates* prompts; it never short-circuits. The only
  mechanism that would — `compiled/shortCircuit.ts` — is shadow-only by construction and
  `canShortCircuit()` has **zero production callers** (`smokeSuite.ts:2360` and a comment).
  `LogEntry` has **zero `decision:case` rows**: it has never run.
- `llmDependenceRate` (`measurement/scoreboard.ts:103`) = `llmCalls / (llmCalls + cacheReuses)`,
  where the numerator counts **every** `llm_call` system-wide (curriculum ingest, briefing voice
  pass, triage, wiki synthesis) and the denominator's other term moves only on `semanticReuse`
  hits. Systems Architect: *"it rises whenever the system does more scheduled work, regardless
  of how good compilation gets, and falls when stale answers get served."* Chief of Staff:
  **"The DoD metric currently rises when the system works and falls when it misbehaves."**

**Credit where due, and it is real:** `compiled/shortCircuit.ts` is, in the Product Skeptic's
words, *"the most honest module in the repo"* — CASE → SHADOW → VERDICT → GATE, refuses to count
shadow hits as savings, gates real skipping behind ≥10 graded agreements **and** Cole's switch.
It was built correctly and should not be touched.

### §2.4 Research Memory — **PARTIAL**
Paperless-ngx real (`corpus/paperlessPoller.ts`, 10-min poller, boots dormant per hard rule 4).
RSS real. Web/academic research tiers real. YouTube transcripts real
(`research/youtubeTranscript.ts`). **Zotero absent. NotebookLM absent.** Perplexity-shaped
grounding is served by the existing research adapters.

## §3 — Operators

### §3.1 Training — **REAL, and the strongest compiled-layer citizen**
`reasonWithCompilation` (`compiled/reasoningHelper.ts:80`) implements all seven Pass 2 steps and
has **exactly one production caller: `training/reasoner.ts:486`.** That caller is the training
operator.

### §3.2 Business (CRM + sales + offers) — **PARTIAL**
- Track leads / classify by stage & source — **REAL** (`crm/`, Lead → Client → Engagement →
  Session → Invoice → Payment; Revenue Operator calls `crm/` *"the best-engineered code in this
  repo"*).
- Recommend next actions — **REAL** (`crm/leadEngine.ts::runOutreachSweep`, 3/run).
- *"Learn which actions convert best over time"* — **DOES NOT CLOSE.** `recordOutcome`
  (`business/marketing.ts:279`) has exactly two callers, the chat tool
  (`tools/adapters/business.ts:133`) and an API route — **both are Cole typing.** And the funnel
  is one-directional in code: `grep -in "lead" autonomy/workflows/inboxTriage.ts` returns
  **nothing**, so when a warm lead replies, her `Lead` row stays `contacted` forever.
- Help design and refine offers — **REAL** (`business/offers.ts`), and correctly refuses to
  activate an unpriced offer (`:240-247`).
- *"Automate follow-ups and reminders"* — **CONSTRAINT COLLISION, resolved.** Reminders are
  inward and already legal. *Follow-ups* means sending, which is outward and non-grantable
  (NORTH_STAR §2.5). Reliability Engineer's non-violating version: **a batched confirm** — the
  07:30 sweep drafts, and one Bridge card offers "send all 3" as a single tap firing three
  separate gated confirms. Cole's hand on every send; his cost drops 3 taps → 1.

### §3.3 Content — **PARTIAL, two finished halves that have never met**
`instagram/insights.ts` (`accountMetrics`, `recentPostMetrics`, `postingPatterns`,
`metricsDigest`) is real and well-built — and reachable **only** from three chat-tool branches
(`tools/adapters/content.ts:211,221,247`). Zero schedule entries, zero UI, never persisted,
never joined to `Lead.angleId`. *"Which topics generate leads"* is one join from being
computable and nothing performs the join.

Publishing: `content.draft` (inward) + `content.publish` (outward, always confirm) + the
Instagram engine are real. **But `media/host.ts`'s `hostBytes`/`hostLocalFile` have zero
production callers** — the only writer of `ContentDraft.imageUrl` is a text box at
`business/page.tsx:1105`. Setting `MEDIA_PUBLIC_BASE_URL` makes the doctor print `live` without
making publishing possible. That is an unstated prerequisite and it belongs on the record.

### §3.4 Wealth — **ABSENT**
`aurelius/wealth/engine.ts` exports exactly one function: `runMarketPulse` (`:28`). It is a
macro crypto/equities/news digest wearing a wealth operator's name. `grep "model .*Expense|model
Account"` over `schema.prisma` returns nothing. No income aggregation, no categories, no
recurring-cost table, no P&L on either side. `measurement/spend.ts` tracks LLM cost only — and
`spendLine()` (`:134`), whose own docstring says *"One line for the doctor, the briefing, and the
self tool,"* has **zero readers.** Chief of Staff: **"Aurelius currently cannot tell Cole what
Aurelius costs."**

### §3.5 Personal OS — **REAL, and the only saving any chair scored as real**
Calendar sync (15-min), tasks, triage, rituals, focus blocks. Chief of Staff: *"the strongest
operator in the repo. This is where the +1.0 to +1.2 hr/wk comes from."*

## §4 — Pass 2 reasoning pipeline — **RUNS FOR ONE OPERATOR OF FIVE**
Cole's spec: *"Every operator uses the same Pass 2 reasoning pipeline."* `grep
reasonWithCompilation` returns exactly one non-test caller: `training/reasoner.ts:486`. Business,
content, wealth and personal-OS never build a situation signature, never do cache lookup, never
do pattern lookup. **Step 5 ("if a strong pattern exists → use it, minimal LLM") exists
nowhere.** They run a degraded version: whole-answer semantic reuse plus prompt decoration.

## §5 — Multi-LLM routing — **REAL, with a cost caveat**
Correctly built including the `providerConfigured` failover chain. But `llm/router.ts:769-778`
strips unconfigured providers from the tier chain, so **on an Anthropic-only key every `fast` and
`structured` task lands on `claude-sonnet-5`** — 5× and 7.5× the intended rate. Chief of Staff:
*"a cost problem, not an hours problem, and the fix is a $0 Groq key rather than code."*

## §6 — Connectors

| Connector | Verdict |
|---|---|
| Google Sheets | **REAL** — `tools/adapters/googleSheets.ts`, 18 actions, registered |
| Calendar | **REAL** — 15-min sync |
| Gmail | **REAL** — triage + drafting; sending is outward and gated |
| CRM (HubSpot/Streak) | **DELIBERATELY NATIVE** — `crm/` instead. Endorsed by all five chairs |
| Meta / Instagram | **REAL but gated** — see §3.3 |
| YouTube analytics | **ABSENT** (transcripts real; analytics not) |
| Paperless-ngx | **REAL**, dormant until configured |
| Obsidian/Logseq | **REAL one-way** — `wiki/vaultMirror.ts` → `VAULT_DIR`. Logseq absent |
| Immich | **ABSENT**, zero grep hits |
| Zotero | **ABSENT** |

Chief of Staff, plainly: **"Sheets and Obsidian are real, Paperless and Calendar and Gmail are
real, the rest is collection."**

## §7 — How it puts money in your pocket

| Sub-claim | Verdict |
|---|---|
| 7.1 tracks every lead, learns which convert | **PARTIAL** — tracking real, learning requires Cole to type (`recordOutcome`) |
| 7.1 *"what to say based on past successful messages"* | **ABSENT** — needs Pass 2 for business (§4) and ~20 confirmed drafts |
| 7.2 which offer performs with which segment | **ABSENT** — `anglePerformance` stops at `_count.leads`; no revenue join |
| 7.3 which topics generate leads | **ABSENT** — one join away, see §3.3 |
| 7.4 better training results | **REAL** — the training operator is the one that works |
| 7.5 financial clarity | **ABSENT** — see §3.4 |
| 7.6 better use of time | **REAL** — see §3.5 |

## §8 — Jarvis-level checklist, honestly

Multi-domain **yes** · knowledge-evolving **yes** · research-grounded **yes** · identity-stable
**yes** · action-capable **yes, correctly gated** · pattern-learning **not yet — 0 patterns** ·
LLM-minimizing over time **not yet — measured at 100% dependence, three snapshots running** ·
explicitly money-focused **in the code, yes; in the outcomes, $0**.

## Where the vision would violate a hard constraint

Only one place, and it has a clean resolution. §3.2's *"automate follow-ups"* and §6's *"act on
your real systems"* read as automatic sending. Sending is outward and non-grantable by
construction (NORTH_STAR §2.5, CLAUDE.md hard rule 1). The version that does not violate the
constraint is what is already built — draft inward, send outward — plus Reliability Engineer's
**batched confirm** (§3.2 above). Chief of Staff: *"I have no rewrite to propose."* Nothing in
the vision asks for autonomy to escalate itself.

---

# 1. THE HONEST CEILING

**Read this before the list. It tells you what you are on the hook for.**

## The number, and the one dissent

| Chair | Ceiling on code alone |
|---|---|
| Systems Architect | **6.** *"Build to 6, then stop building and sell something. A seventh point bought with more code would be a lie, and this repo's characteristic failure is exactly that purchase."* |
| Reliability Engineer | **6**, hard stop. *"My items take Aurelius from 'a thing Cole is watching' to 'a thing Cole can stop watching.'"* |
| Revenue Operator | **6.** *"Any chair who tells you a build gets past 7 is selling you a month of work as a substitute for a month of selling."* |
| Chief of Staff | **6.** *"Everything between here and there is removal — of duplicate work, of silent failure, of immortal rows, of claims the code doesn't implement."* |
| Product Skeptic | **6**, *"and most of the distance is in surfaces and queries, not engines."* |
| **The Adversary** | **5. Not 6.** |

The Adversary's dissent is arithmetic and it is preserved because it may be right:

> "The five lists sum to ~120 hours. Deduplicated against each other and against what is already
> at HEAD, the distinct engineering is **35-40 hours** — eight defect classes described five ways
> [...] **the reason four chairs all land on 6 is that they are each counting the same eight
> fixes and pricing them as their own lane.** What those hours buy is a system that stops lying
> about itself. Every one of those is *removal of a falsehood*. None of them is a capability. **A
> system that has stopped lying and has nothing to say is a 5.**"

His 6 arrives the week two things are both true: Cole pastes twenty names, **and** the reply loop
is built — *"the only proposed mechanism on any list that produces an observable Cole did not
type."*

## What Cole is on the hook for

Six inputs. Roughly **two hours of his active time**, and they gate more than every item in
§2 combined.

**1. A number in `Offer.priceCents`.** Ten minutes. `activateOffer` (`business/offers.ts:240-247`)
correctly refuses an unpriced offer and `offerContextBlock()` correctly forbids the model
inventing one — this is not a defect, it is the system being honest about a blank. Drivable from
his phone right now: `business.activate_offer` (`tools/adapters/business.ts:51`) takes
`priceCents` and is reachable by typing at the Telegram bot. **Until that integer exists, every
draft this system produces opens a conversation that cannot close**, `runMarketingPass` returns
`{ran:false, reason:"no_offer"}` forever, and roadmap items 35, 36, 38 evaluate to zero.

**2. Twenty warm names.** ~20 minutes. `Lead` = **0**. `importWarmList` is the only channel that
works at zero audience and it takes a paste no engine can perform.

**3. Reading three drafts.** ~30 minutes, zero build — **and it is item 0 on the list below.**
Every chair named draft quality as the single largest unknown in four councils; **not one chair
made it an item** until the Adversary did. Point the funded key at one warm-list name, run
`draftOutreach`, read what comes out.

**4. A second API key** (OpenAI or Gemini, for embeddings — Anthropic has none).
`retrieval/embeddingAdapter.ts:174-192` offers openai · gemini · mock. Without one, Layer 5.5
semantic recall, `/ask` sources, semantic reuse, precedent retrieval and compiled-pattern
retrieval are all dark behind one boot `console.error`. **Warning: buying this key activates the
reuse defect (item 18). Fix before, not after.**

**5. `LLM_MONTHLY_BUDGET_USD`.** Blank at `.env.example:83`, in neither deploy doc, so the whole
budget alarm is dormant by default.

**6. Thirty days of him actually living in it**, on a Mini that does not sleep, with Google OAuth
out of Testing mode. Systems Architect: *"Every leverage number in three councils is arithmetic
on assumptions about a man nobody has observed using this system."*

## What each band is gated behind

| Band | Gate | Who says |
|---|---|---|
| **→ 5** | Nothing. Pure code. ~8 hours of the near-free items alone gets most of the way | unanimous |
| **→ 6** | The rest of the code work (~25-40h total) **plus** twenty names pasted **plus** the reply loop | four chairs say code alone reaches it; Adversary says the names are required |
| **→ 7** | Cole's price, his twenty names, and **his first ten sends.** Systems Architect: *"The gap between 6 and 7 is not code. It is his first ten conversations."* | unanimous |
| **→ 8** | **~20 real outreach sends** (`anglePerformance`'s own 10-use honesty floor stops saying "too early to read") and **one paying client attributed to an angle**, flowing Lead → Client → Engagement → Invoice → Payment | unanimous |
| **→ 9** | **A year.** `CompiledPattern` non-zero outside the training room, compiled understanding measurably displacing LLM calls, plus a second client and a retention number. Chief of Staff: *"I do not think 9 is reachable in 2026 and I would not plan against it."* | unanimous |

---

# 2. THE ORDERED LIST

Ranked by (points gained) / (build + ongoing cost). Costs are as the chairs stated them; where
the Adversary corrected a cost, both are shown. Every item names its **INVOKER** because
CLAUDE.md hard rule 8 says an unmet invoker means the capability does not exist.

---

## Item 0 — Read three drafts

- **Band:** none. It is not a build. It reprices a third of this document.
- **What:** Point the funded key at one warm-list name. Run `draftOutreach`. Read the output.
  Then run `inboxTriage` on one real message and read that.
- **Why:** The Adversary, add (e): *"Every chair states that draft quality is the single largest
  unknown in three councils and that nobody has ever seen this system's output. **Not one chair
  made it an item.**"* If the drafts are generic, the Chief of Staff's `+1.0 to +1.2 hr/wk` is
  fiction, item 17's rotation makes the treadmill burn the warm list faster, and roughly a third
  of both lists is misallocated. **This resolves more uncertainty per minute than anything else
  proposed and it can be done before any code is written.**
- **INVOKER:** Cole, a terminal, thirty minutes.
- **Prereqs:** Funded Anthropic key. One name.
- **Build cost:** **0 h build, 30 min of Cole's time** · **Ongoing:** zero.
- **How we'd know:** He can answer "are these any good" with a yes or a no. Today no human on
  earth can.

---

## TIER A — near-free truth fixes (all under one hour; ~5 hours total for the tier)

### Item 1 — Fix the Bridge severity sort
- **Band:** 4→5. **The Adversary: "Highest-value item in this document."**
- **What:** `productivity/service.ts:271` orders `[{ severity: "desc" }, { createdAt: "desc" }]`
  over a **String** column (`schema.prisma:384`, vocabulary `info | notice | attention |
  critical`). `"desc"` on a string is reverse-alphabetical: **`notice > info > critical >
  attention`.** Replace with a rank map or a raw `CASE`. **Ship it detached from item 12's deck
  refactor** — the Adversary's explicit instruction and the Systems Architect's concession.
- **Why:** Product Skeptic's find, verified independently by all four other chairs plus the
  Adversary by running the exact query against live Postgres: **ten rows returned, all ten
  `notice`**, seven of them duplicates of two titles. The three `critical` rows — the outward
  publish confirms `609cd56` made critical **on purpose** so they would finally reach Cole — rank
  below every one of the 49 `notice` rows, with the 35 `attention` rows sorting last of all.
  Adversary: *"**Without this, the tier-derived-severity fix the FUNDED council credited as
  holding (`executor.ts:126-128`) is invisible on every UI surface.** It makes an already-shipped
  fix real."* Systems Architect, conceding: *"I spent my report proving the Bridge is the
  transport every other capability rides, and then never checked whether the transport sorts."*
- **INVOKER:** `/api/deck` and `getToday`, already mounted, already consumed by
  `home/page.tsx:227` and `SignalsBench.tsx:71`. **No new invoker.**
- **Prereqs:** None.
- **Build cost:** **~20 min** · **Ongoing:** zero.
- **How we'd know:** Smoke: seed one `critical` + twenty `notice`; assert the critical sorts
  first.

### Item 2 — Make the badge count decisions
- **Band:** 4→5 (Product Skeptic: worth ~half a point alone; pairs with item 12)
- **What:** `frontend/app/api/nav/badges/route.ts:12` counts all pending signals + pending
  proposals. Count only `pending/surfaced` rows whose `actions` contain `confirm_action`, plus
  pending `KnowledgeProposal`. **On this database that is 16, not 103.**
- **Why:** Product Skeptic: *"A number that only goes up, attached to a page that cannot show you
  what it counts, is the most reliable way to kill a personal system I know. It is also why his
  interaction count is 4."* Two councils fixed the **writers** (a data migration, a schema
  comment telling authors to "prefer" the helper) and 19 raw `bridgeSignal.create` sites still
  bypass `surfaceSignal`. **The reader is one function and cannot be bypassed.** Chief of Staff:
  *"the highest hours-per-build-minute item on any chair's list."*
- **INVOKER:** The bell, the tab badge, and `setAppBadge` all already poll it.
- **Prereqs:** None. **Must ship with item 12** — see §4.
- **Build cost:** **30 min** · **Ongoing:** zero.
- **How we'd know:** Badge reads 16 on this database. It falls to 0 when he confirms 16 things —
  currently impossible at any effort.

### Item 3 — Expire the `noted` bucket
- **Band:** enabling (0 points alone). **Four chairs.**
- **What:** Add `"noted"` to **both** `updateMany` filters at `knowledge/queueSweep.ts:149` and
  `:157`. The `findMany` at `:130` already **selects** `["pending","surfaced","noted"]` — under a
  comment reading *"receipts… must still age out or they accumulate forever (468 rows had
  already)"* — and both writes filter `["pending","surfaced"]`.
- **Why:** Chief of Staff: *"The author saw the problem and shipped half the fix."* Live count
  today: **468 `noted`, oldest 2026-07-23, fifteen days past `NOTICE_EXPIRY_DAYS`, none ever
  expired.** This is a permanent floor under the badge.
- **INVOKER:** 21:15 `queue_sweep` (`index.ts:1724`), live.
- **Prereqs:** None. **Binding constraint:** must ship before any inversion of
  `schema.prisma:395`'s default — see §4.
- **Build cost:** **~20 min** (≈10 lines) · **Ongoing:** zero.
- **How we'd know:** `SELECT status, count(*) FROM "BridgeSignal" GROUP BY 1` — `noted` falls
  below 468 the first Sunday after.

### Item 4 — Add `marketing_pass` to `core/catchUp.ts`'s `JOBS`
- **Band:** enabling. **The Adversary's own addition (a) — nobody else found it.**
- **What:** `grep -c marketing_pass core/catchUp.ts` → **0**. `index.ts` registers 20 spine jobs;
  `JOBS` lists 19. Add the missing row.
- **Why:** Adversary: *"The missing one is the **only invoker of the entire business marketing
  lane** and the only producer of the 'No offer — so nothing to write toward' nudge that Revenue
  2, CoS 6c and Architect 8 all propose fixing. On a Mini asleep Sunday afternoon it is lost for a
  week, silently. **Three chairs are fixing the `kind` of a message whose producer can never fire
  and nobody checked the invoker.** That is this repo's signature defect appearing inside the fix
  for this repo's signature defect."*
- **INVOKER:** `runCatchUp()`. **Without this, item 7 fixes a signal whose producer can silently
  skip a week.**
- **Prereqs:** None.
- **Build cost:** **~10 min** · **Ongoing:** zero.
- **How we'd know:** Sleep the machine through Sunday 16:00; the pass runs on wake.

### Item 5 — Delete the 12h window from the gated-ask query
- **Band:** enabling. **Adversary add (c) — and it reverses two chairs.**
- **What:** `rituals/engine.ts:143` computes `since = now - 12h` and applies it **on top of**
  `status: { in: ["pending","surfaced"] }` (`:146`). **Delete the window from the gated-ask
  query.** Keep it on the inbox line, where "drafted overnight" is genuinely a time claim.
- **Why:** Product Skeptic (item 6) and Chief of Staff (item 2b) both proposed *widening* it to
  26h. The Adversary: *"Both wrong, in the same direction. The status filter already means 'still
  waiting on Cole.' The window's only effect is to **hide open asks for being old** — which is
  precisely the failure the counter was written to fix. At 26h, an ask Cole ignores for 27 hours
  silently vanishes from the count while still pending. The Skeptic prices this at 10 minutes and
  'one character'; **it is one character in the wrong direction.**"*
- **INVOKER:** 07:00 `morning_briefing` (`index.ts:1582`), live.
- **Prereqs:** None.
- **Build cost:** **~10 min** · **Ongoing:** zero.
- **How we'd know:** Seed a gated ask at T-40h; assert the briefing names it.

### Item 6 — Stop the receipt claiming reversibility it does not have
- **Band:** 4→5 (removes a NORTH_STAR §2.5 violation)
- **What:** `autonomy/executor.ts:91` prints *"Reversible — tell me if this was wrong"* **on the
  branch where `hasActionInverse()` returned false.** Read the inverse registry and print the
  truth: *"I cannot undo this one — tell me if it was wrong."*
- **Why:** `registerActions.ts` registers inverses at `:24`, `:47`, `:97` only —
  `calendar.schedule_protection`, `content.draft`, `knowledge.apply_proposal`. **`outreach.draft`
  and `inbox.triage_draft`, the two highest-volume grantable classes, have none**, and
  `finalizeOutreachDraft` overwrites `status`/`lastContactAt`/`nextAction`/`nextActionAt` with no
  prior-state snapshot. NORTH_STAR §2.5 says "reversible by construction"; this is the one place
  the construction is a string. **Chief of Staff's version beat two other chairs' and both
  conceded:** Systems Architect proposed registering a real inverse (1h of snapshot plumbing);
  Reliability Engineer proposed the same and withdrew it. CoS: *"Ten minutes of truth-telling
  buys the same safety as an hour of snapshot plumbing; build the inverse when the volume
  justifies it, not because a receipt says a word."*
- **INVOKER:** `executor.ts` receipt path, live on every confirm.
- **Prereqs:** None.
- **Build cost:** **10 min** · **Ongoing:** zero.
- **How we'd know:** Confirm an outreach draft; the receipt does not say "Reversible."

### Item 7 — Fix the invented signal kind `"recommendation"`
- **Band:** 4→5. **Three chairs, and it is the message that unblocks Cole's ten-minute decision.**
- **What:** `business/marketingPass.ts:49,111` writes `kind: "recommendation"` — a value absent
  from `schema.prisma:378`'s vocabulary, absent from `KIND_WEIGHT` (`core/salience.ts:29-35`, so
  it silently defaults to 0.4), and absent from `needsDecision` (`core/bridge.ts:79`, so
  `bridge.ts:88` files it `status: "noted"`). Change to `opportunity` and attach one action.
- **Why:** Consequence today: **the one line in this system that names the single blocker on the
  entire business** — *"No offer — so nothing to write toward"* — lands at a status the badge
  route doesn't count, the Decisions page doesn't show, and (before item 3) the sweep never
  expires. Salience `0.7×0.65 + 0.4×0.35 = 0.595` against a 0.72 push floor, so it doesn't reach
  his phone either.
- **INVOKER:** Sun 16:00 `marketing_pass` (`index.ts:1610`) — **which needs item 4 to survive a
  sleeping Mini.**
- **Prereqs:** Item 4.
- **Build cost:** **30 min** · **Ongoing:** zero.
- **How we'd know:** Run `runMarketingPass()` with no active offer; assert the row reads
  `status: "pending"` and `shouldPushNow({kind, severity})` is true.

### Item 8 — Fix `"serp"` → `"serpapi"`
- **Band:** enabling (it is a live defect in the function that labels Cole's marketing claims)
- **What:** `business/marketing.ts:96-98` — `marketSourceCount(rawResults: any[] | undefined)`
  filters `r.source === "web" || r.source === "serp"`. `ResearchSource`
  (`research/researchTypes.ts:3-9`) is an exhaustive union whose member is **`"serpapi"`**, and
  `researchAdapters/serpSearchAdapter.ts:32` emits `source: "serpapi"`. Fix the literal **and**
  retype the parameter as `ResearchResult[]`.
- **Why:** Systems Architect's find, confirmed committed at HEAD by the Adversary, Chief of Staff,
  Revenue Operator and Product Skeptic. `grep -rn '"serp"'` returns **one hit repo-wide — the
  filter itself.** On a SerpAPI-configured deployment the market-sources gate silently discards
  every real market source and prints "NOT RESEARCH-BACKED" over correctly-grounded research.
  **It typechecks only because the parameter is `any[]`.** SA: *"A comment three lines above it
  warns the next author to be careful. **Advice is not a seam; a type is.** This is the fourth
  instance of the identical class and the third one written inside a fix for the previous one."*
  Product Skeptic's correction, which matters: the failure is *conservative* — safer, and still
  broken, because *"a trust label that returns the same value on every input is not a label, it
  is decoration, and it trains him to stop reading it."*
- **INVOKER:** `marketing_pass`, live.
- **Prereqs:** None.
- **Build cost:** **~5 min** for the literal; the retype is the point of item 26 rule (b) ·
  **Ongoing:** zero.
- **How we'd know:** Retyped as `ResearchResult[]`, `tsc` rejects the old literal.

### Item 9 — Guard `chatCompiler`
- **Band:** enabling. **Fifth council of asking.**
- **What:** `compiled/chatCompiler.ts:31` sets `MIN_ANSWER = 60` and the file has **no
  `engineUnavailableText` import** (`grep -c` → 0, verified by three chairs). Import the guard and
  raise the floor.
- **Why:** It is invoked on **every chat turn** (`index.ts:1280-1281`). The 62-character string
  *"Anthropic engine is not configured. Missing ANTHROPIC_API_KEY."* clears the floor by two and
  lands in Layer 5.4 of every subsequent prompt as compiled understanding. A funded key narrows
  but does not close it — `llm/nonAnswer.ts:29` also matches `"Anthropic API error: …"`, and a
  verbose 429 body exceeds 60 characters. Systems Architect: *"The defect drops from daily to
  'every bad hour.'"*
  **Explicitly withdrawn:** SA's proposal to collapse the four length floors
  (`chatCompiler.ts:31`=60, `semanticReuse.ts:25`=40, `inboxTriage.ts:121`=12,
  `leadEngine.ts:164`=30) into one `isFilableAnswer`. He withdrew it himself: *"That is elegance.
  It was the composition-seam reflex I said in my own report I'd been talked out of before,
  appearing again in miniature."*
- **INVOKER:** Live on every chat turn.
- **Prereqs:** None.
- **Build cost:** **5 min** (Product Skeptic) to **45 min** (Systems Architect, with the smoke
  table) · **Ongoing:** zero.
- **How we'd know:** Smoke asserts a 429-body string is rejected.

### Item 10 — Delete the duplicate `draft_offer`
- **Band:** enabling. Revenue Operator's find, confirmed by the Product Skeptic.
- **What:** `tools/adapters/business.ts` declares `draft_offer` **twice** — `:39-43` (routes to
  the real `offers.draftOffer`) and `:83-88` (claims it *"files it as a proposal for Cole to
  confirm"*). The dispatcher at `:143` catches the first, so the second description ships in the
  model's tool catalog describing behaviour that cannot occur, and `positioning.proposeOffer`'s
  handler at `:208-219` is unreachable.
- **Why:** Revenue Operator: *"Item 0 on the ceiling list is 'Cole prices an offer,' and the most
  likely way he does it is by asking in chat. **In the one tool path that leads to a price, the
  catalog contradicts itself.**"*
- **INVOKER:** Tool catalog assembly, `llm/router.ts` layer 6.
- **Prereqs:** None.
- **Build cost:** **15 min** · **Ongoing:** zero.
- **How we'd know:** A smoke assertion that no adapter declares a duplicate action name.

### Item 11 — Wire `spendLine()` to a reader
- **Band:** enabling. **Chief of Staff's separable 10 minutes out of his P&L item.**
- **What:** `measurement/spend.ts:134` — `spendLine()`'s docstring says *"One line for the doctor,
  the briefing, and the self tool."* `grep -rn spendLine` across backend and frontend returns
  **only its own definition** (confirmed by three chairs). Wire it into the doctor and the Sunday
  scoreboard, or delete it.
- **Why:** Chief of Staff: *"At zero revenue that **is** the honest P&L — Aurelius currently
  cannot tell Cole what Aurelius costs, and that is one line away."*
- **INVOKER:** Sun 20:00 `weekly_scoreboard` (`index.ts:1707`) + `doctor.ts`.
- **Prereqs:** None (meaningful with `LLM_MONTHLY_BUDGET_USD` set).
- **Build cost:** **10 min** · **Ongoing:** zero.
- **How we'd know:** The Sunday signal names a dollar figure for Aurelius itself.

### Item 12 — Make the "no offer" risk line reachable, on both surfaces, permanently
- **Band:** 4→5. **Four chairs found it; the Revenue Operator found the half that matters.**
- **What:** Three edits in `productivity/service.ts`:
  - **(a)** Hoist `hasActiveOffer === false` **out of** the `else if (business?.empty)` branch at
    `:653` into its own top-level test. `empty` is `totalClients === 0 && openLeads === 0`
    (`crm/service.ts:553`).
  - **(b)** Rank it **above** the `staleFollowUps` branch at `:627-629`, which is a hard `return`.
  - **(c)** Delete `getBiggestRisk`'s inline `business` object at `:703-711` (six fields, missing
    `hasActiveOffer`/`draftOffers` — so the test is `undefined === false`) and call the existing
    `businessRiskInputs()` at `:566-590`, which already assembles all of them.
- **Why:** **(a) is the one that decides it, and only the Revenue Operator saw it:** *"The moment
  Cole pastes twenty warm names, `openLeads` is 20, `empty` is false, and the sentence 'you have
  no offer defined — so every message you send has nothing to sell' becomes unreachable on the
  deck AND the phone, permanently. **It is unreachable exactly when it becomes true.**"* Product
  Skeptic concedes: *"My fix would have wired the phone to a branch that had just gone dark."*
  **(b)** is the Skeptic's necessary second half: `importWarmList` sets `nextActionAt: new Date()`
  on every imported name (`crm/leadEngine.ts:89`) and `whatNeedsAttention` (`crm/service.ts:486`)
  counts them on the identical predicate, so *"the morning after Cole does the single thing every
  council told him to do, his phone's most important sentence becomes '20 lead follow-ups are
  past due' and stays there for weeks."*
- **INVOKER:** 07:00 `morning_briefing` (`index.ts:1582`) and `/api/deck`. Both live.
- **Prereqs:** None.
- **Build cost:** **45 min** · **Ongoing:** zero.
- **How we'd know:** Smoke: 20 leads with `nextActionAt = now`, zero offers; assert the risk line
  names the missing offer, not the follow-ups. **Neither branch is covered today.**

### Item 13 — Reap the `undoing` state
- **Band:** enabling (0 alone). Reliability Engineer, filed LOW and kept for a reason.
- **What:** `autonomy/executor.ts:322-327` atomically claims `acted → undoing`. The boot reaper at
  `:174-222` only reaps `"acting"`. `knowledge/queueSweep.ts:127-131` only touches
  `pending`/`surfaced`/`noted`. **A crash between `:325` and `:343` strands a signal in
  `"undoing"` with no exit path anywhere in the repo.** Extend the reaper's `where` at `:187` to
  include `"undoing"`, reverting to `"acted"` so the undo can be retried.
- **Why:** RelEng: *"It is LOW because it is rare. I include it because the undo button is the
  entire justification for the `knowledge.apply_proposal` keyhole (CLAUDE.md hard rule 1), and a
  one-tap undo that can silently strand is a safety claim with a hole in it."*
- **INVOKER:** The existing boot reaper.
- **Prereqs:** None.
- **Build cost:** **1 h** · **Ongoing:** zero.
- **How we'd know:** Smoke: insert a row at `status: "undoing"`, run the reaper, assert `"acted"`.

### Item 14 — Reconcile `docs/SCOPE.md` (rider, not a slot)
- **Band:** enabling (trust preservation)
- **What:** `docs/SCOPE.md:29-32` — *"stands in for the load of a VA ($1–2k/mo)"*, *"~5 hrs/week
  back"*, *"Break-even: 2–4 months"*, *"$20–50/mo"*. Byte-identical for seven councils. And
  `:35-39` additionally claims *"Engineering / architecture: 90 — elite"* and *"At 90 days: 85"*
  while three councils of six chairs scored it 3–5/10. Replace with the measurable number (the
  deterministic 07:00 ritual, ~1.2 hr/wk) and the sentence *the leverage arrives with clients, not
  with the key*. Note the $20–50 figure is wrong by construction (§5 above).
- **Why:** Product Skeptic: *"the month-two disillusionment is not 'it needs more work,' it's **'I
  was sold something.'** That is the specific emotion that kills personal systems."*
- **INVOKER:** **None. It is a document, and this is stated honestly.**
- **Prereqs:** Cole's sign-off on replacement numbers, or delete the section.
- **Build cost:** **10 min, attached to another commit.** The Adversary: *"Three chairs billed it
  three times at 20-40 min each [...] It is not a roadmap item and three chairs scoring it is
  three chairs finding the most greppable thing in the repo."* Revenue Operator declines it
  outright: *"no document has produced a dollar."*
- **How we'd know:** `git diff` on SCOPE.md is finally non-empty.

---

## TIER B — the seams (1–6 h each)

### Item 15 — Finish the dedup seam below the executor: one writer, one identity
- **Band:** 4→5. Systems Architect's item 1, carried by the Reliability Engineer.
- **What:** Route `autonomy/executor.ts:130`'s raw `prisma.bridgeSignal.create` through
  `surfaceSignal()` passing `status: "pending"` explicitly. Change `crm/leadEngine.ts:134`'s
  `sourceId` from `outreach:${lead.id}:${priorTouches + 1}` to a key stable within a touch round.
  Key `inboxTriage`'s per-message asks on the stable Gmail message id.
- **Why:** The 24h `(sourceType, sourceId)` dedup **did ship** at `core/bridge.ts:110-133` and is
  good code — but `executor.ts` is the highest-volume and highest-consequence writer in the system
  (05:30 triage burst, 07:30 sweep, every outward publish confirm) **and does not call
  `surfaceSignal`.** And the treadmill is worse than uncovered — it is immunised: `priorTouches`
  (`:125-126`) is itself a **count of prior Bridge signals matching that prefix**, so the counter
  increments off its own output and `sourceId` can never repeat. Systems Architect: **"Dedup is
  defeated by construction, in the identifier, one layer below where anybody is looking."**
- **INVOKER:** Already live — `index.ts:1571` (05:30), `:1596` (07:30), `content/queue.ts:160`
  (publish confirm), `index.ts:1724`. Changes the path they already take.
- **Prereqs:** None. Pure refactor. **Ship as one commit with item 3.**
  - **Adversary's scope correction, binding:** the item must name **the gate path only**.
    `executor.ts:80` — the *acted receipt* — writes `status: "acted"`, outside `surfaceSignal`'s
    dedup set and outside `needsDecision`'s derivation. *"Routing that path changes receipt
    behaviour and is unpriced."*
  - **Adversary's second correction:** *"the dedup only collapses onto a still-open row
    (`bridge.ts:120`). Architect item 1's stable `outreach:${lead.id}` therefore does **not**
    prevent a fresh card after Cole confirms — `finalizeOutreachDraft` moving `nextActionAt` +4d
    is what actually prevents it. **The two fixes are load-bearing together; either alone leaves
    a hole.**"* See item 17 and §4.
- **Build cost:** **3 h** · **Ongoing:** negative — removes ~18 duplicate cards/week before the
  first one exists.
  - **Adversary's billing correction, applies to all chairs:** *"Dedup does not save an LLM call.
    In `autonomy/executor.ts`, `prepare()` runs to completion **before** the Bridge write, and
    `crm/leadEngine.ts:130-160` puts the entire `runLLM` call inside `prepare`. **Only the
    `nextActionAt` rotation half removes tokens. The `sourceId` half removes rows.** Bill them
    separately or the ledger is wrong."*
- **How we'd know:** Smoke: call `executeAction` twice for the same `(actionClass, sourceId)`
  inside the window; assert one row. Live: `SELECT "sourceType","sourceId",count(*) FROM
  "BridgeSignal" WHERE "createdAt" > now() - interval '1 day' GROUP BY 1,2 HAVING count(*) > 1`
  returns empty. Morning three: **three drafts for three names, not nine for three.**

### Item 16 — Make failure retryable: the claim ledger, the swallowed catches, hourly catch-up
- **Band:** 4→5. **Three chairs (Architect 4, RelEng 2, CoS 5), same edits, priced 3h/4h/3h.**
  Merged; Reliability Engineer owns it.
- **What:**
  - **(a)** Delete the swallowing `try/catch` from the spine handlers (`index.ts:1557, 1571, 1582,
    1596, 1607, 1617` — all `async () => { try { await runTraced(...) } catch (err) {
    console.error(...) } }`) so `runTraced`'s rethrow reaches `withDailyClaim` and
    `finishDailyRun(name, false)` can fire (`core/schedule.ts:124` already writes it correctly).
  - **(b)** `await runTraced(...)` in the **six** handlers that are `() => {
    runTraced(...).catch(...) }` — **non-async, returning `undefined` synchronously, so
    `finishDailyRun(name, true)` fires before the job body runs.** `index.ts:1707`
    (`weekly_scoreboard`), `:1714` (`db_backup`), `:1724` (`queue_sweep`), `:1749`
    (`curriculum_ingest`), `:1758` (`decision_curriculum`), `:1773` (`initiative_pulse`) —
    verified exactly, no more and no fewer, by the Systems Architect against the Reliability
    Engineer's list.
  - **(c)** Teach `ranToday` (`core/catchUp.ts:165-175`) to ignore trace rows whose
    `context.status` is `"error"`. `markStarted` (`core/trace.ts:70-76`) writes the row **before**
    the body runs, so every job that *started* today is uncatchable today, failed or not.
  - **(d)** Run `runCatchUp()` hourly. It fires **once, 45 s after boot** (`catchUp.ts:226`).
  - **(e)** Fix `core/trace.ts:163` — `pageFailure` tells Cole *"I'll retry on schedule"* and
    nothing does.
- **Why, and the disagreement that was settled inside it:** `claimDailyRun` already contains a
  correct, deliberate, four-line-commented retry path — the `{status: "failed"}` takeover at
  `core/schedule.ts:85-96`, written explicitly because *"a single transient error… permanently
  consumed the day."* **That branch is unreachable at HEAD**, because nothing ever writes
  `"failed"`. CLAUDE.md hard rule 8's signature defect **is sitting inside the retry mechanism.**
  The Product Skeptic attacked this as low-frequency (*"`JobRun` shows 43 done and 1 failed; a
  chair ranking it top-three is ranking the failure mode with the best story"*) — **and then
  withdrew the argument entirely**: *"The number I used to price frequency is a number that
  cannot move. `SpineHealth.tsx` renders a grid that is green by construction — a health
  instrument that has never been able to show a bad day is the purest form of the thing I claim
  kills systems."* RelEng's honest restatement: *"the failure rate is **unmeasured, not low.**"*
  Chief of Staff holds it at #2 on his list: *"the 07:00/21:30 ritual is the only return on my
  ledger that any chair has scored as real, and it is the one thing in the system with no
  retry."*
- **INVOKER:** Existing `scheduleNamed` registrations; existing `withDailyClaim`; one `setInterval`
  inside `startCatchUp`. **No new invoker — this is a deletion.**
- **Prereqs:** **Items 1, 2, 12, 15 first.** Watch item, stated by three chairs: with the swallow
  removed a genuinely broken job now pages — *"That is the point, but it means dedup should land
  first or Cole gets a retry siren instead of a calendar siren."* Plus one line in
  `DEPLOY_MAC_MINI.md` naming `caffeinate -dimsu`: code cannot wake a sleeping Mini.
  - **RelEng's withdrawal, on the record:** his (c) is **re-filed as a disagreement, not a bug
    report.** `core/catchUp.ts:164` carries a deliberate docstring — *"fired = counted, even if it
    errored — never re-fire a crash loop."* The author knew and chose. RelEng's position: the
    crash-loop fear is already handled by the day-key bound on `claimDailyRun`, so two guards
    cover one hazard and the redundant one costs the whole day. *"I still want the change; I no
    longer claim it is obvious."*
- **Build cost:** **3 h** (Architect, CoS) / **4 h** (RelEng original) / **6 h** in RelEng's
  revised merge including engine retry (item 19) · **Ongoing:** slightly more push volume on bad
  days, which is the correct direction.
- **How we'd know:** Smoke: force a handler to throw; assert `JobRun.status === 'failed'`; run
  catch-up; assert reclaim and completion. Live: kill Postgres at 06:59 — the 07:00 briefing fails
  and **arrives at 08:05 instead of never.** RelEng: *"A seven-day spine grid that has never shown
  red is not evidence of health — it is evidence the cell cannot turn red."*

### Item 17 — Bounded rotation of the outreach sweep
- **Band:** 4→5. Revenue Operator + Chief of Staff, **with the Revenue Operator's own
  self-correction, which is the load-bearing part.**
- **What:** In `crm/leadEngine.ts`:
  - Advance `nextActionAt` by a day after a successful `draftOutreach` — today only
    `finalizeOutreachDraft:225-233` writes it, and only on Cole's confirm, so on any day he
    doesn't confirm the same three names are re-drafted.
  - **With two ceilings:** skip any lead that already has an open unconfirmed draft, **and skip
    the run entirely above ~6 open unconfirmed outreach drafts.**
  - Compute `priorTouches` (`:124-128`) from `lead.lastContactAt` — a real send — not from a count
    of prior Bridge signals, so `isFollowUp` stops making the prompt at `:157` say *"This is a
    FOLLOW-UP. Acknowledge that lightly, add one new thing, do not repeat the first pitch"* about
    a pitch that was never sent. **CoS's correction to his own citation:** `:128` is `priorTouches
    > 0 || !!lead.lastContactAt`, so the fix narrows the disjunct rather than replacing it.
- **Why:** The unbounded version was **wrong as written and the Revenue Operator killed it
  himself:** *"Rotating `nextActionAt` on draft means Cole gets 3 new names a day whether or not
  he confirmed yesterday's. Grinding three names was bad; unbounded rotation through twenty is
  worse, because it converts a duplicate problem into a growth problem. **My own 'how we'd know' —
  9 drafts for 9 people at +72h — is precisely the failure mode if he confirmed none of them.**"*
  The warm list is non-renewable and twenty names is the entire channel; grinding three while
  seventeen starve burns the only inventory he has.
- **INVOKER:** 07:30 `outreach_sweep` (`index.ts:1596`), live.
- **Prereqs:** **Item 18's reply detection must land first** — see §4.
- **Build cost:** **1–1.5 h** · **Ongoing:** negative — removes ~18 Sonnet calls and ~18 cards a
  week. **This is the half that actually removes tokens** (Adversary's billing correction, item
  15).
- **How we'd know:** Smoke: 6 due leads, run the sweep twice without confirming, assert the second
  run draws 3 *different* names and no body says "FOLLOW-UP" on a lead whose `lastContactAt` is
  null.

### Item 18 — Lead-aware inbox triage, both directions
- **Band:** 5→6. **Three chairs (Architect 9, Revenue 4, CoS 3), priced 4h/3.5h/4h.** Revenue
  Operator's THE ONE THING. **The Adversary's chosen gate to 6:** *"the only proposed mechanism on
  any list that produces an observable Cole did not type."*
- **What:** In `autonomy/workflows/inboxTriage.ts` — which contains **zero occurrences of
  "lead"**, verified case-insensitively by three chairs — before the `needsReply` filter at
  `:27-31`, resolve each sender against `prisma.lead.findFirst({ where: { email } })`. On a match:
  - **(a)** write `status: "conversing"`, set `lastReplyAt`, **clear `nextActionAt`** — this is
    what stops `runOutreachSweep` (`:264-271`, selecting on `nextActionAt <= now`) drafting a
    stale first-touch to someone mid-conversation;
  - **(b)** inject `businessContextBlock()` + `offerContextBlock()` + `lead.notes` into that
    draft's prompt — today it knows neither who she is nor what he sells;
  - **(c)** `surfaceSignal({ kind: "opportunity", severity: "critical" })` so it pushes
    immediately and bypasses quiet hours — the same treatment `captureInboundLead` already
    correctly gives a form fill at `leadEngine.ts:402-416`;
  - **(d) the send half — Chief of Staff's, and the Revenue Operator conceded it beat his own
    coverage:** at the top of `runOutreachSweep`, for each lead with `lastContactAt` set, call the
    **existing** `listInbox({ query: 'in:sent to:<email> newer_than:14d' })`
    (`gmail/engine.ts:64-89` already accepts an arbitrary Gmail query — **no new scope, no new
    function**) and on a hit call `recordOutcome({ angleId, used: 1 })` automatically. Mark a lead
    `contacted` only once something actually went out — today `finalizeOutreachDraft:227` writes
    `contacted` when a *draft* is written and Cole may never send it.
  - **(e)** on `Payment` create, increment the attributed angle's `conversions` (Architect 9c).
- **Why:** Revenue Operator: *"Sarah replies 'yeah, tell me more.' **The most valuable event that
  can occur in Cole's business arrives as an anonymous inbox item**, gets a generic 05:30 draft
  with no CRM context, no `offerContextBlock`, and no idea who she is. Her Lead row still reads
  `contacted`. Four days later `runOutreachSweep` picks her up and drafts her a message whose
  prompt says 'do not repeat the first pitch' — to a woman who wrote back and got a form letter.
  **The warm list is non-renewable, and this defect fires hardest on the people who said yes.**"*
  `Lead.status` has exactly two writers repo-wide (`leadEngine.ts:226-234` → `contacted`,
  `crm/service.ts:175` → `won`); the statuses `conversing`, `proposed`, `lost`, `dormant` are
  declared at `schema.prisma:749` and written by **nobody.** This is also what makes Cole's §3.2
  *"learn which actions convert best over time"* literally true instead of hand-recorded, and the
  prerequisite that makes `groundingFromResearch`'s `"internal"` label legitimately reachable.
- **INVOKER:** Existing 05:30 `inbox_triage` (`index.ts:1571`) and 07:30 `outreach_sweep`
  (`:1596`). **No new invoker. That is the point.**
- **Prereqs:** Gmail connected; at least one lead with a real email — **Cole-gated, which is why
  the band is 5→6 and not 4→5.** No new schema (`conversing` is already in the enum comment). **In-app
  half depends on item 1** — Revenue Operator's concession: *"I proposed a signal into a surface I
  never checked could display it."*
- **Build cost:** **3.5–5 h** · **Ongoing:** **negative** — removes the hand-recording tax on
  `recordOutcome` permanently and removes wrong-context drafts; adds one push per real reply,
  which is the push he most wants.
- **How we'd know:** Smoke: create a Lead with email X, feed triage a message from X, assert
  `lead.status === "conversing"`, `nextActionAt === null`, and a `critical` signal exists. Live:
  the first warm reply buzzes his phone within the hour and `anglePerformance().totalUses` moves
  **without anyone touching a keyboard.**

### Item 19 — Retry and backoff in the engine adapters
- **Band:** 4→5. Reliability Engineer 3, folded into his revised item 1.
- **What:** A shared `withRetry` in `engines/engineAdapter.ts` (which already owns
  `REQUEST_TIMEOUT_MS`), wrapping the fetch in `engines/anthropicEngine.ts:82` and the other five
  adapters: three attempts, exponential backoff with jitter, retry only on 429/500/502/503/529 and
  `AbortError`, honour `Retry-After`, **never** retry 400/401/403.
- **Why:** `grep -rn "429|529|retry|backoff|Retry-After" engines/ llm/` returns **exactly one hit
  at HEAD, and it is a comment** (`llm/nonAnswer.ts:16`). Timeouts exist per request; retries do
  not. Funded, the sources are plural and daily — Anthropic 529s, Gemini free-tier 429s on a key
  doing both embeddings and web grounding, Gmail quota. **Each currently costs the whole day's
  job.** Complementary to item 16, not a substitute: *"a 529 mid-curriculum needs the call retry;
  a dead Google token needs the job retry."*
- **INVOKER:** Every LLM call routes through these adapters via `llm/router.ts`.
- **Prereqs:** Item 16 same-PR or immediately before.
- **Build cost:** **3 h** · **Ongoing:** **tokens** — a retried call is a paid call. Bound at 3
  attempts and log retry counts to the spend ledger so this is a number, not a surprise.
- **How we'd know:** A trace field `retries` on LLM dispatch rows. *"If it is always 0 after a
  month, the retries were unnecessary and we can say so. If it is nonzero, each one is a day that
  used to be lost."*

### Item 20 — Rank, collapse and split the deck
- **Band:** 4→5. Product Skeptic's item 1, **ranked #1 by three of five chairs in revision.**
- **What:** `getDeck` (`productivity/service.ts:495-499`) is `orderBy: [{ createdAt: "desc" }],
  take: 12` — **no severity term at all.** That array is both the Home "Needs you" strip
  (`home/page.tsx:227,347` → `bridge.slice(0,3)`) **and the entire Decisions page**
  (`SignalsBench.tsx:71`). Replace with:
  - order by `[has confirm_action] DESC, scoreSalience(...) DESC, createdAt DESC`, reusing the
    weights already at `core/salience.ts:22-35`;
  - group identical `title` and return `{ ...signal, duplicates: n }`;
  - `take: 40` plus paging;
  - return **two arrays** — `decisions` (rows carrying `confirm_action`) and `receipts` — with
    Home rendering `decisions` and `SignalsBench` getting a receipts tab collapsed by default.
- **Why:** *"The tab badge says 103. He taps it. The only surface that exists shows 12 rows,
  newest-first. The 3 rows on his home screen are, right now, three copies of 'Weekly scoreboard —
  0 done, follow-through 0%.' **91 pending rows are invisible on every surface in the product.**
  There is no page that lists them, no way to clear them, no way to see what he's missing. 86 of
  the 102 have no button. They are receipts wearing a decision's badge."* Chief of Staff, ranking
  another chair's item first: *"On hours net of review this dominates my treadmill item, because
  the treadmill costs ~18 duplicate cards a week **that do not exist yet** (Lead = 0), whereas the
  sort defect costs 100% of the review surface **today.**"*
- **INVOKER:** `/api/deck`, already mounted, already consumed by the two most-visited screens.
- **Prereqs:** **Item 2 in the same commit** (see §4). **Must land before item 16.**
- **Build cost:** **3–4 h (Product Skeptic) vs 8–10 h (Adversary).** The Adversary's correction,
  preserved in full because it is a real cost dispute:
  > *"It is two items welded together. The severity string-sort fix is ~20 minutes [item 1]. The
  > rest is not: (a) `scoreSalience` scores on `kind × severity` **only** — every one of the 49
  > pending `notice` + `background_result` rows ties at exactly 0.40, so sorting by it barely
  > discriminates and the duplicate-collapse is doing all the work; (b) in-code salience sort means
  > fetching *all* pending rows, deleting the `take` optimisation; (c) splitting `bridge` into
  > `decisions`/`receipts` **changes the `/api/deck` response shape**, breaking
  > `home/page.tsx:227,347` and `SignalsBench.tsx:71` — frontend work he prices at zero. **Split
  > it: ship the 20-minute sort fix immediately, schedule the deck refactor separately.**"*

  That split is why item 1 and item 20 are separate entries in this list.
  **Ongoing:** zero — it *reduces* review burden ~85% on day one.
- **How we'd know:** `SELECT count(*) FROM "BridgeSignal" WHERE status='pending' AND actions::text
  LIKE '%confirm_action%'` equals the number on Cole's home screen. And the observable that
  actually matters: **`acted + dismissed` per week stops being 0.**

### Item 21 — Complete `ACTION_CLASSES`; make tier the only tier authority
- **Band:** 4→5. Systems Architect 3, held through revision.
- **What:**
  - Declare `pattern.confirm`, `pattern.retire`, `autonomy.apply_grant` in `ACTION_CLASSES`
    (`actionClasses.ts:39-140`). They are **registered finalizers** (`registerActions.ts:59,62,66`)
    with no declared class, working only because unknown → gate.
  - **Fix the asymmetry.** Inside `executor.ts` an undeclared class means two opposite things: at
    `:127`, `getActionClass(...)?.tier` is `undefined` so severity falls to `"attention"`
    (**inward**); at `:204`, `?? (confirm ? "outward" : "inward")` treats it as **outward.** Make
    `executeAction` **throw** on an unregistered class.
  - Delete `systems.sop_draft` (`actionClasses.ts:74`) — **one grep hit repo-wide, zero
    `executeAction` sites, still rendered on the Autonomy dial. Fifth council of asking.**
- **Why:** Consequence today: **`autonomy.apply_grant` — the ask that literally changes Cole's
  autonomy posture — files at `0.7×0.65 + 0.4×0.35 = 0.595` against a 0.72 push floor and cannot
  reach his phone.** Systems Architect: *"The tier-derived-severity fix (`609cd56`) is exactly as
  good as `ACTION_CLASSES` is complete, and it is not complete."* Product Skeptic on the dead
  class: *"The first grant a user flips that silently no-ops is the last grant they flip, on the
  surface where trust **is** the product."*
- **INVOKER:** Every `executeAction` path (16 sites); the Autonomy dial reads
  `listAllActionClasses()`.
- **Prereqs:** Item 26's rules keep it closed. Build together.
- **Build cost:** **2–2.5 h** · **Ongoing:** zero.
- **How we'd know:** A grant confirm pushes to Telegram; `executeAction({actionClass:
  "nonsense.thing"})` throws instead of filing a card; `grep -rn sop_draft aurelius frontend`
  returns nothing.

### Item 22 — Fix the reuse cache key, and take `quick_reply` out of it
- **Band:** 4→5. **Systems Architect 6 + Chief of Staff 8 are the same item.** *"Four chairs, none
  of whom could execute it cold."*
- **What:** `compiled/semanticReuse.ts:130` keys reuse on `args.input` **alone**, at 0.93
  similarity, for 14 days. Layer 2.4 NOW (clock, calendar, load, grants) shapes the answer and is
  not in the key. Two edits: **(a)** hash a coarse state bucket — date, primary operator, whether
  the prompt carried NOW — into the embedded key text; **(b)** remove `"quick_reply"` from
  `REUSABLE_TASK_TYPES` (`:29`), or make `autonomy/workflows/inboxTriage.ts:106` pass `noReuse:
  true`.
- **Why:** The round's sharpest new defect: **a cached reply drafted for one person, served as the
  draft to another, under `engine: "compiled"` with `tokensUsed: 0`.** `engineUnavailableText`
  cannot catch it — *"the text is a perfectly good draft, for the wrong human being."* Every
  triage draft runs under `operator: "strategy"`, so all of Cole's inbox shares one bucket at 0.93
  similarity over a fixed ~130-char prefix. Systems Architect: **"The tell is in the repo itself:
  the author of `draftOutreach` set `noReuse` on the newer, lower-volume lane
  (`leadEngine.ts:139`) and not on the older, higher-volume one."** Chief of Staff: *"This is the
  single defect class where **a funded key makes things worse than a cold repo**, and it is the
  mechanism by which Cole's own §2.3 metric would report a wrong answer served to the wrong person
  as improvement."*
- **INVOKER:** `llm/runLLM.ts:23-42`, already on every call.
- **Prereqs:** **Real embeddings activate this defect** (`EMBEDDINGS_PROVIDER=mock` makes it
  inert). **Fix before Cole buys his second key, not after.**
- **Build cost:** **1.5 h** · **Ongoing:** slightly higher token spend, honestly earned — *"the
  hits it removes were wrong."*
- **How we'd know:** `grep 'compiled reuse'` in the logs never fires on a triage run or on a
  today/this-week-shaped question. Ask "what should I focus on today?" on two different days and
  get two different answers.

### Item 23 — Derive `catchUp`'s `hour`/`expiresHour` from the registered cron string
- **Band:** enabling. **Adversary add (b) — nobody else touched this file.**
- **What:** `core/catchUp.ts:61-65` hardcodes `{name:"outreach_sweep", hour: 7, expiresHour: 18}`
  as a literal that must be kept in sync with `index.ts:1596` **by hand.**
- **Why:** Adversary: *"Move the cron to `'15 6 * * *'` without editing `catchUp.ts` and catch-up
  believes the job is due at 07:00 — so between 06:15 and 07:00 a missed run is invisible. [Revenue
  Operator] names two collision prerequisites and misses the one in the file."* Without this, any
  future cron change breaks catch-up for that job silently.
- **INVOKER:** `runCatchUp()`.
- **Prereqs:** None.
- **Build cost:** **45 min** · **Ongoing:** zero — it removes a hand-maintenance obligation.
- **How we'd know:** Change a cron string; the catch-up window follows without a second edit.

### Item 24 — Revenue on the Sunday scoreboard
- **Band:** 5→6. **Three chairs (Architect 13, Revenue 8, CoS 7), third council of asking.**
- **What:** `grep -n "revenue|invoice|payment|lead|client" measurement/scoreboard.ts` returns
  **nothing across all 182 lines.** Add five leading indicators to `computeWeeklySnapshot`
  (`:26-67`): leads added, leads contacted, leads reaching `conversing`, invoiced cents, received
  cents. `pipelineSnapshot()` (`crm/service.ts:528-579`) **already computes** `mrrCents`,
  `receivedThisMonthCents`, `receivedAllTimeCents` and `outstandingCents` — the scoreboard simply
  never calls it.
- **Why:** Revenue Operator: *"This is the finding that gets worse purely with time: **inert at
  zero leads, actively misleading at twenty**, because it reports the brain's activity as the
  week's result."* Cole's §7 is *"how Aurelius actually puts more money in your pocket"*; a weekly
  report that cannot name a dollar cannot answer it. Chief of Staff: **at zero it should say *"$0
  invoiced, $0 received, 0 leads worked"* — confronting, not silent. Silence here is how an empty
  pipeline persists.**
- **INVOKER:** Sun 20:00 `weekly_scoreboard` (`index.ts:1707`), live. Rendered by the existing
  `ScoreboardPanel`.
- **Prereqs:** Item 18 for the `conversing` count. Nothing else to build; meaningful once leads
  exist.
- **Build cost:** **2 h** (Revenue) / **3 h** (CoS) · **Ongoing:** zero tokens, ~30 s/week reading.
- **How we'd know:** `MeasurementSnapshot.metrics` carries the five fields and the Sunday Bridge
  body names them **ahead of** corpus docs.

### Item 25 — The Prisma client extension on `bridgeSignal.create`
- **Band:** enabling. Product Skeptic 3 — **demoted by its own author, endorsed by the Systems
  Architect and Chief of Staff as the version that survives the next author.** Preserve the
  disagreement.
- **What:** A Prisma client extension in `core/db/prisma.ts` applying the existing 24h
  `(sourceType, sourceId)` collapse from `core/bridge.ts:110-133` and defaulting `status` from
  `needsDecision`. Callers passing no `sourceId` get no dedup — the same rule `bridge.ts:110`
  already uses, so it is strictly additive.
- **Why:** **19 raw `prisma.bridgeSignal.create` sites outside `core/bridge.ts`** (corrected count,
  agreed by the Systems Architect and the Product Skeptic against his own original "17 of 21"):
  `corpus/ingest.ts:107`, `wealth/engine.ts:103`, `autonomy/initiative.ts:137`,
  `autonomy/capabilityGaps.ts:97`, `autonomy/executor.ts:80,130`, `autonomy/pulse.ts:139,210`,
  `planning/tools.ts:174,389,517`, `wiki/engine.ts:197`, `router/calendarRouter.ts:81`,
  `rituals/engine.ts:90`, `missions/engine.ts:245,285`, `knowledge/freshness.ts:116`,
  `knowledge/queueSweep.ts:185`, `measurement/scoreboard.ts:149`. **A writer cannot escape a client
  extension.** Three councils of "route the raw creates" produced advice in a schema comment
  (`schema.prisma:391-394`).
  **The Systems Architect's new evidence, which nobody had:** the worst cluster in the live badge
  is not spread across weeks — it is **one `sourceId`**: `sourceType='ritual'`,
  `sourceId='cmse2bgj80016gzaeiqty9ty5'`, **22 rows on 2026-08-06 and 8 on 2026-08-07, 30 of the
  102 pending.** Written by `rituals/engine.ts:90`, a raw create. *"The dedup guard shipped in
  `f77eb2a` would collapse all thirty — and does not."*
  **The disagreement, live:**
  - **Chief of Staff, endorsing:** *"It beats both my item 11 and the Systems Architect's item 2,
    and it beats them using my own argument. I refused the exclusivity lint because it is
    capability with a review tax. **The client extension has zero ongoing review cost.** That is
    the distinction I was reaching for and he drew it cleanly."*
  - **Product Skeptic, demoting his own item:** *"My own item 20 collapses duplicates at read
    time, which means the bypassers stop being a product problem the day it ships and become a
    table-growth problem. It is still the only version a writer can't escape, but it is hygiene,
    and the Systems Architect's narrower fix [item 15] covers the highest-volume writers for a
    third of the cost. **Take his; keep mine on the shelf for the tail.**"*
  - **Adversary:** *"Build one of {item 15, item 25} — not both. Building both is paying twice for
    one guarantee."*
- **INVOKER:** The Prisma client itself — every call site, unconditionally.
- **Prereqs:** None.
- **Build cost:** **3 h** · **Ongoing:** low; one place to reason about.
- **How we'd know:** Run the smoke suite twice; `SELECT title, count(*) FROM "BridgeSignal" WHERE
  status='pending' GROUP BY 1` shows no title above 1 per day. Today it shows 22 for one sourceId.

### Item 26 — Extend `reachabilityAudit.ts` — and the scope fight over it
- **Band:** enabling (0 points alone — say so out loud). **Four chairs proposed it at 1h / 3h / 4h
  / 5h for overlapping scope.** The Adversary: *"A 5× spread on the same item is a tell that
  nobody has scoped it."*
- **What — build the Chief of Staff's two narrow rules, plus the Systems Architect's rule (b):**
  - **(1)** Every grantable `ACTION_CLASS` has ≥1 `executeAction` call site. *(~20 lines. Catches
    `systems.sop_draft`, which has survived five councils.)*
  - **(2)** Every registered finalizer maps to a declared class. *(Catches `pattern.confirm`,
    `pattern.retire`, `autonomy.apply_grant` — item 21.)*
  - **(3)** Declared-vocabulary literals: every string assigned to or compared against a field
    with a declared union must be a member of it — `KIND_WEIGHT` (`core/salience.ts:29-35`),
    `schema.prisma:378`'s kind comment, `needsDecision`, `ResearchSource`, `CompiledPattern.status`.
    *(Catches item 7's `"recommendation"`.)*
  - **(4) — Systems Architect's rule (b), the one he says pays for the whole item:** no `any` /
    `any[]` at a declared-vocabulary boundary. *(Catches item 8's `"serp"` before the file is
    saved. The Product Skeptic conceded this: "his catches a class my rules never would.")*
  - Run it in the smoke suite as a **failure**, not a print.
- **Why:** It printed *"Reachability audit: clean — every capability has a live invoker"* over: a
  `/business` page absent from every mobile surface, `hostBytes`/`hostLocalFile` with zero
  production callers, `systems.sop_draft`, a `noted` status with no reader, `spendLine()` with zero
  readers, 468 immortal rows, and a briefing counter whose window cannot see the job it was written
  for. **0-for-4, 0-for-5, 0-for-4, 0-for-7 across four councils.** Product Skeptic: *"the clean
  output now **functions as cover.**"* Revenue Operator: *"the only proposal across three councils
  that would have caught a defect without a chair reading the file."*
- **The scope disagreement, preserved:**
  - **Chief of Staff, refusing the wide version:** *"His full proposal — 'a `prisma.<model>.create`
    outside a module with a documented authority function is a finding' — is a three-hour build
    that will produce twenty findings, a suppression list, and a weekly triage habit. On my lens
    that is **capability with a review tax**, and this repo's history says the suppression list
    wins."*
  - **Systems Architect, conceding two of five rules and holding two:** *"Rule 1 (authority
    exclusivity by grep) is now better served by the Prisma extension — a grep rule that finds 19
    sites produces a suppression list; an extension makes the 19 sites correct. Rule 3 is the
    Chief of Staff's narrow version and I concede his framing."*
  - **Adversary:** *"The Chief of Staff's version is the only one whose cost I believe. **Build
    his.** The other three are the same item with more surface area."*
  - **Adversary on the Systems Architect's cost:** *"Claimed 5h, real 12-15h. Rule 5 alone is a
    repo-wide type-tightening project, not a lint rule. `business/marketing.ts` has three `as
    any[]` casts at `:96,303,369`; `core/bridge.ts:79` types `actions?: any`; the pattern is
    everywhere."* **Scope rule (4) to the specific boundaries named, not repo-wide, or accept the
    12-15h number.**
- **INVOKER:** `scripts/smokeSuite.ts` already calls `auditReachability()`.
- **Prereqs:** Items 8, 21 first, or the suite goes red on day one on things already agreed.
- **Build cost:** **1 h** (CoS's two rules) **+ ~2 h** (SA's rules 3-4 scoped) · **Ongoing:** ~10
  min/PR. Systems Architect: *"the only ongoing cost on my list I'd defend as worth paying
  forever."* Chief of Staff: *"zero if the rules are narrow; **unbounded if they are not. That
  distinction is the whole item.**"*
- **How we'd know:** **It fails today**, on at least three findings, before any are fixed. Revenue
  Operator: *"If it passes on first run, the rules were written to the code instead of to the
  standard."*

### Item 27 — Make the smoke suite actually self-cleaning
- **Band:** enabling. Product Skeptic 7(b) — **his own, and it indicts the verification apparatus.**
- **What:** CLAUDE.md rule 7 calls the smoke suite "self-cleaning." It is not: **12 pending
  `BridgeSignal` rows per run** (2 `content_publish_request`, 6 `ritual`, 2 `wiki`, 2 `mission`),
  4 orphaned `smoke`-scope `KnowledgeEntry` rows, and `smokeSuite.ts:1163` **deletes every
  `business`-scope KnowledgeEntry** — which is why this database currently holds **zero business
  facts.** Tag every smoke-written row and delete by tag in teardown.
- **Why:** *"The verification apparatus is itself one of the top three pumps into the badge it is
  supposed to be verifying. That is the 'shipping outran verification' finding with a mechanism
  attached."*
- **INVOKER:** The suite's own teardown.
- **Prereqs:** None.
- **Build cost:** **2 h** · **Ongoing:** zero.
- **How we'd know:** Run the suite twice; `BridgeSignal` pending count is unchanged and
  `business`-scope `KnowledgeEntry` count is unchanged. **Today both move.**

### Item 28 — Make the verification adversarial where Cole actually lives
- **Band:** enabling. Systems Architect 8.
- **What:** Three smoke additions, all against branches nobody has ever executed:
  - **The funded-key, no-web-search branch.** `smokeSuite.ts:1417-1427` tests
    `groundingFromResearch` in isolation, five ways, all correct — and **never composes it with
    `runResearch`.** Stub `runResearch` returning `{grounding: "external", rawResults:
    [{source:"pubmed", url:"…"}]}` and assert the printed label is **not** "research-backed."
    *"That single assertion would have caught the `"serp"` typo and the academic-noise mislabel."*
  - **Push reachability, per class.** Loop `ACTION_CLASSES`; for every `outward` class build the
    signal `executeAction` would file and assert `shouldPushNow(...) === true`; for every `inward`
    one assert it's counted by the briefing. *"This is what would have caught the muted bridge
    without a chair doing arithmetic by hand."*
  - **Vocabulary round-trip.** Assert `KIND_WEIGHT`'s keys, `schema.prisma`'s kind comment, and
    `needsDecision`'s list are the same set.
- **Why:** *"The council graded refusal branches and called them behaviour"* (FUNDED §4.1). **413 →
  430 → 455 → 471 → 488 green assertions rising monotonically through every commit that shipped
  these defects is not convergence.**
- **INVOKER:** `npx tsx scripts/smokeSuite.ts`, already the verify gate.
- **Prereqs:** None.
- **Build cost:** **2 h** · **Ongoing:** zero.
- **How we'd know:** **The suite goes red on today's `marketing.ts`. If it goes green, the
  assertions are wrong.**

### Item 29 — Prove the backup exists somewhere other than the machine it protects
- **Band:** 5→6. Reliability Engineer 5 (his #3), Systems Architect 14.
- **What:**
  - **(a)** Before dumping, verify `AURELIUS_BACKUP_DIR` is a **live mount** — check for a marker
    file written once on the NAS, not merely that the path exists.
  - **(b)** Make `runDbBackup` **throw** rather than `return {ok:false}` at `core/backup.ts:96` —
    which today lets `runTraced` write `status: "ok"` so `pageFailure` never fires.
  - **(c)** Verify the artifact: `pg_restore --list` and assert a table count above a floor.
    `bytes < 1024` (`:48`) cannot distinguish a valid dump from a truncated one.
  - **(d)** Monthly **restore drill**: first Sunday, `pg_restore` into a scratch database, count
    rows in three tables, drop it, file one receipt.
  - **(e)** Same marker check on `VAULT_DIR` (`wiki/vaultMirror.ts:16`), which defaults to
    `cwd/vault` and will otherwise mirror the brain to ephemeral container disk.
  - **(f) In the same commit:** `db_backup` (`index.ts:1714`) is one of the six non-`await`
    handlers — fix it here or the drill reports success at claim time.
- **Why:** `core/backup.ts:40`'s `mkdirSync(BACKUP_DIR, {recursive:true})` **silently recreates
  `/Volumes/aurelius-backups` as a local directory on the internal SSD when the NAS is
  unmounted.** pg_dump succeeds, the size check passes, `warnIfBackupStale` sees a fresh dump, and
  **every instrument is green while the only copy of the second brain lives on the machine whose
  failure the backup exists for.** RelEng, on why it survives at #3 despite being rare: *"it is the
  only item on my list whose failure mode is unrecoverable rather than annoying. **A backup nobody
  has ever restored is a hypothesis** [...] there is no recovering trust from *the backups were
  never real*."*
- **INVOKER:** (a)(b)(c) ride `scheduleNamed("db_backup", "0 2 * * *", …)` (`index.ts:1714`). (d)
  needs `scheduleNamed("backup_drill", …)` **plus a `core/catchUp.ts` JOBS entry** — *"without it
  the drill silently never recovers from a sleeping process, which is exactly the defect the three
  Sunday learners have."*
- **Prereqs:** NAS mounted; `pg_restore` on PATH; a scratch DB name in env. **The NAS not being
  there yet is precisely the case (a) covers.**
- **Build cost:** **2.5 h** (Architect) / **4 h** (RelEng, with the drill) · **Ongoing:** ~2
  min/month, one `noted` receipt.
- **How we'd know:** **Unmount the share and run the backup by hand. It must fail loudly, not
  succeed.** First Sunday of the month, a receipt reads *"restored 1.2M rows across 34 tables from
  a 240MB dump."*

### Item 30 — One line in the briefing: what didn't run last night
- **Band:** 5→6. Reliability Engineer 4.
- **What:** Alongside the gated-ask counter at `rituals/engine.ts:165-176`, query `JobRun` for the
  last 24h (7 days for Sunday jobs); if any row is `"failed"` **or** any `ONCE_PER_DAY` job that
  was due has **no row at all**, name them. Silent when everything ran.
- **Why:** *"There is no channel that tells Cole the spine is degrading."* `pageFailure` fires
  per-job at the moment of failure, deduped 6h **in-memory** so a restart resets it — it cannot say
  "this has failed six mornings running," and it cannot say a job silently never fired. The one
  instrument that could (`SpineHealth.tsx`) is what item 16 fixes.
- **INVOKER:** `generateMorningBriefing`, fired by `index.ts:1582` and by `/brief` in
  `telegram/bot.ts`.
- **Prereqs:** **Item 16 must land first.** RelEng names this himself: *"Without it this line reads
  `JobRun` rows that are all `done` and reports nothing, forever. **Building this alone is the
  signature defect.**"* And **item 20** — Chief of Staff: *"A briefing that names a failure sends
  Cole to a surface. If the surface is 12 newest-first receipts, the naming returns zero hours."*
- **Build cost:** **2 h** · **Ongoing:** zero new review burden — one conditional line in a message
  he already reads.
- **How we'd know:** Kill the backend Tuesday 06:55. Wednesday's briefing names `morning_briefing`
  as missed. **If it doesn't, item 16 didn't land.**

### Item 31 — Make the Mini survive a reboot without Cole in the room
- **Band:** enabling (0 points alone — **but items 1–30 are worth nothing if the process isn't
  running**). Reliability Engineer 7.
- **What:** Rewrite `docs/DEPLOY_MAC_MINI.md` PART 5 (`:251-285`):
  - **(a)** It installs `~/Library/LaunchAgents/com.aurelius.backend.plist` — a **per-user
    LaunchAgent requiring a logged-in GUI session.** The doc says "start up automatically after a
    power failure" (`:95`) and says nothing about FileVault or auto-login; **macOS Setup Assistant
    enables FileVault by default.** After any power blip or macOS update reboot the Mini sits at
    the unlock screen and Aurelius is dark. Either disable FileVault + enable auto-login, or move
    to a `LaunchDaemon` in `/Library/LaunchDaemons` — **and say which, and why.**
  - **(b)** `StandardOutPath`/`StandardErrorPath` point at `/Volumes/aurelius-backups/logs/` — the
    logs live on the NAS, whose mounts are Login Items (`:121`), also GUI-dependent. **When the NAS
    is down the process's only diagnostic output goes nowhere.** Log locally; sync to the NAS.
  - **(c)** `caffeinate -dimsu` in the plist arguments. The GUI Energy toggle at `:93-95` does not
    cover every sleep path and is silently reset by some macOS updates.
  - **(d)** Boot preflight: if `AURELIUS_BACKUP_DIR`/`VAULT_DIR`/`INGEST_WATCH_DIR` are `/Volumes/…`
    paths and the volume is not mounted, `core/preflight.ts` prints a `fail` line, not silence.
- **Why:** *"§1 of Cole's vision is 'Mac mini → always-on compute node.' Everything else in this
  document is downstream of that sentence being true. **Right now the single most likely cause of a
  week of silence is a reboot Cole didn't notice.**"*
- **INVOKER:** `core/preflight.ts` for (d), already runs at boot. (a)-(c) are runbook + plist,
  invoked by launchd.
- **Prereqs:** **Cole's decision on FileVault vs LaunchDaemon** — *"a security tradeoff on a box in
  his home, and it is his call, not mine."* Physical access.
- **Build cost:** **3 h** of writing + testing, **plus ~30 min of Cole's hands** · **Ongoing:**
  zero.
- **How we'd know:** **Cut the power.** The system is back and the 07:00 briefing arrives the next
  morning with nobody having touched a keyboard. *"Until that test has been run, 'always-on' is an
  assumption."*

### Item 32 — A repair sweep for the vector index
- **Band:** 5→6. Reliability Engineer 6.
- **What:** `retrieval/embedPipeline.ts:84-91` — `embedSourceSafe` catches, `console.warn`s, and
  returns. Its own docstring at `:9` says *"Backfill sweeps up anything missed."* **Nothing
  sweeps.** `scripts/backfillEmbeddings.ts` exists and works, and `grep -rn backfillEmbeddings`
  finds only doctor fix-strings, the smoke suite and a status message — **no schedule entry, no
  route, no tool.** Fix: (a) record failures to a small `EmbedBacklog` table (or a `LogEntry` of
  type `embed_miss`) inside the catch; (b) `scheduleNamed("embed_repair", "0 4 * * *", …)` bounded
  to N/run; (c) the matching `core/catchUp.ts` JOBS entry.
- **Why:** *"The index develops silent, permanent holes. A Gemini 429 during the Sunday curriculum
  means those chunks are missing from semantic recall forever, and recall degrades in a way no
  instrument shows, because **a missing chunk looks identical to a chunk that wasn't relevant.**
  This is the failure mode that quietly makes Aurelius dumber over months."*
- **INVOKER:** New schedule entry + catch-up row. **RelEng's own flag:** *"this is the item on my
  list most at risk of being built and unreachable — if the schedule entry is skipped, the backlog
  table fills and nothing drains it, which is strictly worse than today."*
- **Prereqs:** A real embeddings provider. **Under `mock` this is a no-op by construction and must
  report `config`, not `live`.**
- **Build cost:** **3 h** · **Ongoing:** cents of embedding calls a night; surfaces nothing unless
  the backlog exceeds a threshold.
- **How we'd know:** A doctor check counting backlog rows older than 48h. It should read 0. *"If it
  reads 400, recall has been quietly broken and now Cole knows."*

### Item 33 — A cost governor that can stop spending, not just report it
- **Band:** 6→7. Reliability Engineer 9.
- **What:**
  - **(a)** `measurement/spend.ts:203` files the 80% warning at `severity:"notice"` /
    `kind:"opportunity"` — score `0.54`, below the 0.72 floor. **The early warning cannot reach his
    phone; only the 100% alarm can, i.e. after the ceiling is breached.** Raise to `attention`.
  - **(b)** Nothing consults the ledger before spending — grep `llm/runLLM.ts` and `llm/router.ts`
    for a spend read: **zero.** Add a pre-flight check refusing non-essential task types
    (`curriculum`, `research`, `synthesis`) above 100% of budget. **Never** refuse the briefing or
    a Cole-initiated chat — *"a budget cap that silences the operator is worse than a bill."*
  - **(c)** The budget check rides the 21:15 queue sweep — **45 minutes before the largest spend
    event of the week**, Sunday 22:00 curriculum ingest at `MAX_UNITS_PER_RUN = 14`
    (`learning/curriculum.ts:577`), with no per-run budget check. Gate inside
    `runCurriculumIngest`, reducing `cap` as the month's spend approaches the ceiling.
- **Why:** Estimated funded spine cost **$60-120/month, all-Sonnet**, against `docs/SCOPE.md:30`'s
  promised $20-50. *"Cost is a trust question, not an accounting one: the day Cole gets a bill he
  didn't expect, he turns the system off."*
- **INVOKER:** (a) existing; (b) `llm/runLLM.ts`, the path every call takes; (c)
  `runCurriculumIngest`, already scheduled at `index.ts:1749`.
- **Prereqs:** **`LLM_MONTHLY_BUDGET_USD` must be set** — blank at `.env.example:83`, in neither
  deploy doc, so the whole alarm is dormant by default. **Cole must name a number. Add it to the
  runbook as required, not optional.**
- **Build cost:** **4 h** · **Ongoing:** zero — it reduces token cost.
- **How we'd know:** Set the budget to $1 for a day. The 80% warning arrives on his phone, the
  curriculum ingest visibly reduces its unit count, **and the briefing still fires.**

### Item 34 — Make §2.3's claim measurable, and say the zero out loud
- **Band:** enabling now; 6→7 over a year. **Systems Architect 10(a)+(c) + Product Skeptic 9(a).**
  The control half is rejected — see §5.
- **What:**
  - **(a)** Restrict `llmDependenceRate`'s denominator (`measurement/scoreboard.ts:103`) to
    *reasoning* turns (chat + operator decisions), tagged at the call site, so scheduled ingestion
    volume stops polluting it.
  - **(b)** Report `llmCallsAvoided` from real skips only — `compiled/reasoningHelper.ts:66`
    hardcodes 0 with the comment `// v1 always 0` while the scoreboard renders a percentage over
    it.
  - **(c) Product Skeptic's sentence, and it is the deliverable:** `scoreboard.ts:162` currently
    renders *"LLM dependence: 100% (676 LLM calls vs 0 compiled reuses) — lower is smarter."* Add:
    ***"0 patterns compiled from N reasoning events in M weeks — the compiled layer is not learning
    yet."***
  - **(d)** Then **do not build more compilation machinery until (c) has been true and visible for
    a month.**
- **Why:** Systems Architect: *"This item does not make the claim true — nothing can, in under a
  year — it makes the claim **checkable**, which is the honest version and the only one that
  survives month two."* Product Skeptic: *"the one gap where the code already contains the
  instrument that proves it, and renders it as a flat line on a chart instead of a sentence. Cole
  either decides that's worth fixing or decides the layer isn't the point — **both beat a flat 100%
  on a sparkline nobody reads.**"*
- **INVOKER:** Sun 20:00 `weekly_scoreboard` (`index.ts:1707`), live.
- **Prereqs:** None for (c). Item 22 must land first or reuse hits inflate the improvement.
- **Build cost:** **2 h** (Skeptic, for (c)) / **4 h** (Architect, for all of it) · **Ongoing:**
  zero. **Product Skeptic: "The saving is the half-year of compiled-layer work it prevents."**
- **How we'd know:** The Sunday line changes from a meaningless percentage to *"12 of 340 reasoning
  turns served from compiled judgment; shadow agreement 9/9"* — or, honestly, to *"0 patterns in 3
  weeks."*

### Item 35 — Persist push delivery
- **Band:** enabling. **The surviving half of Reliability Engineer 10**, the rest withdrawn.
- **What:** `surfaceSignal` already returns `{ pushed }` (`core/bridge.ts:104`). Persist it as a
  `pushedAt` column on `BridgeSignal` so an undelivered `critical` is queryable and the briefing
  can say *"3 things I tried to reach you about and couldn't."*
- **Why:** Every alert goes through one function, `telegram/bot.ts:210-228::sendToCole`, and
  `pageFailure` calls it inside a `.catch(() => {})` — **if the page fails to deliver, nothing
  anywhere records that it failed.**
- **INVOKER:** `surfaceSignal`'s push branch + the briefing block at `rituals/engine.ts:165-176`.
- **Prereqs:** A Prisma migration — **mind the CLAUDE.md gotcha: excise the `DROP INDEX
  "VectorEmbedding_embedding_hnsw_idx"` and `DROP INDEX "Memory_metadata_gin_idx"` blocks the
  differ will emit.**
- **Build cost:** **~1 h** of the original 3 h (the second channel is withdrawn) · **Ongoing:** zero.
- **How we'd know:** An undelivered critical is queryable and gets named the next morning.

### Item 36 — Self-watchdog: 26 hours without a `JobRun` row → exit
- **Band:** 6→7. **Reliability Engineer 8(b), the surviving half — and the Chief of Staff named it
  as the thing his ledger had no line for.**
- **What:** A `setInterval` next to the heartbeat at `index.ts:1843`: if no `JobRun` row has been
  written in 26 hours, `process.exit(1)` and let launchd's `KeepAlive` restart it.
- **Why:** `index.ts:1842-1846` pings `HEALTHCHECKS_PING_URL` every 5 minutes; combined with
  `process.on("uncaughtException")` surviving loudly at `:97-100`, **a process that is *wedged* —
  leaked Prisma pool, dead node-schedule timer, a Telegram long-poll spinning — pings healthy
  forever and `KeepAlive` never restarts it, because the process never dies.** *"The dead-man
  switch proves the HTTP listener is up. It does not prove the spine ran."* Chief of Staff: *"A
  wedged Mini costs a silent week, which is more hours than anything on my list returns in a
  month."*
- **INVOKER:** A `setInterval` at boot.
- **Prereqs:** **Item 31(a)** — `KeepAlive` must actually be able to restart the process, which
  under a per-user LaunchAgent at a locked login screen it cannot.
- **Build cost:** **~1 h** of the original 2 h (the per-job Healthchecks half is withdrawn as
  duplicated by item 30) · **Ongoing:** zero.
- **How we'd know:** `kill -STOP` the backend. Within 26 hours something texts him. **Today,
  nothing would.**

---

## TIER C — gated on Cole selling something (build after, not before)

### Item 37 — A "they said yes" path
- **Band:** 6→7. Revenue Operator 9.
- **What:** `convertLead` (`crm/service.ts:149-181`) creates the Client and stops. Nothing creates
  the Engagement from the active Offer, nothing raises invoice #1, nothing sets `nextBillingAt` —
  the field `whatNeedsAttention:480-484` uses for renewal reminders and the field that makes the
  re-sign conversation happen. Give `convertLead` an optional `offerId`: create the Engagement from
  the Offer's `shape`/`priceCents`/`durationWeeks`, raise the first Invoice, surface **one** Bridge
  card — *"First client. Here's the engagement and the invoice."*
- **Why:** §3.2 and §7.1. *"Today the highest-emotion moment in the business is five separate chat
  tool calls whose argument shapes Cole has to remember."* **The constraint holds by construction:
  creating an Invoice row is inward; sending it is outward and there is no send path at all.**
- **INVOKER:** The Convert button at `business/page.tsx:152-162` and `crm.convert_lead`
  (`tools/adapters/crm.ts:220`).
- **Prereqs:** **An active priced Offer. A real yes.**
- **Build cost:** **3 h** · **Ongoing:** zero.
- **How we'd know:** Smoke: activate an offer, convert a lead with `offerId`, assert an Engagement
  and an Invoice exist at the offer's price with `nextBillingAt` set.

### Item 38 — Close the attribution join: which angle produced a **client**
- **Band:** 7→8. **Revenue Operator 10, Chief of Staff 12, Systems Architect 12.**
- **What:** `business/marketing.ts:347-393` — `anglePerformance` includes `_count: { select: {
  leads: true } }` and stops. The rest of the chain is already in the schema:
  `Lead.convertedClientId` (`schema.prisma:759`) and `Client.payments`. Extend the query to count
  converted leads per angle and sum `Payment.amountCents` for those clients; report `$X earned` in
  `verdict` above the lead count; change `marketingPass.ts:82`'s sort from `leads` first to
  **revenue** first.
- **Why:** *"This is the literal answer to §3.3 ('which topics generate leads') and §7.2 ('which
  content leads to which type of inquiry'), **computable today from data already in Postgres, with
  no Meta token.**"*
- **INVOKER:** `marketing_pass` (`index.ts:1610`) reads it, `/business` renders it,
  `business.angle_performance` returns it in chat.
- **Prereqs:** **At least one converted, paying client attributed to an angle.** *"Build this
  **with** client #1, not before — before that it is a query returning zeros."* Also: item 18 so
  `timesUsed` is real. **And the unstated one, which is Cole's:** the `?ref=` emitter exists
  (`business/page.tsx:1139`) but uses `window.location.origin`, `PUBLIC_BASE_URL` appears nowhere
  in `.env.example` or the frontend, and `DEPLOY_MAC_MINI.md:503` still reads *"**If** you ever put
  the Mini behind a public hostname"* over a Tailscale-only deploy. **On a Tailscale-only Mini the
  button copies a link nobody outside can open — an emitter that silently produces a dead link.**
  The one-line fix (source the origin from a configured base, disable the button with an
  explanation when unset) is 20 minutes; the hosting decision is Cole's.
- **Build cost:** **1.5 h** (Revenue) / **3 h** (CoS) · **Ongoing:** zero, deterministic joins.
- **How we'd know:** Smoke: angle → lead → `convertLead` → `recordPayment` → assert
  `anglePerformance().angles[0].revenueCents > 0`. Live: Cole asks *"which post produced a
  client"* and gets a row, not a shrug.

### Item 39 — Give the business operator a real Pass 2 pipeline
- **Band:** 6→7. Systems Architect 11. **The largest single gap between the vision and HEAD.**
- **What:** Add a **second** production caller to `reasonWithCompilation`
  (`compiled/reasoningHelper.ts:80`): wrap `draftOutreach` (`crm/leadEngine.ts:123-160`) with
  `signatureBuilder` = `{leadSource, stage, relationship, offerShape, priorTouches, sport}` — the
  exact taxonomy Cole's §2.2 already names — `entityKey` = the lead id, `domain` =
  `"business_outreach"`. Then `detectPatterns` starts mining "Cole usually says X to a
  referring-coach lead" from real confirms.
- **Why:** §4 says *"Every operator uses the same Pass 2 reasoning pipeline"* and it runs for one of
  five. This is the mechanism by which §3.2's *"learn which actions convert best"* and §7.1's
  *"what to say based on past successful messages"* become real, **and the only item on any list
  that makes `CompiledPattern` non-zero outside the training room.**
- **INVOKER:** 07:30 `outreach_sweep` (`index.ts:1596`) — already scheduled, already bounded.
- **Prereqs:** Real embeddings; **~20 confirmed outreach drafts** before a single pattern can form.
  Systems Architect, unprompted: *"**Building it earlier is this repo's signature defect** — a
  capability whose prerequisite cannot be met."*
- **Build cost:** **6 h** · **Ongoing:** the pattern-confirm loop costs Cole ~1 tap/week *"and it
  is the tap that makes the system his."*
- **How we'd know:** `SELECT count(*) FROM "CompiledPattern" WHERE domain = 'business_outreach'`
  goes above zero, and **Layer 5.4 injects something on a business turn for the first time in the
  repo's history.**

### Item 40 — The minimum honest P&L, and not one field more
- **Band:** 6→7. **Three chairs, priced 4h / 5h / 10h — a 2.5× spread the Adversary flagged.**
  Build the Chief of Staff's scope; the Product Skeptic deferred to it explicitly.
- **What:** A `BusinessExpense` model — `{ label, cents, cadence: monthly|annual|once, category,
  startedAt, endedAt }`, integer cents matching the `Invoice`/`Payment` discipline — seeded **once**
  with Cole's recurring software costs (this repo's own Anthropic bill among them). A monthly
  `pnl()` summing `Payment` received minus recurring expense run-rate plus LLM spend. **One line on
  the Sunday scoreboard and one line in the briefing only when the month is negative.** Data entry
  via a `wealth` chat-tool action so it works from the phone, not a desktop form.
- **Why:** §3.4 and §7.5 are the largest wholly-absent section of the vision. **But** `Invoice` = 0
  and `Payment` = 0. Product Skeptic: *"a P&L over zero revenue and one API subscription is a
  spreadsheet with two cells. **Build this the month after the first payment lands, not before.
  Any chair who ranks it higher is scoring the spec instead of the man.**"*
- **INVOKER:** `weekly_scoreboard` (existing) + `rituals/engine.ts` for the negative-month line.
  **Product Skeptic's honest flag on his own version: "this item currently has no invoker and would
  need two built."**
- **Prereqs:** **One paying client.** Cole entering recurring costs once — *"a data-entry chore he
  will do once and abandon unless it is ≤5 fields."*
- **Build cost:** **4 h** (Architect) / **5 h** (CoS) / **10 h** (Skeptic) · **Ongoing:** ~5
  min/month. **Chief of Staff: "This is the item on my list with the worst ongoing profile [...] A
  full expense-category ledger is a job, not a feature, and I would refuse to build it."**
- **How we'd know:** Sunday says *"in $0 · out $73 (LLM $61, software $12) · net −$73"* instead of
  *"14 corpus docs added."*

### Item 41 — Instagram insights on a schedule — **SPLIT DECISION, COLE MUST RULE**
- **Band:** 6→7. **The Adversary: "Not a duplicate — a genuine split decision. Cole must rule, not
  average."**
- **What (the build, if he rules for it):** `scheduleNamed("content_insights", "0 10 * * 1", …)`
  calling `recentPostMetrics()`, persisting saves/shares/reach onto the `ContentDraft` rows keyed
  on `permalink` (`schema.prisma:895`, already there), folding them into `anglePerformance`'s
  verdict, one weekly Bridge signal naming the best and worst performer of the last four weeks.
- **FOR — Systems Architect 12, Chief of Staff 13 (before withdrawal):** §3.3 asks verbatim for
  *"views, saves, shares, leads generated"* and *"learn what topics, hooks, formats perform best."*
  `instagram/insights.ts` is finished, correct, and reachable only from three chat-tool branches.
  CoS: *"This is CLAUDE.md rule 8's signature defect in a file that is otherwise good work."* SA:
  *"§3.3 and §7.3 are the only place the vision asks for a number the system genuinely cannot
  produce today, and it is one join away."*
- **AGAINST — Revenue Operator, Product Skeptic, and the Chief of Staff withdrawing his own item:**
  Revenue: *"it would measure a **zero-follower account.** Views, saves and shares on ~0 impressions
  is noise wearing the costume of data, and it would then feed `marketingPass`'s angle selection
  with that noise. The loop that actually matters (angle → lead → client → payment) needs no Meta
  token at all. **Build item 38; revisit insights at a thousand followers.**"* CoS, withdrawing:
  *"I costed the ongoing at '1 min/week of reading.' The real ongoing cost is that saves and shares
  on ~0 impressions then enter `marketingPass.ts:82`'s angle ranking **as if they were data.**"*
- **INVOKER:** A new `scheduleNamed` entry — CoS: *"**name it in the commit or this item is the
  defect it is fixing.**"*
- **Prereqs:** Instagram Business connected **and at least one published post** — which
  additionally needs `MEDIA_PUBLIC_BASE_URL` **and an image producer**; `hostBytes`/`hostLocalFile`
  have zero production callers.
- **Build cost:** **2.5 h** (CoS) / **5 h** (Architect, with the join) · **Ongoing:** one API
  pull/week.
- **How we'd know:** Monday morning, a signal names last week's best-performing post by saves.

### Item 42 — The short-circuit flip
- **Band:** 7→8. Chief of Staff 15. **The gate is months out and the control half is rejected — see
  §5.**
- **What:** When `canShortCircuit()` (`compiled/shortCircuit.ts:167`) reports eligible **and Cole
  taps a Bridge confirm to enable it**, serve the compiled answer, mark it visibly compiled in the
  UI, and re-arm the frontier permanently for that topic on any correction. Change
  `reasonWithCompilation`'s `llmCallsAvoided: 0` to a real count once step 5 exists.
- **Why:** *"This is the **only** item that makes Cole's §2.3 — 'over time, reduces LLM calls' —
  literally true rather than decoratively true."*
- **INVOKER:** `llm/runLLM.ts` on the chat path, behind the Bridge confirm. `decision_curriculum`
  (`index.ts:1758`) already calls `gradeShadowAgreements()` weekly, **so the evidence accrues
  without new work.**
- **Prereqs:** A real embeddings key; **~10 graded agreements with zero disagreements over 30
  days**, which needs months of chat volume; **and Cole's explicit flip — this must never be
  granted.** CoS: *"a system that decides to stop consulting the frontier has escalated its own
  autonomy in substance if not in name"* (CLAUDE.md hard rule 1).
- **Build cost:** **4 h** · **Ongoing:** *"the real cost is trust risk, not hours — a wrong compiled
  answer served confidently is more expensive than an LLM call. The zero-disagreement bar is what
  prices it."*
- **How we'd know:** `llmDependenceRate` falls week over week **while** confirm rate and correction
  count hold steady. **"If dependence falls and corrections rise, the flip is wrong and must
  revert. That pairing is the test; either number alone is meaningless."**

---

# 3. BANDS

## Reachable **now**, no input from Cole

**→ 5 (the honesty band).** Items **1–14** (Tier A, ~5 hours) plus **15, 16, 19, 20, 21, 22, 23,
25, 26, 27, 28** — roughly **25–35 hours** depending on whose cost you take for items 20 and 26.
Everything here is *removal of a falsehood*: a Bridge that ranks correctly, a badge that counts
decisions, a spine that can record failure, receipts that don't claim reversibility they don't
have, a reuse cache that can't serve one person's draft to another, a verification suite that goes
red on a real defect.

Four chairs call this a **6**. The Adversary calls it a **5**: *"None of them is a capability. A
system that has stopped lying and has nothing to say is a 5."*

## Reachable now but **only meaningful with data**

**→ 6.** Items **18** (reply loop — the Adversary's named gate), **24** (revenue on the scoreboard),
**29** (backups that are real), **30** (what didn't run last night), **31** (survives a reboot),
**32** (vector repair), **34** (§2.3 measurable). Build them; know that 24 reports zeroes and 18
reports nothing until Cole pastes twenty names.

**The Adversary's formulation is the one to hold:** 6 arrives the week **twenty names are pasted
AND item 18 is built** — because that is the only mechanism on any list producing an observable
Cole did not type.

## **Not** reachable now

**→ 7.** Gated on **Cole's price, his twenty names, and his first ten sends.** Items **33** (cost
governor, needs a budget number), **36**, **37**, **39** (needs ~20 confirmed drafts), **40**
(needs one payment), **41** (needs an audience and a ruling). Systems Architect: *"The gap between
6 and 7 is not code. It is his first ten conversations."*

**→ 8.** Gated on **~20 real sends and one paying client attributed to an angle.** Item **38**, and
item 39 bearing fruit. Revenue Operator: *"That is not a build. It is a month of Cole pressing
send."*

**→ 9.** Gated on **a year**, a second API key, and `CompiledPattern` becoming non-zero outside the
training room. Item **42**, and only on its own evidence. Chief of Staff: *"I do not think 9 is
reachable in 2026 and I would not plan against it."*

---

# 4. BUILT TOGETHER OR NOT AT ALL

Each of these: doing one alone is neutral or actively harmful.

**1. Item 3 (`noted` expiry) + ANY inversion of `schema.prisma:395`'s default.**
The known example, and the Reliability Engineer's warning is **binding** — endorsed unchanged by
all five chairs across three councils. Inverting the default alone routes *more* rows into a bucket
that has a writer, no reader, and no collector. **Same commit or neither.**

**2. Item 2 (badge counts decisions) + item 20 (deck ranks and splits).**
Chief of Staff: *"A badge reading 16 attached to a page that still shows 12 newest-first receipts
is **worse** than 103 — it promises a closable list and doesn't deliver one."* Product Skeptic: *"a
smaller lie, not a fixed one."* **Same commit.**

**3. Item 15 (executor→`surfaceSignal`) + the stable `sourceId` + item 17 (rotation).**
Three separate holes and each fix alone leaves one open. Route the executor and leave the
touch-counter → every re-draft still mints a fresh row. Stabilise the key and leave the executor raw
→ nothing reads the key. **And the Adversary's third:** the dedup only collapses onto a *still-open*
row, so a stable `outreach:${lead.id}` does **not** prevent a fresh card after Cole confirms —
`finalizeOutreachDraft` moving `nextActionAt` +4d is what does. *"The two fixes are load-bearing
together; either alone leaves a hole."*

**4. Item 16 (unswallow the spine) must land AFTER items 1, 2, 12, 15, 20.**
Named independently by the Systems Architect, the Reliability Engineer and the Product Skeptic.
*"With the swallow removed, a genuinely broken job now pages. That is the point — and it means the
badge work should land first or Cole gets a retry siren instead of a calendar siren"* (SA). Product
Skeptic sharpens it: *"Truth arriving into an unreadable list is worse than the silence, because
now he has been shown it and still didn't act."*

**5. Item 16 (claim ledger) + item 30 (the briefing names what didn't run).**
The Reliability Engineer flags this against his own item: *"the briefing line reads
`JobRun.status`, which can only say `done`. **Building 30 without 16 is this repo's signature
defect, in the fix for it.**"*

**6. Item 18's reply detection BEFORE item 17's rotation.**
Product Skeptic: *"Rotation without reply detection rotates faster through a list that includes
people who already wrote back. **The warm list is non-renewable; speeding up the treadmill before
it can tell who replied burns it faster.**"* Chief of Staff, same conclusion by a different route:
both edit `nextActionAt` and neither is correct alone — *"ship one without the other and a lead who
wrote back is either re-drafted forever or never picked up again."*

**7. Item 4 (`marketing_pass` → catchUp JOBS) BEFORE item 7 (the `"recommendation"` kind).**
Adversary: fixing the `kind` of a message whose producer can silently skip a week is fixing
nothing.

**8. Item 23 (derive catchUp's hour from cron) BEFORE any cron string moves.**
Adversary: without it, moving a job desynchronizes catch-up for that job **silently**.

**9. Item 22 (reuse key) BEFORE Cole buys his second API key.**
Under `EMBEDDINGS_PROVIDER=mock` the defect is inert. It activates the day real embeddings land —
serving one person's draft to another under `engine: "compiled"`, `tokensUsed: 0`. **Fix before,
not after.**

**10. Item 34's honest zero BEFORE any further compiled-layer machinery.**
Product Skeptic (d): *"Do not build more compilation machinery until (c) has been true and visible
for a month."*

**11. Item 29(f): `db_backup`'s missing `await` in the same commit as the mount check.**
Otherwise the restore drill reports success at claim time — the exact defect it exists to catch.

**12. Item 32's schedule entry AND its catchUp row, or don't build it.**
The Reliability Engineer's own flag: *"if the schedule entry is skipped, the backlog table fills and
nothing drains it, which is **strictly worse than today.**"*

**13. Item 36 requires item 31(a).**
A self-watchdog that exits so `KeepAlive` restarts it is inert under a per-user LaunchAgent at a
locked login screen.

**14. Item 26 AFTER items 8 and 21.**
Otherwise the suite goes red on day one on things already agreed to fix.

**15. Build ONE of {item 15, item 25}, not both.**
Adversary: *"Building both is paying twice for one guarantee."* The Systems Architect and Chief of
Staff prefer 25 (unbypassable); the Product Skeptic — its author — prefers 15 (a third of the cost,
covers the highest-volume writers). Cole picks.

---

# 5. REJECTED

## Killed by the Adversary — do not re-propose

**"Put the dedup guard inside `surfaceSignal`" — Reliability Engineer's THE ONE THING.**
**ALREADY SHIPPED.** *"His entire top-ranked item is 0 hours."* The guard is at
`core/bridge.ts:110-131`, keyed exactly as specified, 24h window, collapsing only onto still-open
rows. `git log -S "DEDUP_WINDOW_MS"` → `f77eb2a`. He cited `:80` as a bare create; at HEAD line 80
is inside `needsDecision`. **What survives is 20 minutes:** delete the now-redundant hand-rolled
guard in `core/backup.ts:67-71`, and make the calendar message state duration (*"the calendar has
been dead for N days"*) rather than re-announcing. RelEng withdrew it himself.

**"Emit the tracked link" — Product Skeptic item 4. ALREADY BUILT.**
He claimed `grep -rn "ref="` returns only React props. `frontend/app/(chrome)/business/page.tsx:1139`
is a click-to-copy `${window.location.origin}/start?ref=${d.id.slice(0,8)}` under a comment reading
*"The link that closes the loop"*, and `resolveRef` (`crm/leadEngine.ts:333-345`) accepts
`startsWith` on ≥6 chars so the 8-char slice resolves. **The chain is complete end to end today.**
He withdrew it in full: *"My grep was wrong, not the code."* **His downstream claim collapses with
it** — `_count.leads` is **not** structurally pinned at zero forever. What survives is 20 minutes
(widen the button from per-`ContentDraft` to per-angle, put it on a mobile surface, source the
origin from a configured base) plus **a hosting decision only Cole can make** — folded into item 38's
prereqs.

**"Widen the gated-ask window to 26h" — Product Skeptic 6 AND Chief of Staff 2b. Both wrong, in the
same direction.** See item 5. *"One character in the wrong direction."*

**"Swap the briefing and the sweep crons" — Revenue Operator 3, Chief of Staff 2a.**
Dominated by item 5, **and it breaks catch-up**: `core/catchUp.ts:61-65` hardcodes the hour as a
literal. *"He names two collision prerequisites and misses the one in the file."* Revenue Operator
withdrew it: *"Moving crons to fix a window was the wrong instrument."*

**Routing `executor.ts:80` (the acted receipt) through `surfaceSignal` — Systems Architect item 1's
framing.** It writes `status: "acted"`, outside the dedup set and outside `needsDecision`'s
derivation. *"Routing that path changes receipt behaviour and is unpriced."* **Name the gate path
only** — folded into item 15.

**Fixing `MobileTabBar`'s dead `also` strings.** Factually correct (`/projects`, `/autonomy`,
`/traces` are not routes) but they feed one thing: `pathname.startsWith(a)` in the active-highlight
test at `:30`. *"Dead strings in a highlighter. **Zero user-visible effect. Cosmetic, and it will
be built because it is easy to describe.**"*

**The Autonomy-dial short-circuit control — Systems Architect 10(b), Chief of Staff 15's control
half.** *"This proposes a UI control plus a scoreboard line for a mechanism that has never executed
once"* — `CompiledPattern` = 0, `LogEntry` `decision:case` rows = 0. **Build the report line (item
34, free); do not build the control until `canShortCircuit()` has ever returned non-zero.** Systems
Architect conceded: *"Building a progress control over a counter that has never incremented is this
repo's signature defect wearing my name."*

**`docs/SCOPE.md` as a roadmap slot.** Billed three times at 20-40 min each. *"Do it once, in ten
minutes, attached to another commit."* Kept as item 14, explicitly a rider. Revenue Operator
declines it outright.

## Already done at HEAD — verified, stop finding them

- **Dedup inside `surfaceSignal`** — `core/bridge.ts:110-131`, commit `f77eb2a`.
- **The calendar siren** — `calendar/engine.ts:62-67` routes through `surfaceSignal` with a
  day-keyed `sourceId`. **Genuinely dead**, confirmed by the chair who reported it.
- **The `?ref=` emitter** — `business/page.tsx:1139`.
- **Tier-derived severity** — `executor.ts:126-128`, outward → `critical`. Real, **but inert on
  every UI surface until item 1 ships.**
- **The every-gated-ask briefing counter** — `rituals/engine.ts:164-176`. Real, correctly filters on
  `confirm_action`; broken only by the window above it (item 5).
- **`queueSweep` selecting `noted`** — `:130` is done. Only the two `updateMany` filters remain
  (item 3). *"Chairs describing this as unfixed are half right; the fix is smaller than stated."*
- **`groundingFromResearch`** — shared and pure as specified. Carries the `"serp"` defect committed
  in the same fix (item 8).
- **Free-text phone capability** — `telegram/bot.ts:417-440` routes any non-command message to
  `POST /api/aurelius`, the full tool pipeline. `import_warm_list` (`tools/adapters/crm.ts:168`),
  `record_payment` (`:160`), `activate_offer` (`tools/adapters/business.ts:51`), `raise_invoice`
  (`:153`), `outreach_sweep` (`:183`) are **typeable from his phone today.** *"Anyone banding the
  nav link at 4→5 is overpaying for it."*

## Duplicates — collapsed, with the winner named

The Adversary: *"Deduplicated, the five lists contain roughly **eight** distinct engineering items,
not the ~65 proposed."*

| Finding | Chairs | Collapsed to | Winner / note |
|---|---|---|---|
| `queueSweep` `noted` expiry | **4** | Item 3 | ~10 lines |
| `getBiggestRisk` missing `hasActiveOffer` | **4** | Item 12 | **Revenue Operator's 1(a)** — he alone saw the branch dies when 20 leads land; Skeptic's 5(b) adds the necessary reorder |
| Reachability audit extension | **4**, priced 1h/3h/4h/5h | Item 26 | **Chief of Staff's narrow scope** + SA's rule (b) |
| `/business` mobile nav | **5** | *(demoted to a 20-min chore)* | See below |
| Spine claim ledger / retry | **3**, 3h/4h/3h | Item 16 | Same edits; RelEng owns it |
| Lead-aware triage / reply detection | **3**, 4h/3.5h/4h | Item 18 | Revenue Operator's, + CoS's send half |
| Revenue on the Sunday scoreboard | **3** | Item 24 | — |
| Expense model / P&L | **3**, 4h/5h/10h | Item 40 | **CoS's scope**; Skeptic deferred |
| `chatCompiler` guard | **3** | Item 9 | SA's refactor half withdrawn |
| `semanticReuse` `quick_reply` | **2** | Item 22 | — |
| `systems.sop_draft` | **3** | Item 21 | Fifth council |
| "Reversible" receipt lie | **2** | Item 6 | **CoS's 10-min version dominates SA's snapshot plumbing.** Both other chairs conceded |
| Attribution join | **3** | Item 38 | — |
| Confirm-rate ledger / self-audit | **2**, 4h vs 6h | Item 24 + item 34 | *"the same query set priced 50% apart, described in different words"* |

## The `/business` nav — the full record, because five chairs ranked it #1 and it collapsed

- **Round 2:** Revenue Operator raised it to CRITICAL, then revised down himself: *"I raised it to
  CRITICAL partly because it was the most auditable thing on my list."*
- **Chief of Staff's mechanical correction, verified by all four other chairs:** the money
  *capability* is already on the phone via chat tools (see "Already done"). The nav gates the
  *dashboard*, not the capability.
- **Revenue Operator then withdrew the nav in favour of CoS's `/business` Telegram command.**
- **CoS then withdrew the Telegram command too:** *"at zero leads it prints zeros, and the evidence
  — 4 human interactions in 1,359 signals — says the failure is that no surface can render a
  decision, not that a dashboard is hard to find."*
- **Product Skeptic's framing, which stands:** *"I rank it 11th, not 1st, and I want the reason on
  the record because five chairs ranked it 1st. **It is 15 minutes because it is easy to describe,
  not because it is the largest term.**"* Revenue Operator: *"A chair who ranks this #1 is ranking
  auditability, not money — a nav link is the most greppable finding available from inside a repo,
  which is precisely why everyone finds it."*
- **Disposition:** add `/business` to `more/page.tsx` GROUPS (whose own header comment reads
  *"Nothing lives ONLY here — this is a listing, never a burial"*) and to the More tab's `also`
  array. **20 minutes, as a rider on any commit. Not an item.**

## What every chair refused to build — the standing "no" list

**Connectors for their own sake.** Immich, Logseq, Zotero, HubSpot/Streak, YouTube analytics,
Sheets-as-CRM. Unanimous. Systems Architect: *"If a chair proposes them, ask which one the money
path traverses."* Chief of Staff: *"Building a connector because it appears in a list is how the
parked Business Engine got parked."* An external CRM would replace *"the one part of this repo that
is properly built."*

**A payment rail.** `"stripe"` is an enum string. **Unanimously and correctly deferred for four
councils.** Venmo for clients 1–5 costs ten minutes total; the rail costs a day and its ongoing cost
is webhook maintenance forever.

**Scheduling more generation of any kind** — more angles, more drafts, a bigger `MAX_PER_RUN`, a
wider `MAX_UNITS_PER_RUN`, a second content lane. **Unanimous, and it is the loudest "no" in the
record.** Chief of Staff: *"Generation is not the constraint. Cole's 45 minutes is. **Every item
that produces something for him to read must displace something else that already does, or it is a
tax wearing a feature's clothes.**"* The FUNDED round measured what happens when you ignore it: 21
gated asks/week for three human beings, 86% duplicates.

**A retry queue / job framework** (BullMQ, a generic `RetryPolicy`, a durable job table).
Reliability Engineer: *"The retry Cole needs already exists — it is simply unreachable. Item 16 is a
**deletion** of twenty `try/catch` blocks. A framework would be 20× the code to reach the same
behaviour."*

**A metrics/observability stack** (Prometheus, Grafana, OpenTelemetry). *"The instrument is not
missing; it is **lying**. A dashboard on top of untrue data is a more confident lie."*

**A rituals/prompt-layer registry for elegance.** Systems Architect, arguing against his own
instinct: *"`buildSystemPrompt` has fifteen inline layers [...] That is ugly and it has cost exactly
one real bug — the double-injected `businessContextBlock` (`router.ts:482` plus five inline callers
at `leadEngine.ts:123`, `marketing.ts:135,280`, `offers.ts:110`, `positioning.ts:370`). **Fix that
one instance — 20 minutes, delete the inline copies now that Layer 5.35 exists — and do not build
the registry.** A registry is a week and buys elegance, not points."*

**A public street for `/start`, before there is traffic.** *"A front door on a street nobody walks
down. Ship the street the week he first has traffic."*

**Lowering `detectPatterns`' thresholds to make `CompiledPattern` non-zero.** *"The count is zero
because nothing has happened yet. Manufacturing patterns from thin data is how the learning loop
starts lying."*

**Another badge backfill.** *"Two councils have now shipped one. The row count went 66 → 102 and the
distinct-title count is 12. **The problem was never the rows.**"*

**Making the queue sweep more aggressive to fix the badge.** *"Shortening `NOTICE_EXPIRY_DAYS`
treats the symptom and will silently expire real notices."*

**MCP.** Correctly frozen pending the Mini. Four chairs agree.

---

# 6. WHAT THIS LIST CANNOT FIX

**It cannot make him sell anything.** Every item is downstream of three inputs only Cole has: a
price, twenty names, thirty days of use. Systems Architect: *"`Lead 0 · MarketingAngle 0 ·
AutonomyGrant 0 · CompiledPattern 0` in the live database is not a defect report, it is a photograph
of a system that has never met its user. **A 6 built out of the fourteen items above, sitting
unused, is worth less than a 4 that he pastes a warm list into on Saturday.**"* Chief of Staff:
*"Nothing on it creates demand. Not one item makes a stranger want what Cole sells."* Revenue
Operator: *"If he builds items 1–7 this week and sends nothing, the score does not move, **and that
would be the most expensive outcome available.**"*

**It cannot tell you whether the drafts are any good.** The largest single unknown across four
councils, with **zero observations from all six chairs.** Every LLM consumer in the repo —
`draftOutreach`, `proposeAngles`, `draftAsset`, `draftOffer`, `inboxTriage`, the briefing's voice
pass — has only ever executed its **refusal branch**. `engineUnavailableText` and the four length
floors catch a *refusal*; they cannot distinguish a good draft from **a fluent, confident
fabrication about a person Cole actually knows.** Funded, those guards fire on approximately zero
calls. Chief of Staff: *"**That single unknown is larger than the sum of every item on this list**,
and it resolves on day one for the price of one confirm and one read."* Reliability Engineer:
*"reliability engineering has nothing to say about it. The warm list is finite and does not
regenerate; **the first bad draft is the expensive one.**"* — **This is item 0. Do it first.**

**It cannot tell you whether he will look.** Product Skeptic: *"Every item above makes the system
honest. **None of them makes it interesting.** With zero leads, a fixed Bridge shows Cole an empty,
correctly-sorted, correctly-deduplicated list of nothing. A correct empty state is still an empty
state. The reason I still rank item 20 first is that a *wrong* list of 24 duplicate receipts
actively teaches him not to come back, whereas an honest empty one merely fails to teach him
anything."* The one datum that is about a human — **3 acted, 1 dismissed in 1,359 signals** — *"is
probably a developer clicking twice."*

**It cannot close the ratchet.** Every chair who kept looking kept finding. Chief of Staff: *"I
looked for two hours today and found four things three councils missed. A fifth chair looking
tomorrow will find four more. **At some point the correct response is to stop scoring and start
shipping.**"* Adversary: *"The score measures how long we looked. [...] the Chief of Staff found
four defects three councils missed, the Skeptic found a backwards `ORDER BY` that survived four,
and **I found a spine job missing from the catch-up list that all five chairs walked past while
writing items that depend on it.**"* Item 26 makes a machine catch one class mechanically; the rest
is a rule no code enforces: **freeze the tree, land the fixes, run the suite, then start the next
thing.**

**It cannot fix a verification suite that grades refusals.** 413 → 430 → 455 → 471 → 488 green
assertions rising monotonically through every commit that shipped these defects. Items 27 and 28
nibble at it. Chief of Staff: *"488 green assertions is a number that describes the code that was
written, never the code that was bypassed."*

**And it cannot buy the seventh point.** Systems Architect, exactly, *"because vagueness costs him
days"*: items 1–8 and 14–15 of his list get to a defensible 6 in roughly 25 hours; items 9–13 are
built correctly and **report zeroes until he has a lead, a client, and a post that produced one.**
**The gap between 6 and 7 is not code. It is his first ten conversations.**

**On Cole's 45 minutes, from the chair whose lens is hours:** *"Even at +1.3 hr/wk net, that is
eleven minutes a day. This system will not double his capacity in 2026. What it can plausibly do by
the end of this list is stop costing him time, tell him the truth about its own ledger, and put the
eleven minutes on the pipeline instead of on task hygiene. That is worth building. **It is not
Jarvis, and I would rather he hear that from me now than from month two.**"*
