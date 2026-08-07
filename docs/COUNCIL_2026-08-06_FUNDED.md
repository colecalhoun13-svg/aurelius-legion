# COUNCIL — THE FUNDED COUNTERFACTUAL
## 2026-08-06 · Round 3 · "What is Aurelius worth once it is fully deployed and funded?"

Cole's question: the cold-repo audit landed at 4/10 with the caveat that nothing had
ever run — no API key, mock embeddings, no Gmail, no Telegram, no calendar. What is
the number once it is turned on, paid for, and used daily for a month?

Six chairs answered. This is the record.

---

## 1. THE HEADLINE

| Chair | Cold | Funded | Direction |
|---|---|---|---|
| Systems Architect | 3/10 | **3/10** | flat |
| Reliability Engineer | 3/10 | **3/10** | flat |
| Revenue Operator | 4/10 | **5/10** | **+1** |
| Chief of Staff | 4/10 | **3/10** | **−1** |
| Product Skeptic | 4/10 | **4/10** | flat |
| The Adversary | 4/10 | **3/10** | **−1** |

**Cold range 3–4. Funded range 3–5. Median moves from 4 to 3.**

### Does turning it on fix this system?

**No.** Five of six chairs say no outright; the sixth (Revenue Operator) says no and
awards his +1 for information gained rather than defects closed. Two chairs moved
*down*.

The reason is uniform across all six answers, and it is the finding of the round:

> **The cold environment was flattering this system, not penalising it.**
> — Chief of Staff

With no key, nothing generated. With nothing generated, every flood, every dollar,
every stale-cache path, every retry hole and every forged subject line sat dormant
and unscored. Funding raises the ceiling (real drafts, real retrieval, real
briefings) and lowers the floor:

> "Every defect I filed is of the form 'this does nothing today and does the wrong
> thing at volume,' so funding raises the ceiling while lowering the floor I
> actually score on: 60 siren pushes/day, zero confirm pushes/day, no same-day
> retry against failure sources that only exist once you're paying."
> — Reliability Engineer

The Systems Architect put the arithmetic bluntly: turning it on "resolves two of my
fourteen findings and makes six of them worse by turning them from arithmetic into
volume — and it introduces at least four defects I could not have found cold, one of
which invalidates a premise of the counterfactual itself."

**The dissent worth reading.** Every chair, unprompted, argued their own number might
be too high *and* too low, and four of them landed on the same escape hatch: the
defect set is small.

> "Everything that fires my 3 is about five lines. The `Re:` ternary, the `if (to)`
> throw, the `sourceId` dedup in `surfaceSignal`, the two schedule times swapped, and
> a `sourceCount` check that demands a *relevant* source. Forty minutes of work makes
> this a 5."
> — Chief of Staff

> "A score that says '3' about a system three hours from '5' is scoring the
> maintenance backlog rather than the machine."
> — The Adversary

And the counter-argument, also from The Adversary, which Cole should weigh hardest:

> "I moved down on a defect I found by opening a file I had not opened before. Every
> chair on this council who kept auditing kept finding. That means my 3 is not a
> measurement of the repo; it is a measurement of how long I looked. The next chair
> to look for three more hours will find three more, and will also be tempted to move
> down. At some point that stops being rigour and becomes a ratchet."

---

## 2. WHAT WAS THE ENVIRONMENT, NOT THE CODE

Criticisms Cole can stop worrying about. The honest total is small — the Chief of
Staff counted **three items, one of them partial**, and called that "the honest answer
to Cole's question."

### Genuinely evaporates

**The keyless error-string class.** `compiled/chatCompiler.ts:31` sets
`MIN_ANSWER = 60`; the 62-character string *"Anthropic engine is not configured.
Missing ANTHROPIC_API_KEY."* cleared it by two characters and got filed as compiled
understanding. That exact string cannot occur with a funded key. **Off the list as
filed** — The Adversary, Product Skeptic and Systems Architect all struck it.

Partial only, and three chairs said so independently: `engineUnavailableText` also
matches `"Anthropic API error: …"` (`llm/nonAnswer.ts:29`), and a verbose 429 body
exceeds 60 characters. The Systems Architect: it "drops from certain-and-daily to
rare." The Chief of Staff: "the defect narrows from 'every day' to 'every bad hour';
it does not close."

**"Every LLM consumer has only ever executed its refusal branch."** The largest bucket
in the cold honest-state section. It was never a defect — it was the size of the
council's ignorance, and it resolves on day one.

> "It converts to an *unknown*, not a *pass* — and that unknown is the largest single
> term in every leverage number six chairs produced."
> — Product Skeptic

**"Retrieval runs on meaningless geometry."** `EMBEDDINGS_PROVIDER=mock` was the whole
finding. Real embeddings resolve it. The Revenue Operator counts this as part of why
he moves up a point. **But** — the Systems Architect, Chief of Staff, Revenue Operator
and Product Skeptic all note it *inverts into a new defect underneath*: real
embeddings are what arm `semanticReuse`. See §3 and §5.

**The doctor's dormancy noise.** With Gmail/Calendar/Telegram/Paperless configured,
the dormancy machinery stops dominating the doctor output and `checkVectorGeometry`
(`core/doctor.ts:448-480`) becomes a real check rather than a `dormant` row.
— Reliability Engineer

**Three claims retracted outright.** The Adversary withdrew, at HEAD: `/intake`
urlencoded (wrong), `content.draft` has zero `executeAction` sites (wrong), and "all
three money branches are structurally unreachable at Cole's state of zero" (wrong once
the system is actually used).

**A worry retracted before it was filed.** The Revenue Operator expected
`taskType: "quick_reply"` (`inboxTriage.ts:106`) to route to Groq and die on an
Anthropic-only key. It does not: `router.ts:769-777` filters the chain by
`providerConfigured` and falls back to `claude-sonnet-5`. "Credit where due — that
failover chain is correctly built."

**Two fixes that actually landed and hold.** The Adversary verified at HEAD that
`609cd56` closed the executor severity suppression (`executor.ts:127-128`, outward →
`critical` → pushes and bypasses quiet hours) and the briefing's `inbox_triage`-only
filter (`rituals/engine.ts:155-176` now counts every open signal carrying a
`confirm_action`). "Genuinely closed. **Credit where it is due.**"

**`/intake`'s unbounded rate-limiter Map.** Real code defect; irrelevant in practice.
The Chief of Staff over-ranked it cold and de-ranked it here: Cole has no public
street (`docs/DEPLOY_MAC_MINI.md:503` still conditional) and no traffic. Latent, not
active.

### The one contested evaporation

**The council's #1 CRITICAL — the grounding mislabel — is the only finding a chair
argued evaporates, and five chairs argued the opposite.**

The Reliability Engineer's case: `research/researchEngine.ts:47` sets `FEATURES.web`
on `TAVILY_API_KEY || GEMINI_API_KEY`, and `docs/DEPLOY_MAC_MINI.md:159,170` instruct
`GEMINI_API_KEY` + `EMBEDDINGS_PROVIDER=gemini`. Since there is no Anthropic embedding
adapter, real embeddings *require* an OpenAI or Gemini key — and a Gemini key turns
web search on, at which point the "research-backed" label is true.

> "The brief's 'web search may still be absent' premise **cannot coexist with its own
> 'real embeddings' premise**. … The lie survives only as an *intermittent* one, on
> the branch where Gemini 429s or times out. That is still a defect. It is not a
> CRITICAL."
> — Reliability Engineer

Five chairs reached the opposite conclusion by a different route — see §3, where it is
the most-cited finding of the round. The Product Skeptic and The Adversary resolve the
contradiction the same way: the premise is unreachable, and **which of three systems
Cole gets depends on which second key he buys.** That is §5's headline.

---

## 3. WHAT GETS WORSE WHEN IT'S RUNNING

Six mechanisms. Five of six chairs named one of the first two as their most dangerous
defect funded.

### 3.1 The calendar siren — ~60 phone buzzes and ~96 badge rows per day

**Named most-dangerous-funded by the Product Skeptic and The Adversary. Cited by all
six.** Quantified identically and independently by five chairs.

The chain, verified at HEAD by four of them:

- `syncCalendar` calls `surfaceSignal` on **every** disconnected tick
  (`calendar/engine.ts:55-79`).
- `surfaceSignal` (`core/bridge.ts:73-92`) is a **bare `prisma.bridgeSignal.create`
  with no dedup and no prior-row check** — despite the comment at `:57-58` claiming
  *"surfaced once (deduped by day)"* and the day-keyed `sourceId` at
  `calendar/engine.ts:64-66` that **nothing reads**.
- Poller is `setInterval(…, 15 * 60 * 1000)` (`calendar/engine.ts:501-505`).
- Salience: `kind:"risk"` (1.0) × `severity:"attention"` (0.7) →
  `0.7×0.65 + 1.0×0.35 = 0.805 ≥ 0.72` (`core/salience.ts:22-41,79`) → **pushes**.
- Quiet hours suppress 22:00–07:00 — **the pushes, not the rows.**

**Result: 96 rows/day, ~60 Telegram pushes/day**, recurring on Google's documented
~weekly Testing-mode refresh-token expiry (`NORTH_STAR:520-529`).

The Reliability Engineer computed the steady state: notices expire at 14 days
(`queueSweep.ts:29-30,135`), so the badge settles at **~1,344 pending rows.**

The Systems Architect added the mechanism that makes it fire in the first place:
`isCalendarConnected()` is a **row check, not a health check**
(`calendar/googleAuth.ts:143-149`), while the real probe `isCalendarHealthy()` (`:135`)
is called only by `tools/integrationStatus.ts:41`. On expiry, `refreshAccessToken`
gets `invalid_grant` and calls `disconnectCalendar()` (`googleAuth.ts:234-239`),
flipping `active:false` — and from the next tick the siren runs.

**Why this is the one that matters most.** Two chairs made the same argument
independently:

> "It is the most dangerous not because it is the largest but because it is **the one
> defect that disables every other fix in the repo**. `609cd56` made outward publish
> and send confirms `critical` specifically so they could finally reach his phone. The
> siren trains him to mute the channel they arrive on, within two weeks, before he has
> ever received one."
> — Product Skeptic

> "Cole gets ~60 identical buzzes in one day, mutes the bot before lunch, and every
> outward confirm the entire safety architecture exists to deliver goes silent —
> permanently, and invisibly, because the badge is simultaneously being buried under
> 96 rows/day of the same signal. … The correct guard already exists in this repo, in
> `core/backup.ts:67-71`, written by the same PR series, and was not copied into
> `surfaceSignal` where it would kill the whole class."
> — The Adversary

The Adversary explicitly revised his own council ranking on this: "I ranked
`marketing.ts:97` first at the council and said *'nothing is close.'* I was wrong about
the ordering, and turning the system on is what shows it. The grounding defect damages
a claim; the siren damages the *transport*."

**Cold this was arithmetic on a dormant integration. Funded it is a phone.**

### 3.2 The grounding label — the fix moved the lie, it did not close it

**Named most-dangerous-funded by the Systems Architect and the Chief of Staff, and
"close second, and it is mine and it is new" by the Product Skeptic.** Four chairs
traced the identical chain, independently, and three executed the tokenizer by hand.

The council's #1 CRITICAL was closed after the record by `609cd56`:
`groundingFromResearch` (`business/marketing.ts:64-73`) maps a model prior to `"none"`.
It is good code — the Revenue Operator notes `offers.ts:32-34` *imports* it rather than
re-deriving it, "precisely the exclusivity discipline the Systems Architect asked for."

**But every chair had only ever executed the branch where `runResearch` throws.** The
funded path:

1. `proposeAngles`/`draftOffer` call `runResearch({operator: "business"})`
   (`marketing.ts:118-124`, `offers.ts:121`).
2. `ACADEMIC_DOMAINS` includes `"business"` (`researchEngine.ts:59-60`), and the
   academic tier is **keyless** — arXiv/PubMed/Semantic Scholar/OpenAlex, raw fetch,
   **no `process.env` anywhere in `researchAdapters/openSourcesAdapter.ts`**
   (Revenue Operator's grep). It runs on an Anthropic-only key.
3. The only gate is lexical: `filterRelevant(subject, open, 0.34)`
   (`researchEngine.ts:288-297`), substring overlap on `significantTokens`
   (`relevance.ts:11-25`).
4. `results.some(r => r.source !== "llm")` → `grounding: "external"`
   (`researchEngine.ts:381`).
5. `groundingFromResearch("external", n>0, false)` returns **`"external"`**.
6. Rendered gold/emerald as **"research-backed"**
   (`frontend/app/(chrome)/business/page.tsx:777, 926-927`) under a note reading
   *"Grounded in N retrieved sources (listed below)"* — and **`sources` is persisted at
   `marketing.ts:155` and rendered nowhere on that page.**

The tokenizer, run by hand by three chairs on the real subject strings:

> ```
> subject: "what persuades parents to hire a remote athletic coach"
> tokens: [persuades, parents, hire, remote, athletic, coach]  → 3 of 6 hits passes
> → "Parental influence on youth sport participation"  PASSES
> → "Remote monitoring of athletic load"               PASSES
> ```
> — The Adversary

The Chief of Staff ran the same gate against `draftOffer`'s subject — *"how remote
coaching offers are structured and priced"* — five significant tokens, so **2 of 5
clears it**: "any paper containing 'remote' and 'structured' passes."

> "The fix I applauded moved the lie from 'your own data' to '4 retrieved sources,'
> where the sources are PubMed abstracts about adolescent athletes, retrieved for a
> question about consumer persuasion, that no layer ever checks for topical fitness."
> — Product Skeptic

> "**I expect Cole's first offer to come back labelled `external`.** … An unfalsifiable
> citation, on his price."
> — Chief of Staff

**Why the Chief of Staff ranks it above the siren:** "the siren is loud and costs one
annoyed morning. This is silent, it lands on his **price**, and it does not stop at the
screen — `runResearch` persists the synthesis to memory (`researchEngine.ts:388-400`),
where real embeddings make it retrievable into every future business turn including
outreach drafts. It survives discovery, and it compounds."

He also names the contrast that exists inside the repo already:
`learning/curriculum.ts:699-708` builds an explicit `## Sources` section and prints
*"no external source retrieved"* when there is none. "The marketing engine — the one
file whose header promises *'NOTHING IS ASSERTED WITHOUT ITS GROUNDING'* — does
neither."

**The honest caveat, from the chair who built the case:**

> "I built the 'academic external mislabel' case from a tokenizer I executed and a
> search API I did not call. If PubMed and Semantic Scholar in fact return nothing for
> that query, the label falls back to `model-only → "internal"` and the council's
> original finding stands unchanged — same severity, different mechanism. **It is one
> finding with two branches, and one live `runResearch` call decides which.** That call
> costs Cole about four cents and it should be the first thing he runs."
> — Systems Architect

### 3.3 The outreach treadmill — 21 calls/week for three human beings

All six chairs. The mechanism, verified at HEAD by four:

- `runOutreachSweep` (`crm/leadEngine.ts:236-249`) takes the **3 oldest by
  `nextActionAt`**.
- Only `finalizeOutreachDraft` (`:209-218`) advances `nextActionAt` — and only on
  Cole's confirm.
- `sourceId` is touch-numbered — `outreach:${lead.id}:${priorTouches+1}` (`:133-135`) —
  so **dedup is defeated by construction**.
- `executeAction` has **no dedup at all** — no `sourceId` guard anywhere in
  `autonomy/executor.ts:1-54` (The Adversary).

**Result: the same three names, re-drafted every morning, forever. 3 new pending Bridge
cards and 3 Sonnet calls per day; 21/week; ~90 pending cards for three people after a
month — while leads 4..n are never touched.**

And from day two, `priorTouches > 0` (`:125-131`) makes `isFollowUp` true, so every one
of those ~90 prompts contains *"This is a FOLLOW-UP. Acknowledge that lightly, add one
new thing, do not repeat the first pitch"* (`:155-156`) **about a message that was
never sent.**

The Revenue Operator drew the second-order consequence: the briefing's brand-new gated
-ask count will report *"21 things waiting on your confirm"* in week one — "and a count
that is 86% duplicates is how the new count gets ignored in week two."

### 3.4 The warm list gets damaged — and it does not regenerate

**Named most-dangerous-funded by the Revenue Operator.** He traced four independent
defects firing on the same twenty names inside week one, in the order they hit a single
lead:

> 1. `gmail/engine.ts:119` — her first-ever message from Cole arrives as **"Re: Quick
>    one, Sarah"**, a reply to a thread that does not exist.
> 2. She replies. `inboxTriage.ts` has zero Lead awareness (`grep -n "lead\|Lead"`
>    returns nothing); nothing writes `conversing`; her Lead row is untouched.
> 3. Four days later she is due again, `priorTouches > 0`, and the prompt instructs the
>    model *"This is a FOLLOW-UP… do not repeat the first pitch."* She gets a message
>    that acts as though she never wrote back.
> 4. Her sister, whom Cole only has a phone number for, was marked `contacted` on day
>    one by `:213` having been contacted by nobody (`:199` guards `draftReply` on
>    `if (to)`), and her `nextActionAt` was pushed out four days. **She will never be
>    contacted again.**
>
> "**The warm list is non-renewable and it is the only channel that works at zero
> audience.** Every other finding on my list costs time or money. This one costs the
> asset, and it costs it *hardest on the people who said yes*. Item 3 is on nobody's
> BUILD NEXT list, mine included."

The Systems Architect on the same line: "Cold it was a string. Funded it is the first
message a former athlete's parent receives from Cole's business, arriving as a forged
reply thread with `In-Reply-To`/`References` headers on a message that never existed
(`gmail/engine.ts:124`). One pass through a non-renewable list."

The Product Skeptic on the mechanics: "a reply header with no References chain. Real
Gmail will file it as a new thread titled `Re:` something that never existed" — "which
is precisely the shape spam filters score" (Chief of Staff).

**This pair — `gmail/engine.ts:119` and `crm/leadEngine.ts:199` vs `:209-218` — is the
Chief of Staff's stated, pre-registered condition for dropping to 3. Both stand
byte-identical at HEAD. That is why his number moved.**

> "The outreach lane has negative expected value while `gmail/engine.ts:119` and
> `crm/leadEngine.ts:209-218` stand, because it damages the only asset it touches. Both
> stand. The 3 follows from that sentence, and it reverts the moment those two lines
> change."
> — Chief of Staff

### 3.5 The badge — from an argument about 66 rows to a four-figure steady state

Cold, the council argued about 48 → 66 receipt rows. Funded, four chairs computed the
real slope, and they do not agree on the total because they counted different pumps.

**The Adversary's audited bypass count at HEAD** (and his correction of his own
round-2 figure): 21 `bridgeSignal.create` sites; **17 bypass `surfaceSignal`, and 12 of
those set no `status` at all** against `schema.prisma:395 @default("pending")` —
`rituals/engine.ts:90` (3/day), `autonomy/initiative.ts:137` (1/day),
`wiki/engine.ts:197`, `planning/tools.ts:174,389,517`, `knowledge/freshness.ts:116`,
`autonomy/capabilityGaps.ts:97`, `measurement/scoreboard.ts:149`,
`wealth/engine.ts:103`, `router/calendarRouter.ts:81`, `autonomy/pulse.ts:139`.
*"My round-2 figure was 18 bypassers; the audited figure at HEAD is 17, of which 12
inflate the badge. I was one high and I said the number too confidently."*

**Steady state, funded:**

| Source | Rate | Chair |
|---|---|---|
| Spine receipts (no `status`) | ~17 new pending/day, ~4 pure receipts miscounted as decisions | Adversary |
| Calendar siren (dead token) | +96/day → ~1,344 at 14-day notice expiry | Reliability Engineer |
| Inbox triage confirms | 3–7/day (Systems Architect) / 5–10/day (Revenue Operator), 30-day decision expiry | SA, RO |
| Outreach re-drafts | 3/day, no dedup, ~90/month | all |

**Systems Architect's day-30 unattended figure: ~150–300. The Adversary's with a dead
token: ~113/day. The Reliability Engineer's siren steady state alone: ~1,344.** The
council's cold number, the one it said "kills the product," was **66**.

**And the drain is broken.** Verified verbatim at HEAD by the Reliability Engineer, the
Chief of Staff and The Adversary: `queueSweep.ts:130-134` **selects**
`["pending","surfaced","noted"]`; both `updateMany` filters (`:148`, `:156`) write only
`["pending","surfaced"]`. **`noted` rows are selected every night and never written.**

The Adversary went further and found `noted` has no reader anywhere:

> "`grep -rn '"noted"'` across `aurelius/` and `frontend/` returns **six hits: the
> writer, the comment, one `queueSweep` SELECT, and three smoke assertions. No
> reader.** … **`noted` is a write-only sink.** … A bucket with a writer, no reader, and
> no collector is not a design, it is a leak."

**Disagreement preserved:** the Chief of Staff holds `noted` at `[medium]`, not high —
"the badge route counts `["pending","surfaced"]` only
(`frontend/app/api/nav/badges/route.ts:12`), so this costs rows, not attention.
Mechanism agreed, severity still `[medium]`."

**And a new permanent floor arrived with the fix.** The Chief of Staff: `609cd56` set
outward gated asks to `severity: "critical"`, and `queueSweep.ts:134` excludes
`severity: { not: "critical" }` from expiry. "So **every outward confirm Cole ignores
is now immortal** — pending, badged, forever. The muted-bridge fix bought audibility and
paid for it with a second permanent badge floor, in the same file the council spent
five reports on."

### 3.6 Cost — the tier system collapses, the meter under-reports, the alarm is dormant

**The tier collapse.** `providerConfigured` strips unconfigured providers from the chain
(`llm/router.ts:769-778`), so on an Anthropic-only key every tier falls to
`FALLBACK_MODELS.anthropic = "claude-sonnet-5"` (`:693-700`):

> "Every `fast`-tier task (`log, extract, track, quick_reply, summary, rewrite`) that
> should hit Groq at $0.59/$0.79 and every `structured` task that should hit
> `gpt-5.4-mini` at $0.40/$1.60 instead lands on `claude-sonnet-5` at $3/$15. That is
> **5× on the fast tier and 7.5× on the structured tier**, silently, forever, with the
> full 15-layer system prompt attached."
> — Systems Architect

The Revenue Operator's estimate for the funded spine: **$60–120/month, all Sonnet**,
against `docs/SCOPE.md:30`'s promised *"$20–50/mo, designed to fall over time"* — and
"the falling is supposed to come from Groq plus `semanticReuse`, and half that
mechanism is inert."

**Double injection.** `businessContextBlock()` is injected **twice** on every business
turn — router Layer 5.35 (`llm/router.ts:474-484`) **and** inline at
`leadEngine.ts:123`, `marketing.ts:115,213`, `positioning.ts:370,472` — both copies
**below `CACHE_BREAK`** (`router.ts:372`), so the full fact table plus the HARD BOUNDARY
paragraph is paid twice at fresh-input rate, on exactly the calls that now run daily.
Four chairs found this independently.

**Prompt caching does not do what the council credited.** Systems Architect:

> "Anthropic's ephemeral cache is minutes; the spine's jobs are hours apart. Essentially
> **every scheduled call is a cache *write*, never a read.** And
> `engines/anthropicEngine.ts:125-130` folds `cache_creation_input_tokens` into
> `tokensIn` at 1.0×, when a cache write bills 1.25×."

So the meter systematically **under-reports** — on a static prefix the repo's own
comment sizes at *"~21KB"* for the tool catalog alone (`llm/router.ts:353`).

**The alarm cannot warn him in time, and by default cannot warn him at all.**

- Dormant unless `LLM_MONTHLY_BUDGET_USD` is set (`llm/pricing.ts:160-166`); it is
  **blank in `aurelius/.env.example:83`** and appears in neither deploy doc.
- The 80% warning is `kind:"opportunity"` × `severity:"notice"` = **0.54, below the 0.72
  floor — it cannot reach his phone** (`measurement/spend.ts:157-160`).
- Only the 100% alarm (`risk`/`attention` = 0.805) pushes — i.e. **after the ceiling is
  breached**, once per threshold per month.
- It rides the 21:15 queue sweep (`index.ts:1735-1741`) — **45 minutes before** the
  largest spend event of the week, Sunday 22:00 curriculum ingest at
  `MAX_UNITS_PER_RUN = 14` deep research units (`learning/curriculum.ts:577`), with no
  timeout and no per-run budget check.
- Nothing throttles. Nothing in `runLLM.ts` or `router.ts` consults the ledger (grep,
  The Adversary).

> "Two of my own findings compose into something worse than either: the warning that
> could have been early is silent, and the one that rings rings late, once, on a low
> number."
> — Reliability Engineer

**And the ledger has no reader.** The Revenue Operator: `spendLine()`'s own docstring
(`measurement/spend.ts:134`) says *"One line for the doctor, the briefing, and the self
tool."* Grep for callers outside its own file: **zero.** `tools/adapters/self.ts:51`
calls `spendSummary`/`monthToDate`, not `spendLine`. "I gave credit to a ledger with no
reader."

### 3.7 Nothing retries — and funded, the failure sources are real

Four chairs, verified at HEAD. `catchUp.ts:203` calls `ranToday` **before**
`claimDailyRun` at `:207`; `ranToday` (`:165-175`) matches `schedule:<name>`, which
`markStarted` writes **before the job body runs** (`core/trace.ts:70-76`, called at
`:122`); `runCatchUp` fires **once, 45 seconds after boot** (`catchUp.ts:224-228`). Six
spine handlers swallow their own errors (`index.ts:1557,1571,1582,1596,1607,1617`), so
`finishDailyRun(name, true)` writes `"done"`.

> "Cold, no job could fail because no job did anything. Funded, the failure sources are
> real and plural: Anthropic 529s (**no retry, no backoff, no 429/529 logic anywhere in
> `engines/anthropicEngine.ts`**), Gmail quota, a 7-day Google token, Gemini free-tier
> 429s on a key doing *both* embeddings and web grounding. Each one costs the whole
> day."
> — Reliability Engineer

> "**The only saving every chair scored as real is the one thing with no retry.**"
> — Chief of Staff

And `pageFailure` (`core/trace.ts:146-148,163`) does reach him — the one channel that
bypasses salience, credited by the Reliability Engineer — to tell him *"I'll retry on
schedule."* Nothing will.

---

## 4. WHAT THE COUNCIL SCORED GENEROUSLY

Every chair was asked to answer this first. This is the quality-control section, and it
is unanimous in shape: **the council graded refusal branches and called them behaviour.**

### 4.1 The universal error: grading a guard by the only branch that could run

**The `engineUnavailableText` family.** Signed unanimously FIXED at the cold council
(`inboxTriage.ts:121`, `leadEngine.ts:161-164`).

> "I certified 'honest failure' when what I verified was 'honest *refusal*.' With no key
> those guards fire on 100% of calls, so I only ever watched them *succeed at
> rejecting*. Their false branch — a funded key returning a real draft — I never saw
> once. … **Live, the guard is a no-op on essentially every call.**"
> — Chief of Staff

> "`leadEngine.ts:164` rejects on `body.length < 30` or an engine-error string, and a
> funded Claude call clears both on every single run. The branch I verified is the
> branch that stops existing the day the key lands. **What actually protects the warm
> list is prompt quality, and that is completely untested by me or anyone.** Expect: the
> guard fires ~never; the first bad draft is a *fluent* one and nothing in the code can
> tell."
> — Reliability Engineer

> "It cannot distinguish a good draft from a fluent, confident fabrication about a
> person Cole actually knows."
> — Chief of Staff

**The grounding fix.** All six graded a pure function and stopped. The Adversary: "I
gave it credit without executing the composed path, because I couldn't." The Product
Skeptic: "I gave credit to a label whose honest branch was the only one my environment
could execute." The Revenue Operator, on his own BUILD NEXT #1: "**It does not fix the
branch Cole is actually in.**" See §3.2.

**And the smoke test for the fix reproduces the criticism it was written to answer.**

> "`smokeSuite.ts:1417-1427` tests `groundingFromResearch` in isolation, five ways, all
> correct. It never composes `runResearch` with the academic tier. It is the Product
> Skeptic's 'verified only where it is vacuous' reproduced *inside the fix for the
> defect he named it about*."
> — The Adversary

**`assertCalendarUsable()` — the Reliability Engineer's own "best-designed fix in the
set," and he retracts the grade:**

> "Its one scheduled caller is `index.ts:1556-1570`:
> `try { await runTraced(...) } catch (err) { console.error(...) }`. `runTraced` **does**
> page — credit — and then the handler swallows the rethrow, so `withDailyClaim` writes
> `finishDailyRun(name, true)` and the JobRun reads `done`. **I graded the guard and not
> its caller — the exact error I caught four other chairs making.**"

### 4.2 Draft quality — priced at zero observations by everyone

The single largest term in every leverage number the council produced, and no chair has
seen one sentence of output.

> "I priced 2–3 hr/wk gross on the assumption that a funded model produces usable
> outreach. What I actually expect: the drafts are competent English and **still
> unusable**, because `offerContextBlock()` (`business/offers.ts:278-286`) correctly
> forbids naming a price or package until Cole types one. Twenty-one drafts a week that
> open a conversation with no ask is not 2 hours saved; it's 2 hours of reading
> generated small talk."
> — Systems Architect

> "The drafts will be *competent and generic*… A competent generic message with no ask
> is exactly what burns a warm list quietly."
> — Revenue Operator

> "Reading the prompts as prose rather than as untested code, they carry real
> constraints and I expect them to produce usable text. That is genuine ceiling I was
> not able to score."
> — Reliability Engineer

**Disagreement preserved. This is the council's widest split, and it is unresolved by
construction — nobody has run it.**

### 4.3 The ~1.2 hr/wk ritual saving — the one number every chair called real

Three chairs retracted the basis.

> "With no key the 07:00 briefing is pure Postgres arithmetic and cannot be wrong; that
> is what I priced. Funded, the deterministic footers are appended *after a model voice
> pass* over the whole artifact. I have never read a voiced briefing. **The one saving
> the council treated as proven is proven only in the configuration Cole will not be
> running.**"
> — Chief of Staff

> "Funded, it acquires a voice pass over the network, in a system with no same-day
> retry."
> — Product Skeptic

### 4.4 `semanticReuse` — nobody scored it, because mock geometry meant it could never fire

Four chairs found this independently, and it is the clearest example of a defect that
**does not exist cold and exists on day two funded.**

> "The retrieval key is **the question alone**, `text: args.input`
> (`compiled/semanticReuse.ts:130`), at 0.93 similarity for 14 days. Layer 2.4 NOW
> (clock, calendar, load, grants) shapes the answer and is **not in the key**. Funded,
> 'what should I focus on today?' asked Thursday is ≥0.93 similar to Monday's and gets
> Monday's answer served with `engine: "compiled"` and `tokensUsed: 0`."
> — Systems Architect

> "`REUSABLE_TASK_TYPES` includes `"chat"` (`:29`). The only escape is `needsRealtime`,
> which is read **solely from the HTTP request body** (`index.ts:663`) and is never
> computed from message content — grep over `frontend/` returns zero source-file
> setters. So funded, **every chat turn is reuse-eligible.** Worse: `llmDependenceRate`
> *falls* when this happens, so the Sunday scoreboard reports stale-answer service as
> improvement."
> — Chief of Staff

**And the Revenue Operator found the sharpest instance of it — see §5.1.**

> "I excused it as 'mock geometry, unproven' and did not penalize it. That was generous
> in the wrong direction. **Its first real behaviour is to skip the model.** Nobody has
> ever seen it hit."
> — Product Skeptic

### 4.5 The attention layer — credited as broken plumbing, actually finished work behind one bug

> "The Telegram confirm loop — I filed it under 'unproven, no token.' I have now read
> it: `pushBridgeAsk` (`telegram/bot.ts:134-160`) builds real ✅Confirm/✖Dismiss inline
> buttons routed to the same executor as the web. It is **finished, correct work**. …
> I scored the push path as 'one arithmetic bug.' **It is one arithmetic bug standing
> between Cole and the only mobile confirm surface in the product.**"
> — Systems Architect

### 4.6 The flood nobody priced

> "I certified the [inbox triage] guard and never priced the flood. `needsReply`
> (`:27-31`) rejects only a `no-?reply|notifications?@|newsletter` regex, then accepts
> anything with an `@`. A real inbox means up to **10 Claude calls and 10 pending Bridge
> cards with Confirm buttons every morning at 05:30** — for order confirmations,
> LinkedIn, and a coach's mailing list."
> — The Adversary

The Revenue Operator added the other tail: **non-zero-inbox Cole** gets the 10 slots
filled with already-deduped messages (`inboxTriage.ts:87-92`), so "**triage silently
produces nothing, forever**, reporting `skipped: 10` to a log nobody reads."

### 4.7 The results loop — worse than hand-fed

> "`recordOutcome` has exactly one call site repo-wide (`tools/adapters/business.ts:133`,
> the chat tool). The one number `anglePerformance` claims *'arrived on its own'* —
> `_count.leads` — depends on `resolveRef`, and **nothing in `aurelius/` or `frontend/`
> emits a `/start?ref=<code>` URL.** Funded it compounds: `marketingPass.ts:82` now makes
> `leads` the **primary sort key**, and `marketing.ts:143` makes `priorEvidence` the gate
> on the `"internal"` label. **Both are structurally pinned at zero forever.**"
> — Revenue Operator

The Adversary drew the conclusion: "`groundingFromResearch(…, hasOwnResults)` can
therefore never legitimately return `"internal"`, so the gold label is dead and the
emerald one is the PubMed artifact."

### 4.8 `reachabilityAudit.ts` — all six re-ran it, all six retract the credit

`Reachability audit: clean — every capability has a live invoker.`

Clean over: a desktop-only money page · a publish lane with no image producer · a dead
grantable toggle (`systems.sop_draft`) · a confirm path that cannot ring · `spendLine()`
with zero readers · a `?ref=` nothing emits · a write-only `noted` bucket · an invented
signal kind · a source list that renders nowhere.

The Adversary's tally: **0-for-5.** The Revenue Operator's: **0-for-4, third council.**

> "It tests existence, not exclusivity."
> — Product Skeptic

### 4.9 The one thing a chair credited without being asked

> "The doctor's vector-geometry check (`core/doctor.ts:458-500`) anticipates the
> mock→real stranding precisely, including the `.env` footgun that would overwrite prod
> vectors with hash garbage. **That is the single best-reasoned function in the repo and
> I did not name it. Take it as evidence against my own score.**"
> — The Adversary

---

## 5. WHAT ONLY APPEARS LIVE

Failures a cold repo structurally cannot show.

### 5.1 A cached reply for one person, filed as the draft to another

**The Revenue Operator's find, and the sharpest new defect of the round.**

- `semanticReuse.ts:29` includes `"quick_reply"` in `REUSABLE_TASK_TYPES`.
- `inboxTriage.ts:106` uses exactly that taskType and passes **no `noReuse`**.
- `runLLM.ts:23-30` therefore consults the cache.
- Operator isolation (`semanticReuse.ts:57`) is no help — **every triage draft runs
  under `operator: "strategy"`**, so they share one bucket.
- At `SIMILARITY = 0.93` over prompts sharing a ~130-char fixed prefix and a short email
  body, two structurally similar notes ("still on for Thursday?") within 14 days will
  collide.

> "**A cold repo cannot show this: with `EMBEDDINGS_PROVIDER=mock` the geometry is
> meaningless.** And `engineUnavailableText` cannot catch it — the text is a perfectly
> good draft, for the wrong person. **The tell that this is real: the author of
> `draftOutreach` set `noReuse: true` at `leadEngine.ts:139`, so the hazard was
> understood and applied to the newer lane and not the older, higher-volume one.**"
> — Revenue Operator

### 5.2 The premise of the counterfactual is not reachable

**Product Skeptic and The Adversary, independently. This invalidates part of the
question Cole asked.**

`getEmbeddingAdapter()` (`retrieval/embeddingAdapter.ts:174-192`) offers **openai ·
gemini · mock and nothing else** — the Ollama adapter is a comment at `:189`. Anthropic
has no embeddings API. So "funded Anthropic key" and "real embeddings" cannot both be
true. Three outcomes, depending on which second key Cole buys:

1. **Gemini key** → embeddings real, **and `researchEngine.ts:47` flips `FEATURES.web`
   on**, which turns on real web search and **moots the grounding defect entirely.**
   (This is the Reliability Engineer's evaporation argument in §2.) New risk: one
   free-tier key serving both batch embeddings and every research call's web grounding,
   with both failures silent.
2. **OpenAI key** → embeddings real, web search still off, **grounding defect live**,
   and the OpenAI failover tier re-arms, changing the cost and failure profile.
3. **Neither** → `EMBEDDINGS_PROVIDER` defaults to `"openai"` with no key,
   `getEmbeddingAdapter()` returns **null**, and Layer 5.5, `/ask` sources, semantic
   reuse, compiled-pattern retrieval and decision precedent **all go dark at once behind
   one `console.error` at boot** (`:163-183`).

> "**Month one is three different systems depending on which second key he buys, and no
> chair scored any of them.**"
> — Product Skeptic

### 5.3 The vector index develops silent, permanent holes

> "`embedSourceSafe` (`retrieval/embedPipeline.ts:81-88`) is fire-and-forget with a
> `console.warn`; the row is written, the vector is not, and **nothing re-tries or
> reconciles**. `backfillEmbeddings.ts` has no scheduled invoker. The doctor's
> `checkVectorGeometry` measures *geometry* — the ratio of rows in the active model —
> not *coverage*, so **a corpus 30% unembedded reads as 100% healthy.**"
> — Reliability Engineer

### 5.4 The briefing's brand-new counter is blind to the one job it was written for

**Chief of Staff and Product Skeptic, independently.** `rituals/engine.ts:143` sets
`since = now - 12h`. The counter at `:164-176` is correct code. But `morning_briefing`
is `"0 7 * * *"` (`index.ts:1582`) and `outreach_sweep` is `"30 7 * * *"` (`:1596`).

**The 12-hour window covers 19:00→07:00. Yesterday's 07:30 outreach drafts are 23.5
hours old and fall outside it; today's have not happened yet.** So do the 08:00
initiative, the 13:00 midday check and the Sunday 16:00 marketing pass.

> "The council asked in the same breath for the counter *and* the reordering; the
> counter shipped, the reordering did not. **This is the same failure mode I conceded to
> at the last council — I read the fix and it is real; the call chain is where it dies.**"
> — Chief of Staff

Compounded by latency (The Adversary): `runInboxTriage` is a **serial** loop over 10
messages, each a `readMessage` plus a full `runLLM`, with nothing bounding wall time and
no timeout at `index.ts:1571`. If 05:30 has not finished by 07:00, the new count reads
zero.

### 5.5 The risk line inverts the day Cole does what the council told him to do

**Product Skeptic's find, and the empty sandbox structurally could not produce it.**

`importWarmList` sets `nextActionAt: new Date()` on every imported name
(`leadEngine.ts:85-88`). `whatNeedsAttention` computes `staleFollowUps` with the
**identical predicate** — `nextActionAt: { lte: now }` (`crm/service.ts:486`) — and
`staleFollowUps > 0` sits **above** `behindProjects` and above the empty-pipeline branch
in `riskLineFrom` (`productivity/service.ts:627-629`).

> "The morning after he pastes 20 names, the phone's single most important sentence
> becomes *'20 lead follow-ups are past due'* — and it stays there permanently, because
> the sweep drafts 3/day and only a confirm moves the date. **The confronting hero metric
> becomes a stuck counter within 24 hours of first real use.**"

### 5.6 A real person replying is invisible to the pipeline

`grep -n "lead\|Lead" aurelius/autonomy/workflows/inboxTriage.ts` returns **nothing**.
The only writes to `Lead.status` are `leadEngine.ts:210` (→ `contacted`) and
`crm/service.ts:124` (manual). The funnel is one-directional in code.

> "Cold, this is unobservable — nobody replies to a database with no key. **Day one: the
> moment the first reply arrives, check whether that Lead is still `contacted`. It will
> be.**"
> — Revenue Operator

### 5.7 Other live-only unknowns

- **`needsReply`'s real precision.** Systems Architect: read the 05:30 log line
  (`inboxTriage.ts:154-156`) — `scanned N · needsReply M`. "If M/N is above ~0.4,
  Aurelius is drafting warm personal replies to Amazon and Stripe."
- **Real Gmail quota and threading behaviour.** `draftReply` throws on any non-2xx
  (`gmail/engine.ts:135`); nobody has seen a 403 through this path.
- **Google's real token lifetime.** Systems Architect: "the calendar tile on `/tools`
  uses `isCalendarHealthy()`, the only honest probe in the repo."
- **Cache-hit rate and the true bill.** Compare `spendLine()` against the Anthropic
  console. ">25% higher, that's the cache-write undercount, confirmed."
- **Whether outward asks bypassing quiet hours becomes a problem.** Revenue Operator:
  `executor.ts:130-132` × `salience.ts:75-79` — correct for a confirm Cole triggered at
  4pm; "if any outward class ever gains a scheduled invoker, it rings at 3am. Not a
  defect today; a watch item."

---

## 6. REAL ARCHITECTURE — WHAT MONEY CHANGES NOTHING ABOUT

**The exclusivity defect.** `surfaceSignal` governs a minority of writes to the table it
declares authority over. The Systems Architect re-ran the count mechanically to settle
his own error: **21 create sites; 17 outside `core/bridge.ts` and
`autonomy/executor.ts`; 12 of those set no `status` at all.**

> "My blind figure was 11; the RE said 13; the Adversary said 18. **Three chairs
> measured three different things and all three were internally right, which *is* the
> finding.** `schema.prisma:391-394` now instructs future authors to 'prefer' the helper.
> **Advice is not a seam.**"
> — Systems Architect

**And the shape reproduced itself again, three hours after the council closed.**
`32c2446` shipped `business/marketingPass.ts` with `sourceId: "marketing:no_offer"` under
the comment *"Deduped by source id"* (`:52-53`) — into a `surfaceSignal` that has no
dedup.

> "That is the **fourth** comment in this repo asserting a mechanism the code does not
> implement, and the first one written after a council spent a section naming the
> pattern."
> — Systems Architect

**And that same file invented a seventh signal `kind`.** The Adversary:
`marketingPass.ts:49,111` write `kind: "recommendation"` — a value appearing **nowhere
else in the repository**, absent from `schema.prisma:378`'s vocabulary, absent from
`KIND_WEIGHT` (`salience.ts:29-35`, so it silently scores 0.4), and absent from
`needsDecision` (`bridge.ts:69`, so it defaults to `"noted"`).

> "Consequence: the weekly **'No offer — so nothing to write toward'** nudge — **the one
> line in this system that names the single blocker on the entire business** — is filed
> at a status no surface reads and no sweep expires."

**Unchanged, verified at HEAD by multiple chairs:**

- **`gmail/engine.ts:119`** — unconditional `Re:` prefix. Two councils, unmoved.
- **`crm/leadEngine.ts:199` vs `:209-218`** — `draftReply` guarded on `if (to)`;
  `status:"contacted"` written unconditionally. A CRM recording contact that did not
  occur.
- **`outreach.draft` and `inbox.triage_draft` have no registered inverse.**
  `registerActions.ts` registers inverses at `:24`, `:47`, `:97` only. The two
  highest-volume gated classes are not among them, while `executor.ts:91` files
  *"Reversible — tell me if this was wrong."* **A NORTH_STAR §2.5 violation in the newest
  grantable class** (Chief of Staff).
- **`/business` has one nav reference repo-wide**
  (`frontend/lib/operators/operatorRegistry.ts:51`) — absent from `MobileTabBar.tsx:13-19`
  TABS and every `also`, absent from `more/page.tsx` GROUPS. The warm list, the offer
  price, the angle panel and the content queue all live behind that door.
  **Disagreement preserved:** the Revenue Operator *revised his own severity down* —
  "the Chief of Staff's mechanical correction was right and I should have taken it. The
  nav gates the one-time paste; Decisions is tab 2 and carries the confirms. **HIGH, not
  CRITICAL. I raised it to CRITICAL partly because it was the most auditable thing on my
  list.**"
- **`getBiggestRisk` (`productivity/service.ts:686-715`) omits
  `hasActiveOffer`/`draftOffers`.** The deck passes it; the phone does not. **The phone
  still cannot say "you have no offer."**
- **`draft_outreach` renders and does nothing.** `crm/leadEngine.ts:373` attaches
  `{ label: "Draft a reply", action: "draft_outreach" }`; `home/page.tsx:46-47` matches
  only `confirm_action` and `undo_action`. It exists as a *chat tool*
  (`tools/adapters/crm.ts:177,331`) — "which is why the grep looks alive and the button
  is not" (Chief of Staff, who opened the file after the Product Skeptic declined to
  co-sign the citation).
- **The media host has no producer.** `hostBytes`/`hostLocalFile` (`media/host.ts:136,149`)
  have **zero production callers**. The only writer of `ContentDraft.imageUrl` is a text
  box on the desktop-only business page. **This invalidates a premise of the
  counterfactual: setting `MEDIA_PUBLIC_BASE_URL` only lets the doctor say `live`**
  (Systems Architect). Worse: a Tailscale `*.ts.net` URL passes
  `resolvePublicMediaUrl`'s private-network check (`:167-180`) and then fails opaquely at
  Meta.
- **The backup does not probe its mount.** `core/backup.ts:40` recreates a dropped NAS
  mount point on local disk and `pg_dump` succeeds into it. And `runDbBackup` **returns**
  `{ok:false}` at `:93` rather than throwing, so `runTraced` writes `status:"ok"` and
  `pageFailure` never fires.
- **`planWeekLite` still creates no calendar blocks** — `grep createEvent|insertEvent` →
  zero hits. **Third council. It is the sentence NORTH_STAR chose to define
  advisor→operator.**
- **`systems.sop_draft`** — one grep hit repo-wide (`actionClasses.ts:74`), still on the
  Autonomy dial. Fourth council.
- **No P&L on either side.** `measurement/scoreboard.ts` returns nothing for
  `grep -n "revenue\|invoice\|payment\|lead\|client"`. Revenue Operator: "the finding
  that gets worse purely with *time* — inert at zero leads and actively misleading at
  twenty."
- **`docs/SCOPE.md:29-32`** — *"~5 hrs/week back," "$1–2k/mo VA," "Break-even: 2–4
  months," "$20–50/mo."* **Byte-identical. Sixth council.** Product Skeptic: "A funded key
  makes this **more** dangerous, not less, because month two is when reality arrives to
  disagree with it."
- **No price in `Offer.priceCents`, no audience answer (`profile.ts:249-255`), no payment
  rail.** All three are Cole's inputs, not the code's.

**And the meta-finding, from the Revenue Operator, that the round kept proving:**

> "HEAD is `e6677cb`. Five files are modified and uncommitted: **BUILD NEXT items 1 and
> 2, unlanded, while the council record describing them as unfixed is the newest
> commit.** … This is the defect that reproduced itself between the council closing and
> me being asked this question."

The Chief of Staff, auditing later: "The tree moved *again while I was auditing it*. I
opened on `e6677cb`; `609cd56` landed mid-session. **A council that has now been outrun
by its own repo three sittings running is measuring its reading speed.**"

The Product Skeptic's closing line stands for the round: "**My sharpest cold finding was
that shipping has outrun verification. Funding does not touch that, and it is the finding
under which every other one on this page recurs.**"

---

## 7. THE DAY-ONE WATCHLIST

Consolidated from all six chairs, ranked by how fast a bad reading costs something
irreversible.

### Before you start anything

**0. Set `LLM_MONTHLY_BUDGET_USD`.** It is blank in `.env.example:83` and in neither
deploy doc, and `checkBudget` is dormant without it. **It is the difference between a
meter and no meter** (Systems Architect, Product Skeptic, Chief of Staff).
*Bad reading:* nothing — it will silently do nothing all month.

**0b. Take the Google OAuth consent screen out of Testing mode.**
> "That single setting is the difference between [the siren] firing weekly and never."
> — Revenue Operator

### First 60 minutes

**1. `npx tsx scripts/doctor.ts` — read the `retrieval / vector index` row.** The
Adversary calls it "the best-written check in the repo and it will tell him in one line
whether he has a memory."
*Bad reading:* `[embeddings] DISABLED` in the boot log. Half the prompt layers are running
empty and you bought a key that does not power them (§5.2).

**2. Run `propose_angles` once. Then read the row, not the screen.**
`SELECT grounding, sources FROM "MarketingAngle" ORDER BY "createdAt" DESC LIMIT 1;`
> "That single query settles §3 defect #1 in a way six chairs could not."
> — Systems Architect

*Bad reading:* `grounding = 'external'` with arXiv/PubMed URLs about adolescent athletes
under a gold **"research-backed"** badge. The page will not show you the sources — the
note says *"(listed below)"* and nothing is listed below. **Cost: about four cents.**

**3. `grep '\[ROUTER\] anthropic/claude-sonnet-5' ` the boot logs on a `quick_reply` or
`summary` task.**
*Bad reading:* it's there. The tier system is collapsed and every cost estimate in every
doc is wrong by 5×.

### Before the outreach sweep runs twice

**4. Read the Subject line of the first Gmail draft.**
> "**If it starts `Re:`, stop the sweep — the warm list is non-renewable.**"
> — Chief of Staff

Four chairs independently made this the highest-urgency irreversible item. Do it before
you confirm anything.

**5. Before you paste the warm list, know what it does to the phone.** The morning after,
the hero risk line will read *"20 lead follow-ups are past due"* and stay there
permanently (§5.5). And any name you have only a phone number for will be marked
`contacted` by nobody and rotated out of the sweep forever.

### First 24 hours

**6. Record `needsYou` at 08:00 and again at 20:00.**
*Bad reading:* delta > 10 (Adversary) or > 20 (Reliability Engineer). The pump is
winning. If it is ~96, the calendar siren is on.
Query: `SELECT status, count(*) FROM "BridgeSignal" GROUP BY 1;`

**7. Count Telegram messages.**
*Bad reading:* more than ~5 non-briefing pushes, or the same calendar text twice.
> "Reconnect immediately — and note that **muting the bot mutes every outward confirm
> with it.**"
> — Reliability Engineer

> "Disconnect Telegram or fix the token before the muting reflex forms. **That reflex is
> permanent.**"
> — Product Skeptic

**8. `grep 'compiled reuse' ` the server logs.** Line to watch:
`[AURELIUS][LLM] compiled reuse (…% match) — no model call` (`llm/runLLM.ts:31`).
*Bad reading:* **any** hit on a today/this-week-shaped question, or on any triage run.
> "If it ever prints [on triage], disable reuse for `quick_reply` before opening the
> drafts."
> — Revenue Operator

**9. Read the 05:30 triage log line** (`inboxTriage.ts:154-156`): `scanned N · needsReply M`.
*Bad reading:* M/N above ~0.4 — it is drafting warm personal replies to Amazon and
Stripe. Or `skipped: 10` — triage is silently producing nothing.

**10. Check whether the 05:30 job finished before 07:00.**
*Bad reading:* it did not. The briefing's new gated-ask count reads zero and the fix that
just landed reports nothing.

### First 72 hours

**11. Morning two, the real bill:**
`SELECT model, sum((context->>'costUsd')::numeric) FROM "LogEntry" WHERE type='llm_call' AND "createdAt" > now() - interval '1 day' GROUP BY 1;`
*Bad reading:* compare to the Anthropic console on day three. **>25% higher = the
cache-write undercount, confirmed.**

**12. Open Gmail drafts at +72h.**
*Bad reading:* 9 drafts for 3 names. The treadmill is confirmed live.

**13. Do the same three lead names appear in Bridge cards on two consecutive mornings?**
*Bad reading:* yes. Same defect, faster confirmation.

**14. Did the 07:00 briefing arrive, all seven days?**
*Bad reading:* one silent miss. That is the retry hole, and **nothing will tell you.**
After any `pageFailure` page: `SELECT * FROM "JobRun" WHERE day = today` — if the failed
job reads `done`, the finding is live.

### Week two

**15. The eighth day, when the Google token expires.** The Adversary named this as its own
watch item. This is when the siren, the mute reflex, and the silencing of every outward
confirm all happen at once.

**16. The first time a warm lead replies:** check whether that Lead row is still
`contacted`. It will be.

---

## APPENDIX — THE FIVE-TO-SEVEN LINES

Four chairs independently converged on nearly the same short list, and each said their
own score reverts on it. Recorded here because it is the most actionable output of the
round, not because the council endorses it as a plan.

| Edit | File | Closes |
|---|---|---|
| A 24h `(sourceType, sourceId)` `findFirst` in `surfaceSignal` — the guard already exists at `core/backup.ts:67-71` | `core/bridge.ts:73` | The siren; the whole class, not the instance |
| An `isReply` / `newThread` flag through `draftReply` | `gmail/engine.ts:119` | The forged `Re:` thread |
| `throw` when `to` is falsy | `crm/leadEngine.ts:199` | Phone-only leads retired by nobody |
| Add `"noted"` to both `updateMany` filters — **in the same commit as any schema-default change** (Reliability Engineer's binding warning) | `queueSweep.ts:148,156` | The immortal bucket |
| Refuse `"external"` unless a web tier actually ran | `researchEngine.ts:381` | The academic-noise citation |
| Render `MarketingAngle.sources` — one `<ul>` | business page | Makes *"(listed below)"* true |
| Swap the 07:00 / 07:30 schedule times | `index.ts:1582,1596` | The briefing counter that cannot see the sweep |
| A reader for `noted`, **or delete the status** | — | The Adversary's addition: "a bucket with a writer, no reader, and no collector is not a design, it is a leak" |

> "That is under three hours total, and none of it is an engine."
> — The Adversary

> "Forty minutes of work makes this a 5."
> — Chief of Staff

> "**Five is what I will pay for code I have read. Six is what it earns after one clean
> week on the Mini with nothing uncommitted — and that week has never happened.**"
> — Revenue Operator
