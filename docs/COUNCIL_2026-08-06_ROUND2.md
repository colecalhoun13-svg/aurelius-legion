# COUNCIL — 2026-08-06, ROUND 2

**Six chairs re-audited AURELIUS after five PRs (A–E) responded to the first council's
unanimous 3/10.** Each chair audited blind, then read the others and revised under
cross-examination. This document is the record of that second pass.

Chairs: **Systems Architect · Reliability Engineer · Revenue Operator · Chief of Staff ·
Product Skeptic · The Adversary.**

A standing caveat that belongs at the top, because it conditions everything below: **the
repository moved while the council was reading it.** The brief named `e471464` as the
newest commit and told six chairs to audit it hardest. By the time the arguments closed,
HEAD was `3c1c9cc`, with `e62d09f` (the Offer artifact) and `28c1189` (the content queue)
in between, three migrations applied the same day, and an eighth uncommitted change set in
the working tree (`business/marketingPass.ts` untracked; `index.ts`, `core/schedule.ts`,
`smokeSuite.ts` modified). Several unanimous findings in this report were true when written
and stale by the time they were argued. Those are marked.

---

## 1. VERDICT

### Score

| | Blind | Revised |
|---|---|---|
| Systems Architect | 4 | **3** ▼ |
| Reliability Engineer | 3 | **3** = |
| Revenue Operator | 4 | **4** = |
| Chief of Staff | 4 | **4** = |
| Product Skeptic | 4 | **4** = |
| The Adversary | 4 | **4** = |

**Range 3–4. It landed at 4, with two dissents at 3.** The first council was unanimous at
3/10. The movement is real but it is **half a point of substance wearing a full point of
optimism**, and it is not unanimous: the two chairs whose standard is "what does this
machine do unattended" (Reliability Engineer) and "does the structure stop this recurring"
(Systems Architect) both sit at 3, and the Systems Architect *moved down* after reading
the others.

**Is the movement earned?** Partly, and the honest split is this:

- **Earned:** for the first time in this repo's history there is a literal, traceable path
  from the code to a dollar. Every chair traced it independently and every chair agreed it
  exists. The Product Skeptic put it plainly: *"last council the honest verdict was 'it
  cannot cause a dollar,' and that sentence is no longer true."* The highest-consequence
  defect on the last list — `proposeOffer` aimed at the athletes of the gym that employs
  Cole — is genuinely closed, and closed at the seam rather than the strings.
- **Not earned:** the two defects the first council called most likely to kill the product
  — the badge that cries wolf, and the money page with no door on a phone — are the two
  that did not get fixed. The attention layer *regressed*: no gated ask can reach Cole's
  phone at any hour, verified arithmetically by four chairs and confirmed against live rows
  by a fifth. And PR-E introduced a new defect that three chairs rank above everything on
  the old list.

The Reliability Engineer's objection to the consensus 4 is the sharpest thing said about
the score: *"The honest reading is that the ceiling rose and the floor fell, and a score is
not a ceiling."*

### The three questions, straight

**1. Is this a second operator, or an expensive toy?**

**Neither yet — it is a correctly-built operator with no working mouth.** The acting layer
widened for the first time in months: `outreach.draft` is a complete action class (declared
inward at `actionClasses.ts:106`, finalizer at `registerActions.ts:31`, unconditional
`executeAction` at `leadEngine.ts:130`, scheduled invoker at `index.ts:1596`, catch-up entry
at `catchUp.ts:66`), and unlike `research.ingest` its trust flywheel can actually turn. But
**it cannot tell Cole it did anything.** `executor.ts:118` hardcodes `severity: "attention"`
on every gated ask, `kind: "background_result"` at `:113`; `SEVERITY_WEIGHT.attention = 0.7`,
`KIND_WEIGHT.background_result = 0.4`; `0.7×0.65 + 0.4×0.35 = 0.595`; `shouldPushNow`
requires `≥ 0.72` (`salience.ts:79`). The Systems Architect executed it rather than reading
it: **`score 0.595 → push false`**. The Product Skeptic settled it in the database and found
four real rows — `content_publish_request`, `attention`, `background_result`, `pending` —
which is the **outward Instagram publish confirm**, the single highest-consequence ask this
system can produce, filed at a salience that can never ring.

**2. Does it double Cole's capacity, or add to his load?**

**It adds.** All six chairs scored it net-negative to break-even at full fuel and full grant:
Systems Architect 2–3 hr/wk gross ceiling against an unpriced maintenance floor; Reliability
Engineer "negative-to-zero today"; Revenue Operator "still negative to break-even"; Chief of
Staff −1.0 to −2.5 hr/wk; Product Skeptic −1.4 to −1.9 hr/wk; Adversary "roughly break-even,
±1.5."

What changed is **composition, not sign** — and every chair said so in their own words. The
Systems Architect: *"the hours it does consume are pointed at the binding constraint instead
of at task hygiene."* The Reliability Engineer: the outreach sweep is *"capacity created, not
capacity freed."* The Chief of Staff's is the sharpest framing, and it inverts the ledger:
**an item Cole must go looking for costs full review time and returns zero**, because the
fraction he finds is set by his memory, not by the system. Every leverage number this council
produced silently assumed he sees the output. He does not.

The Chief of Staff also dissented from the unit itself: *"six ledgers, six numbers between
−2.5 and +0.5 hr/week, all arithmetic on assumptions about a man nobody has observed using
this system, with zero grants, zero leads and no key… six chairs answering it in hours is how
a council mistakes precision for judgment."*

`docs/SCOPE.md:30-32` still claims **"~5 hrs/week back"**, **"stands in for the load of a VA
($1–2k/mo)"**, **"Break-even: 2–4 months."** Flagged by four chairs at the first council,
byte-identical after five PRs, flagged by all six now.

**3. Is there a path to a dollar, and where does it break?**

**Yes — for the first time — and it breaks in five verified places.** The path, as traced
independently by every chair:

`/business` (desktop) → warm-list paste → `importWarmList` (`leadEngine.ts:58`) → `Lead` with
`nextActionAt: now` → 07:30 `outreach_sweep` (`index.ts:1596`) → `draftOutreach` →
`executeAction("outreach.draft")` → gated Bridge card → Cole confirms → `finalizeOutreachDraft`
(`leadEngine.ts:194`) → `draftReply()` writes a **Gmail draft** → Cole opens Gmail and sends
by hand → reply → Client → Engagement → Invoice → Payment (proven over real HTTP last council).

The breaks, in the order Cole hits them:

1. **The one-time entry point is desktop-only.** `/business` has exactly one nav reference in
   the entire frontend — `frontend/lib/operators/operatorRegistry.ts:51` — rendered behind
   `hidden md:flex` (`Sidebar.tsx:34`). Not in `MobileTabBar.tsx:14-19` TABS or its `also`
   list; not in `more/page.tsx` GROUPS, which still carries at line 6 the comment *"Nothing
   lives ONLY here — this is a listing, never a burial."*
2. **The draft never reaches his phone.** Arithmetic above. The 07:00 briefing's only
   draft-counting line filters `sourceType: "inbox_triage"` (`rituals/engine.ts:148`) and
   fires **thirty minutes before** the 07:30 sweep that makes the drafts.
3. **The first message is a forged reply thread.** `gmail/engine.ts:119` —
   `const subject = input.subject.startsWith("Re:") ? input.subject : \`Re: ${input.subject}\``
   — unconditional, against `leadEngine.ts:203` passing `` `Quick one, ${first}` ``. Every
   first-contact warm-list message ships as **"Re: Quick one, Sarah"** to someone who has
   never emailed him.
4. **Email-less leads are marked contacted having been contacted by nobody.**
   `leadEngine.ts:199` guards `draftReply` on `if (to)`; `:210-218` writes
   `status: "contacted"`, `lastContactAt: now`, `nextActionAt: +4d` **unconditionally**.
   `importWarmList` explicitly permits name-only entries.
5. **There is nothing to sell.** `activateOffer` correctly refuses an unpriced offer
   (`offers.ts:240-247`) and `offerContextBlock()` correctly returns *"There is NO ACTIVE
   OFFER. Do not invent one"* (`:278-286`) until Cole types a number. Until then all 21
   drafts a week open conversations that cannot close.

No payment rail — `"stripe"` is still an enum string. Correctly deferred by all six chairs.

---

## 2. DID THE FIXES HOLD

The most important section. Verdicts are the council's, with the chair(s) who verified and
the evidence they cited. Where chairs disagreed, both readings are shown.

| # | Previously-found defect | Verdict | Evidence |
|---|---|---|---|
| 1 | `proposeOffer` aimed at the employer's athletes (first council's #1 critical) | **FIXED** | Unanimous, 6/6. Literals gone; `positioning.ts:359-363` researches *"how independent coaches structure and price REMOTE/online athletic coaching offers"*; prompt at `:371-378` says *"Never write an offer aimed at the athletes at the gym that employs him."* Fixed at the seam: `businessContextBlock()` (`positioning.ts:279-308`) hoists the `BOUNDARY` **above** the fact-table read so it survives an empty or failing `knownFacts()` (`:290-291`). Regression-tested at `smokeSuite.ts:1283-1286`. Adversary: *"the best work in the five PRs."* |
| 2 | `schedule_protection` acts on a phantom calendar | **FIXED** | Unanimous. `assertCalendarUsable()` (`calendar/engine.ts:309-332`) checks connection **and** sync freshness via a `calendar_last_sync_ok` marker, and is called from **inside** `findAvailability` (`:424`), not bolted onto the caller that forgot. The comment at `:337-341` explicitly rejects an opt-out flag because *"an opt-out is precisely how the guard got missed."* Reliability Engineer, whose standard is hardest here: *"the best-designed fix in the set."* Two residual holes he flagged: `:318` and `:323` `return` rather than throw, so a deploy where sync has never succeeded still computes availability from an empty table. |
| 3 | `inboxTriage` files engine-error text as a Gmail draft | **FIXED** | Unanimous. `inboxTriage.ts:17` imports the guard; `:121` rejects `!replyBody \|\| replyBody.length < 12 \|\| engineUnavailableText(replyBody)`, throwing inside `prepare()` so no signal is created; the loop catches per-item (`:145-148`). `leadEngine.ts:161-164` applies the same guard with a stricter 30-char floor. |
| 4 | Budget alarm blind on the OpenAI failover tier | **FIXED — and generalised** | `pricing.ts:82-83` adds `gpt-5.4-mini` and `gpt-5.4`; `router.ts:674-681` exports `routableModels()` enumerating tiers, aliases and both fallback maps; `smokeSuite.ts:1367-1374` fails the suite on any unpriced routable model. Reliability Engineer: *"the only fix that prevents recurrence rather than an instance. Credit."* |
| 5 | `chatCompiler` files provider-error text as compiled understanding | **NOT FIXED** | `compiled/chatCompiler.ts:31` still `MIN_ANSWER = 60`; no `engineUnavailableText` import in the file. `"Anthropic engine is not configured. Missing ANTHROPIC_API_KEY."` = 62 chars, still clears by two, still reaches Layer 5.4 of every subsequent prompt. Found by Reliability Engineer, Revenue Operator, Chief of Staff, Product Skeptic. Reliability Engineer: *"PR-A's commit says 'these six'; this was the seventh."* The Adversary explicitly declined to endorse without re-opening the file. |
| 6 | The needs-you badge counts receipts as decisions | **NOT FIXED — backfill only** | Unanimous on the mechanism. `needsDecision` (`core/bridge.ts:58-71`) is correct code, consulted **only** inside `surfaceSignal` (`:79`), while raw `prisma.bridgeSignal.create` writers omit `status` against `schema.prisma:395 @default("pending")`. Proven by query, not argument: migration `20260806120000_signal_receipts_vs_decisions` finished **19:01:57**; Systems Architect found `pending` rows titled "Nightly debrief" 22:24:35, "Weekly scoreboard" 22:24:33, "Morning briefing" 22:24:29; Chief of Staff measured ritual ×19 / wiki ×6 / mission ×6 all with `min(createdAt) ≥ 19:05:44`; Product Skeptic watched the badge grow **48 → 66 while the council was sitting**; the Adversary measured `ritual` pending at **42, max createdAt 23:08:02**. The commit's claim — *"a new writer that forgets the field cannot inflate the badge"* — is false as written. `schema.prisma:391-394` now *documents* the defect and instructs future authors to "prefer" the helper. Systems Architect: *"Advice is not a seam."* |
| 6b | Badge corollary: receipt expiry | **REGRESSED** | Found by the Reliability Engineer alone; verified independently by Product Skeptic and the Adversary. `knowledge/queueSweep.ts:126-131` adds `"noted"` to the candidate `findMany` under a comment saying receipts *"must still age out or they accumulate forever (468 rows had already)"* — and **both** `updateMany` filters, `:148` and `:156`, are `status: { in: ["pending","surfaced"] }`. Noted rows are selected and never written. Before PR-B a ritual receipt expired at 14 days; after PR-B it never expires. **Contested severity — see §4E.** |
| 7 | Executor bypasses salience on the gated-push path | **REGRESSED** | The routing was added (`executor.ts:145-150`) and the gate never opens. `executor.ts:118` hardcodes `severity: "attention"`, `:113` `kind: "background_result"`, `dueAt: null`. Score `0.595`, threshold `0.72` (`salience.ts:75-79`). Systems Architect **executed** it: `score 0.595 push false`. Product Skeptic **queried** it and found four live `content_publish_request` rows in exactly that shape. Verified independently by Reliability Engineer and Chief of Staff. The council asked for batching; what shipped is suppression. The finalize branch (`executor.ts:54-106`) still never pushes at all, so the inversion is now, in the Systems Architect's words, *"silence under grant, silence without it."* **Revenue Operator, Product Skeptic and the Adversary all marked this `[fixed]` blind; all three conceded.** |
| 8 | A failed spine job permanently consumes the day | **NOT FIXED — the fix is inert** | Found by the Reliability Engineer; conceded by Systems Architect, Chief of Staff, Product Skeptic and the Adversary, all of whom had graded it fixed or partial. `claimDailyRun` does reclaim `"failed"` (`schedule.ts:85-96`) and the smoke asserts it (`:1611`). It cannot fire, for **two independent reasons**: (a) every spine handler in `index.ts` swallows its own error — `try { await runTraced(...) } catch (err) { console.error(...) }` at `:1557, :1571, :1582, :1596, :1607, :1687` — so the handler always resolves and `finishDailyRun(name, true)` writes `"done"`; three jobs are worse (`weekly_scoreboard`, `db_backup`, `queue_sweep`) and don't `await` `runTraced` at all, so they are `done` before the work starts. (b) `catchUp.ts:203` short-circuits on `ranToday()` **before** `claimDailyRun` at `:207`, and `ranToday` matches any trace row with message `schedule:<name>`, which `markStarted` writes *before the job body runs* (`trace.ts:70-76, 122`). Any job that started today is un-catchable today, failed or not. Reliability Engineer: *"Same-day retry is architecturally absent by design."* |
| 9 | "Hero metrics confront, never flatter" — `riskLineFrom` business branch | **PARTIAL** | The branch is real (`productivity/service.ts:599-680`) and the **deck does pass it** — `:541` `const businessRisk = await businessRiskInputs().catch(() => undefined);`, `:542` `riskLineFrom(today, behindProjects, overdueTotal, businessRisk)`, landed in `e62d09f`. Two live defects remain: (i) **the phone is the blind surface** — `getBiggestRisk` (`:696-715`) builds its business object **without `hasActiveOffer`/`draftOffers`**, so the *"you have no offer defined"* branch (`:653-667`) can never fire in the briefing (Revenue Operator, Product Skeptic, Chief of Staff, Adversary); (ii) **ranking** — `business?.empty` sits below `behindProjects`, `overdueTotal >= 3`, `followThrough < 50` and `overdueTotal > 0`, so for an employed man whose system generates tasks, one overdue checkbox suppresses *"your pipeline is empty — that's the fire"* indefinitely. **The Systems Architect reported this backwards and was caught — see §9.** |
| 10 | Two dead grantable toggles (`content.draft`, `systems.sop_draft`) | **HALF FIXED at HEAD, stale finding** | Five chairs reported both dead. The Revenue Operator disproved half of it: `grep -rn 'actionClass: "' aurelius` returns `tools/adapters/content.ts:112: actionClass: "content.draft"`, added in `28c1189`, with a finalizer at `registerActions.ts:35` **and** a registered inverse at `:47`. The Systems Architect independently found the same work in-tree. **`systems.sop_draft` (`actionClasses.ts:74`) remains genuinely dead — one grep hit repo-wide, zero `executeAction` sites, still rendered on the Autonomy dial.** |
| 11 | Trust flywheel dead for `research.ingest` / `knowledge.apply_proposal` | **NOT FIXED** | `initiative.ts:114` still reaches `executeAction` only inside `if (granted && …)`; `queueSweep.ts:71` still `if (grantLive)`; `proposals.ts:169-170` only inside `if ((await decideAction(...)).finalize)`. Neither can emit an `action:confirm:` trace, so `suggestNextGrant`'s `confirmed >= 3` bar (`trustLedger.ts:69`) is structurally unreachable for both. Systems Architect, Revenue Operator, Adversary. |
| 12 | `/business` unreachable on a phone | **NOT FIXED — and now materially worse** | Unanimous. One nav reference repo-wide (`operatorRegistry.ts:51`), behind `hidden md:flex`. Three subsequent PRs then built the warm list, the per-lead draft buttons, the offer panel, the marketing engine and the content queue onto it. Severity raised from MEDIUM (first council) to CRITICAL by the Revenue Operator. **Contested priority — see §4C.** |
| 13 | `docs/SCOPE.md` ROI claims | **NOT FIXED** | Unanimous. Lines 30–32 byte-identical after five PRs: *"stands in for the load of a VA ($1–2k/mo)"*, *"~5 hrs/week back"*, *"Break-even: 2–4 months."* Fifth council to name it. |
| 14 | Extend `reachabilityAudit.ts` (first council build item #12) | **NOT FIXED** | Unanimous. It still runs clean — every chair who ran it got *"clean — every capability has a live invoker"* — over a desktop-only money page, an unscheduled marketing engine, a dead `systems.sop_draft`, an intake endpoint with no form, and a publish confirm that cannot ring. Adversary: *"0-for-4 again."* Product Skeptic: *"0-for-4 for the second council running, and the fix everyone recommends is to add more checks of the same kind to the same tool."* |
| 15 | Revenue on the Sunday scoreboard | **NOT FIXED** | `grep -n "revenue\|invoice\|payment\|lead\|client" aurelius/measurement/scoreboard.ts` → **no output** (Revenue Operator). Sunday still reports corpus docs while revenue is $0. |
| 16 | DoD headline test: *"plan my week" completes with created time-blocks* | **NOT FIXED** | `planning/tools.ts:267-402` still writes only a `RitualInstance` and a `BridgeSignal`; `grep createEvent\|insertEvent planning/tools.ts` → zero hits. Untouched by all five PRs. Reliability Engineer, Product Skeptic, Adversary. The sentence NORTH_STAR chose to define the advisor→operator crossing has now survived two councils. |
| 17 | Cache-write token undercount | **NOT FIXED** | `anthropicEngine.ts:127-130` still folds `cache_creation_input_tokens` into `tokensIn`; `tokensCachedIn` is only `cache_read_input_tokens` (`:132`), so cache writes are priced at 1.0× instead of 1.25×. Reliability Engineer. |
| 18 | Backup failure alerting | **PARTIAL** | `backup.ts:80-90` is now `critical`, routed through `surfaceSignal` so it pushes in quiet hours, carries `acknowledge`, and is **deduped per day** via a `findFirst` guard at `:67-71`; `queueSweep.ts:135` exempts `critical` from expiry. All correct. But `runDbBackup` **returns** `{ok:false}` rather than throwing (`:93`), so `runTraced` writes `status:"ok"`, `pageFailure` never fires, and the JobRun is `done`. Reliability Engineer. |
| 19 | Backup onto a dropped NAS mount reports success | **NOT FIXED** | `backup.ts:40` `fs.mkdirSync(BACKUP_DIR, { recursive: true })` recreates the mount point on local disk and `pg_dump` succeeds into it. No mount marker, no free-space check. Reliability Engineer. |
| 20 | `pageFailure` says *"I'll retry on schedule"* | **NOT FIXED — and it is a lie** | `core/trace.ts:163` unchanged. Given #8, retry is reachable only via `runCatchUp`, invoked once at boot (`index.ts:1774`), and blocked by `ranToday` anyway. Chief of Staff, Adversary. |
| 21 | `AWAITING_DECISION` exported to stop four inline copies drifting | **NOT FIXED** | `grep -rn AWAITING_DECISION` finds it used **only** in the smoke suite; `frontend/app/api/nav/badges/route.ts:12` and `rituals/engine.ts:148` still carry inline arrays. Raised by the Reliability Engineer; the Systems Architect argued it belongs in the structural finding rather than the footnotes. **The Adversary explicitly declined to endorse it without re-opening the file** — *"the kind of grep-shaped claim that this council has now been wrong about twice in one night."* |
| 22 | *"a public POST /api/leads"* was under **Explicitly NOT next** at the first council | **BUILT ANYWAY** | Revenue Operator. `/intake` (`index.ts:200-224`) shipped despite the first council's instruction that *"capture without demand is the same error the CRM already made, one layer up."* |

**Summary of the fix ledger: 4 clean fixes, 3 partials, 12 not-fixed, 2 regressions.** Every
clean fix except the pricing one is a *correctness* fix. Every regression is on the attention
layer.

---

## 3. WHAT THE FIVE PRs BROKE

Defects **introduced** by PRs A–E (and, where noted, by the three change sets that landed
after the council's brief was written).

### Critical

**1. A model prior is relabelled as Cole's own data — 6 of 6 chairs, the council's one
unanimous new defect.**

`research/researchTypes.ts:59` declares `grounding: "external" | "model-only"`;
`researchEngine.ts:381` emits only those two. **There is no `"internal"` in the research
engine's vocabulary.** Two consumers re-map it:

```
marketing.ts:97   grounding = res?.grounding === "external" ? "external" : "internal"
offers.ts:127     grounding = res?.grounding === "external" ? "external" : "internal"   // character-identical
```

`"internal"` prints as *"Grounded in your own corpus and prior results — not external
research."* (`marketing.ts:43`) and renders in the UI in gold as **"from your own data"**
(`business/page.tsx:907-908`, and `:758-759` for the offer). `marketing.ts:102` /
`offers.ts:132` compound it by downgrading an `external` result with zero source URLs to
`"internal"` rather than `"none"`. The honest `"none"` label — *"NOT RESEARCH-BACKED… a
plausible guess"* — is reachable **only when `runResearch` throws or returns engine-error
text**, i.e. only when there is no key. `marketing.ts:105/107` closes the last crack
(`if (priorEvidence && grounding === "none") grounding = "internal"`).

Web retrieval requires `TAVILY_API_KEY` or `GEMINI_API_KEY` (`researchEngine.ts:47`). **On an
Anthropic-only deployment — the state Cole is most likely in — every angle is a model prior
wearing an affirmative provenance claim, and so is his offer and his price.**

Two chairs added a second layer: research for `operator: "business"` routes through
`ACADEMIC_DOMAINS` (`researchEngine.ts:59-60`) — arXiv/PubMed/Semantic Scholar/OpenAlex,
queried with *"what persuades the parents of high-school athletes to hire a remote strength
coach"*, behind a 0.34 relevance gate. The Adversary: *"The two possible outcomes are 'PubMed
noise labelled research-backed' and 'model prior labelled from-your-own-data.' Neither is
what Cole asked for."*

The file's own header (`marketing.ts:13-17`) promises *"NOTHING IS ASSERTED WITHOUT ITS
GROUNDING."* The Adversary's summary: **"the system asserts a source that contributed
nothing."**

**2. No gated ask can reach Cole's phone — including outward confirms.** Detailed in §2 #7.
The comment at `executor.ts:141-144` justifies the silence by saying low-salience asks *"wait
for the 07:00 briefing, which already counts what's waiting."* Nothing counts them
(`rituals/engine.ts:148` filters `sourceType: "inbox_triage"`). The Systems Architect: *"the
comment is a design justification for a behaviour the code does not have."*

**3. The calendar disconnect notice is an undeduped siren — introduced by PR-A, the PR whose
other work was the best in the set.** Found by the Reliability Engineer alone; independently
verified by Systems Architect, Chief of Staff and the Adversary, all three of whom conceded
missing it. `syncCalendar` (`calendar/engine.ts:55-79`) calls `surfaceSignal` on every
disconnected tick; `surfaceSignal` (`bridge.ts:73-92`) is a bare `prisma.bridgeSignal.create`
with **no dedup and no prior-row check** — the day-keyed `sourceId` it writes is never read,
despite the comment at `:57-58` claiming *"surfaced once (deduped by day)."* The poller is
`setInterval(…, 15 * 60 * 1000)` (`:501-505`). `kind:"risk"` × `severity:"attention"` =
`1.0×0.35 + 0.7×0.65 = 0.805 ≥ 0.72` → **it pushes.** ~96 badge rows and ~60 Telegram pushes
per day, recurring on the ~weekly Google Testing-mode token expiry documented at
`NORTH_STAR:520-529`. The correct `findFirst`-per-day guard exists in `core/backup.ts:67-71`
and was not copied.

The Systems Architect's concession is the sharpest thing said about it: *"the calendar siren
is the single most consequential defect this council found, ahead of the grounding mislabel,
because it is the one that mutes the bridge — and I had written that muting the bridge is the
failure most likely to end the product, then failed to find the thing that causes it."*

**4. "Re: Quick one, Sarah" — the first impression of Cole's business is a forged reply
thread.** Found by the Revenue Operator alone; verified by Systems Architect, Reliability
Engineer, Chief of Staff, Product Skeptic and the Adversary, all five of whom conceded missing
it. `gmail/engine.ts:119` prefixes `Re: ` unconditionally against `leadEngine.ts:203`'s fresh
subject. Product Skeptic: *"the best find on this council… more damaging than three findings
I did make, because the warm list is non-renewable."* Reliability Engineer: *"on my own
standard — 'does the failure that matters return successfully with nothing in them' — this is
a success-returning failure I should have caught."*

**5. `"noted"` receipts are immortal.** §2 #6b. Reliability Engineer: *"PR-B did not halve the
problem; it took the portion it correctly reclassified and removed that portion's only garbage
collector."*

### High

**6. A lead with no email is marked contacted having been contacted by nobody.**
`leadEngine.ts:199` vs `:210-218`. Revenue Operator and the Adversary. Compounds with #7:
for an email-less lead the update **does** advance `nextActionAt`, so the sweep silently
retires the leads Cole can't email and grinds the ones he can.

**7. The outreach sweep is a treadmill that calls its own drafts follow-ups.** Reliability
Engineer; verified and conceded by the Adversary. `runOutreachSweep` (`leadEngine.ts:236-247`)
selects the 3 oldest leads by `nextActionAt <= now`; only `finalizeOutreachDraft` advances that
date, and only on confirm. So the same 3 leads are re-drafted every morning forever, one LLM
call each, while leads 4..n starve. Worse, `priorTouches` (`:122-131`) counts the prior *gated
signals*, so from day two `isFollowUp` is true and the prompt says *"This is a FOLLOW-UP.
Acknowledge that lightly"* (`:153-154`) about a message that was never sent.

**8. `opts.audience` is a control that silently discards its input.** Product Skeptic;
verified by the Systems Architect, the Reliability Engineer and the Adversary. Declared at
`marketing.ts:64`, passed by the API route (`api/crm/marketing/route.ts:20`) and the chat tool
(`tools/adapters/business.ts:110`), **never read in the function body**. The research query
hardcodes *"the parents of high-school athletes"* (`:87-88`) and `parseAngles` defaults every
unlabelled angle to `"parent of a high-school athlete"` (`:172`) — the exact demographic string
PR-A spent a commit removing. Revenue Operator: *"The Systems Architect's correction to me last
council was 'patch the seam, not the strings, or the next prompt author writes a third
audience.' PR-E is the next prompt author."* `remote_audience` remains an **open question** in
`profile.ts:249-255`.

**9. `outreach.draft` has no registered inverse, and its receipt calls itself reversible.**
Chief of Staff; verified by the Adversary. `registerActions.ts` registers inverses for exactly
`calendar.schedule_protection` (`:24`), `content.draft` (`:47`) and `knowledge.apply_proposal`
(`:97`). `finalizeOutreachDraft` overwrites `status`/`lastContactAt`/`nextAction`/`nextActionAt`
with no prior-state snapshot, while `executor.ts:91` files a receipt reading *"Reversible — tell
me if this was wrong."* A NORTH_STAR §2.5 violation in the newest grantable class.

**10. The grounding label is batch-level, not claim-level.** Systems Architect, Chief of Staff.
One value computed before the LLM call (`marketing.ts:97`) is written identically to all N angle
rows (`:152-157`). An angle the model invented wholesale inherits `external` and renders
"research-backed" because a sibling's research pass returned URLs.

**11. Nothing schedules `proposeAngles` or `draftOffer`.** Five chairs. All 19 `scheduleNamed`
calls in `index.ts` enumerated; neither appears. Reachable only from the chat tool and a button
on the desktop-only page. **Now partially stale:** the Adversary found untracked
`business/marketingPass.ts` plus `scheduleNamed("marketing_pass", "0 16 * * 0", …)` in a
modified `index.ts`. **Contested whether this is a fix or a worsening — see §4D.**

**12. The smoke suite verifies the honesty machinery only where it is vacuous.** Product
Skeptic, Chief of Staff, Revenue Operator. `smokeSuite.ts:1414-1418` asserts `proposed.ok ===
false` and `grounding === "none"` and that the note matches `/NOT RESEARCH-BACKED/` — and it
passes **because there is no key**, so `runLLM` fails and the default survives. There is no
assertion covering the `model-only → internal` mapping. 413 green assertions never touch line 97.

### Medium / Low

- **`businessContextBlock()` is injected twice per business turn.** Systems Architect;
  conceded by the Revenue Operator. `router.ts:474-484` added Layer 5.35, which fires whenever
  the primary or a secondary operator is `business`/`content`; `marketing.ts:115`, `:213`,
  `positioning.ts:370`, `:472` and `leadEngine.ts:123` **also** prepend it into `input` while
  passing exactly those operators. Both copies land below `CACHE_BREAK` (`router.ts:372`) — the
  full fact table plus the HARD BOUNDARY paragraph paid twice at full input rate, on the exact
  calls the budget alarm was rebuilt to watch.
- **`draft_outreach` is a button that isn't one.** Chief of Staff; verified by the Adversary;
  **the Product Skeptic explicitly declined to endorse it without opening the file.**
  `leadEngine.ts:331` attaches `actions: [{ label: "Draft a reply", action: "draft_outreach" }]`;
  the frontend handles exactly `confirm_action` and `undo_action` (`home/page.tsx:46-47`).
- **`importWarmList` dedups on bare `name` across the whole Lead table.** Systems Architect.
  `leadEngine.ts:71-75`: `where: email ? {OR:[{email},{name}]} : {name}`. Two different people
  named "Mike Johnson" silently collapse to one, reported as `skipped`, with no surface naming
  the dropped name.
- **`MarketingAngle.sources` is written and never displayed.** The Adversary; conceded by the
  Revenue Operator as *"the cheapest honesty fix on any list here and I missed it."*
  `marketing.ts:155` persists them; the note at `:42` says *"(listed below)"*; nothing renders
  them.
- **`draftAsset` withholds grounding from the writer.** Product Skeptic. `marketing.ts:212-224`
  passes title, audience, hypothesis and rationale but **not** `angle.grounding`, so a model
  writing from an ungrounded hypothesis writes with the same confidence either way.
- **`anglePerformance` returns `grounding` with no `groundingNote` on the chat path.** The
  Adversary. `tools/adapters/business.ts:135,137` returns it with no `trustThis` field, unlike
  `propose_angles` and `draft_asset`.
- **`/intake`'s rate limiter is unbounded and proxy-blind.** Reliability Engineer, Chief of
  Staff. `index.ts:199-207` — `intakeHits` is a `Map` with no eviction; no
  `app.set("trust proxy", …)` anywhere, so behind a proxy every submitter shares one 5/hour
  bucket.
- **Two unauthenticated lead-write paths where there should be one.** Revenue Operator, found
  only by looking past HEAD. `frontend/app/api/start/route.ts` imports `captureInboundLead`
  **directly** and calls it in-process; it never touches `index.ts:200`. So the express `/intake`
  endpoint the council spent four reports arguing about is now redundant *and* the audited copy
  is the dead one.
- **The funnel has a tracking parameter nothing produces.** Revenue Operator.
  `grep -rn "ref=" aurelius --include=*.ts` returns one hit, inside `reachabilityAudit.ts`'s own
  source-scanning string. `resolveRef` resolves a code nothing emits.

### The process defect, raised by three chairs and escalated by two

The Revenue Operator filed it `[medium]`; the Product Skeptic filed it `[low]` blind and
escalated it to his **sharpest point** on revision; the Adversary made it one of three
dissents. **The verified state is not the shipped state.** The "413 assertions, tsc clean, prod
build clean" figure handed to this council describes `e471464` and is now three commits and one
working tree stale. Migration `20260806180000_content_queue` was applied to the local DB from
untracked code. The badge grew 48 → 66 during the council's sitting. Product Skeptic: *"A
system shipping faster than it can be verified, whose verification apparatus (413 → 430 → 455
green assertions) rises monotonically through every one of these commits, is not a system
converging on trustworthy… In 90 days the risk is not that Cole finds a bug. It is that he
stops believing the green numbers."*

---

## 4. WHERE THE COUNCIL SPLIT

Six real disagreements. Not flattened.

### A. The score itself — 3 or 4

**Reliability Engineer (3, held, sole blind dissenter):** *"My standard is not 'did good
engineering happen.' It is what does this machine do at 3am with nobody watching, and on that
axis this week was net negative… Two new unattended-failure modes shipped this week; one real
capability shipped. On my axis that is not a point."* On the consensus: *"Read the five
reports' defect lists — they are nearly identical, and they are nearly identical to the last
council's, plus three new criticals. Three chairs explicitly justify moving 3→4 on the same
single fact: the revenue path is now continuous in code… But four of the six chairs then trace
that path and find it breaks at step 4 or earlier. A path that is continuous in the source and
discontinuous in every traversal is not worth a point."*

**Systems Architect (4 → 3):** moved down after verifying three Reliability Engineer findings
he had missed. *"The net is a system whose aim improved materially and whose attention layer
regressed… for the first time the hours it does consume are pointed at the binding constraint
instead of at task hygiene."* He kept the 3 rather than 2 on this reasoning: *"the distance
from here to a working revenue lane is now measured in edits rather than in engines."*

**Chief of Staff (4, held, explicitly conditional):** *"a 3 would assert this week produced
nothing, which is false. But I will not go above 4 while the one revenue lane damages the asset
it touches. The condition, stated plainly: if the outreach sweep goes live with the `Re:` prefix
and the false-contacted write, this is a 3, because the lane's expected value is negative — it
burns warm names rather than merely wasting time."*

**Adversary (4, held, also conditional):** *"If `marketing_pass` ships with `marketing.ts:97`
unchanged, I go to 3. That is the first time in this repo's history that a false provenance
claim would reach Cole without him pressing anything."*

**Product Skeptic (4, held):** *"On defect count, this thing is two days from a 6. That is the
case for scoring it higher and I think it is genuinely strong. The reason I do not take it: the
same velocity is what put the defects there, and it has now outrun its own verification twice
in one day."*

**Revenue Operator (4, held):** *"the gap between this repo and a dollar is not closing; it is
being relocated, one link at a time, and each relocation ships with a comment explaining why the
previous location was wrong."*

**Unresolved.** The council did not converge. The honest record is 3–4.

### B. Which surface has the blind risk line — the deck or the phone

**Systems Architect (blind):** *"the Home deck still calls `riskLineFrom(today, behindProjects,
overdueTotal)` with no business argument (`productivity/service.ts:533`) — so the phone confronts
and the web page Cole actually opens still renders 'Nothing's on fire.' Two risk lines, two
behaviours, one function."*

**Reliability Engineer, Revenue Operator, Chief of Staff, Product Skeptic and the Adversary all
independently refuted it.** Revenue Operator: *"Line 533 is the comment: `// THE BUSINESS BELONGS
IN THE RISK LINE`. The call is at `:541-542` with four arguments. They cited the comment that
documents the fix as evidence the fix is absent."* Chief of Staff: *"SA reported the deck blind
and the phone sighted; it is the phone that is blind. The finding survives with the surfaces
swapped, which matters because SA's version says 'fix the page he doesn't open' and the true
version says 'fix the one that reaches him.'"*

**Resolved against the Systems Architect, who conceded in full:** *"My 'two risk lines, two
behaviours' finding was directionally inverted… I should have opened the file instead of trusting
a line number."* **The real defect: `getBiggestRisk` (`:696-715`) omits `hasActiveOffer`/
`draftOffers`, so the no-offer branch is desktop-only.**

### C. Is the mobile nav fix the #1 item?

**Five chairs said yes.** Revenue Operator: *"Highest money-per-minute item in the repo by a
wide margin."* Chief of Staff, Product Skeptic, Adversary and Systems Architect all put it in
their top four.

**Chief of Staff then dissented against his own blind report:** *"Five of six BUILD NEXT lists
open with 'add `/business` to `MobileTabBar` (15 min), highest ratio in the repo.' I verified the
omission is real — and I verified that what it gates is the **one-time** import, not the
recurring loop, because Decisions is tab 2 (`MobileTabBar.tsx:15`) and carries the Confirm
buttons (`SignalsBench.tsx:283`). The doorbell gates 21 items a week, forever; the nav gates one
paste, once. The council converged on the fix that is easiest to describe rather than the one
with the largest recurring term."*

**Revenue Operator dissented differently:** *"Six chairs converging on a 15-minute nav edit as
the top revenue action means six chairs found nothing harder to say. A nav link is the most
auditable finding available from inside a repo, which is precisely why we all found it… The
honest verdict is not 'one nav link from revenue.' It is: the machine is now correctly built,
correctly aimed, correctly gated, and pointed at a market that has never heard of him, selling
an offer that has no price. Fix the ordering: price the offer, schedule the angles, then wire the
nav. A door onto an empty shop is still an empty shop."*

**Partially resolved.** The nav omission is verified fact. Its **rank** is contested, and the
Chief of Staff's mechanical correction — that the recurring confirm loop is already mobile — is
uncontradicted by any chair.

### D. Should `proposeAngles` be scheduled?

**Five chairs said yes.** Adversary: *"Sun 18:30 next to weekly planning. Otherwise PR-E is a
button."* Revenue Operator: *"For the capability he says he lacks most, the system waits to be
asked by the person who doesn't know what to ask for."*

**Chief of Staff dissented flatly:** *"'Nothing calls `proposeAngles` on a schedule' is stated as
a defect by five chairs. It is the correct decision. Scheduling an engine that mislabels its own
provenance multiplies a lie on a timer. And even after the label is fixed, a weekly batch of
angles is generation added to a man whose binding constraint is review capacity — the same error
the council spent six reports condemning."*

**The Adversary, who had recommended scheduling it, found it already done in the working tree —
and turned:** *"the newest work makes that worse, because the weekly pass will now call the liar
on a cron instead of waiting to be asked… If `marketing_pass` ships with `marketing.ts:97`
unchanged, I go to 3."*

**Resolved in favour of the Chief of Staff on ordering:** the label must be fixed before the
schedule entry lands. Untracked `marketingPass.ts` currently inverts that order.

### E. Is the badge fix a stall or a regression?

**Reliability Engineer:** *"The council converged on 'PR-B's badge fix was a backfill, not a fix'
and stopped there. That framing is too generous… It is a **regression**. A stall leaves the trend
line where it was; PR-B removed the only garbage collector from the 468 rows it reclassified. Six
months from now the do-nothing counterfactual has a bounded, self-clearing badge and the post-PR-B
repo has a permanent floor. Four chairs recommended 'invert the schema default' as the fix; **that
alone makes it worse**, because it routes more rows into the immortal `noted` bucket. The two
changes must ship together or not at all. Nobody said this."*

**Chief of Staff pushed back on severity, not mechanism:** *"The mechanism is exactly right and I
verified it. The **severity** is wrong. `noted` is excluded from the badge by construction —
`frontend/app/api/nav/badges/route.ts:12` counts `status: { in: ["pending","surfaced"] }`. So an
immortal `noted` row costs zero attention and some table growth. Ranking it `[high]` alongside a
defect that silences every outward confirm is a category error: one costs rows, the other costs
the product."*

**Product Skeptic sided with the Reliability Engineer on compounding:** *"the 468 `noted` rows the
backfill created are now permanent, so the fix that shrank the badge made the feed behind it
immortal. Nobody else picked this up."*

**Partially resolved.** The mechanism is agreed. The severity is not — and the Reliability
Engineer's operational warning (do not invert the schema default without fixing `queueSweep.ts:148,156`
in the same commit) is uncontradicted and should be treated as binding.

### F. How many writers bypass `surfaceSignal`?

Six chairs reported six numbers: **11** (Systems Architect), **13** (Chief of Staff), **16**
(Reliability Engineer, blind), **18** (Revenue Operator, and the Adversary on revision), **~20**
(Adversary, blind), **20** (Product Skeptic).

**Reliability Engineer audited it mechanically and conceded his own blind figure:** *"I wrote
'16 raw sites… still pass no status' and listed sites including `corpus/ingest.ts:107` and
`missions/engine.ts:245,285`, which **do** set a status. The audited figure is 13. My conclusion
is unchanged; my arithmetic was sloppy in the exact way I criticised others for."*

**The Adversary re-counted and got 18** non-test sites after excluding `bridge.ts:80` and the two
`executor.ts` sites that set status explicitly, and attacked both the Systems Architect and the
Reliability Engineer for undercounting: *"undercounting the pump is how the last backfill got sold
as a fix."*

**Systems Architect turned the disagreement itself into the finding:** *"Six chairs reported six
different counts — the disagreement is itself the finding: **no mechanism in this repo can tell you
how many writers bypass its own declared authority**, which is precisely why the fix was applied to
the wrong 15%."*

**Unresolved on the number. Resolved on the implication.**

### G. Instances vs. the mechanism that produces them

**Systems Architect's dissent, and the one he asked the council not to lose:** *"Every chair's
BUILD NEXT list is instances. Fix the ternary. Add the tab. Reorder the branch. Throw on missing
`to`. Route the raw creates. All correct, all cheap, all the same list shape as the last
council's, which produced five PRs that fixed instances and shipped four new ones of the identical
class — a comment claiming dedup with no dedup, a comment claiming batching with no batching, a
comment claiming expiry with no expiry, and a schema comment instructing authors to remember."*
His #1: extend `reachabilityAudit.ts` **from existence to exclusivity** — *a `prisma.<model>.create`
outside a module with a documented authority function for that model is a finding*; *every
grantable `ACTION_CLASS` needs ≥1 `executeAction` site*; *every registered finalizer maps to a
declared class*. *"Every other item on every list is a thing a person has to remember. That one is
the only thing proposed all week that would have caught this week's defects without a chair reading
the file."*

**Product Skeptic's dissent points at the same target from the other side:** *"Six of us
recommended extending `reachabilityAudit.ts` — which reported clean over a desktop-only money page,
an unscheduled marketing engine, two dead grantable toggles and a publish confirm that cannot ring.
That is 0-for-4 for the second council running, and the fix everyone recommends is to add more
checks of the same kind to the same tool. The one thing I would put above every item on every
chair's list: **stop shipping for one day and make the verification adversarial** — a smoke
assertion for the funded-key, no-web-search branch, and one that asserts an outward-tier gate
produces a signal `shouldPushNow` returns true for. Both are under an hour. Neither is on anyone's
list, mine included, until now."*

**The Adversary's version is the most concrete:** *"freeze the tree, fix `marketing.ts:97` /
`offers.ts:127` / `executor.ts:118` / `schema.prisma:395` / `gmail/engine.ts:119` — five lines —
and re-run the suite before another feature lands. Five lines is less work than the smallest thing
shipped tonight."*

**Not resolved, because no chair contradicted it — but no chair adopted it as #1 either except
the three who proposed it.**

### H. Is the duplication in `marketing.ts` an aesthetic complaint?

**Systems Architect, against himself, in his blind report:** *"`marketing.ts` being 'copy five of
prompt-and-parse' is an aesthetic complaint with almost no operational consequence… I have no
evidence the duplication has ever cost a bug."*

**Chief of Staff attacked exactly that:** *"It cost this exact bug. `marketing.ts:97` and
`offers.ts:127` are **character-identical** re-mappings of a vocabulary into a third value the
research engine has never heard of. That is not aesthetic duplication — it is one wrong line
copy-pasted into a second module hours later, which is precisely what a shared adapter prevents.
SA's own case-against-myself talked himself out of the one place his standard was right."*

**Product Skeptic reinforced it:** *"Copy-paste is how the mislabel reached Cole's **price**, not
just his marketing copy. The duplication mattered; the elegance framing would have missed why."*

**Resolved against the Systems Architect's self-critique.**

---

## 5. AUDIT AGAINST THE ARCHITECTURE

### Improved

- **CLAUDE.md "Whose business this is."** The employment boundary is now structural, not prose:
  `businessContextBlock()` returns the `BOUNDARY` string even when `knownFacts()` returns empty or
  throws (`positioning.ts:290-291`), and `proposeOffer`, `marketingOptions`, `draftAsset` and
  `draftOutreach` all consume it. The live breach the first council found is closed. *Residual
  cost:* it is now injected twice per business turn (§3), and `marketing.ts:87-88, :172` immediately
  hardcoded a third audience against the still-open `remote_audience` question.
- **CLAUDE.md rule 8, for the calendar specifically.** `assertCalendarUsable()` inside
  `findAvailability` is the rule correctly applied — the guard travels with the capability and the
  file documents why an opt-out flag was rejected.
- **NORTH_STAR §2.5 acting layer.** Genuinely gated grantable classes went 2 → 3 (Chief of Staff),
  and `outreach.draft` is the first whose gate exists on the **ungranted** path, so it can accrue
  `action:confirm:` traces and be surfaced by `suggestNextGrant`.
- **NORTH_STAR §6 Block 7, "light ONE outward engine first."** The drafting and queue halves are
  built and scheduled for the first time. The "results ingest and compound" half exists as
  `recordOutcome` with no automatic caller.
- **CLAUDE.md rule 3 (honest failure).** The guard now covers the two newest human-facing durable-write
  LLM consumers (`inboxTriage.ts:121`, `leadEngine.ts:164`) plus `marketing.ts:138,228`. One older
  site (`chatCompiler.ts`) remains uncovered.
- **NORTH_STAR §7 Client Engine.** *"A ledger with no intake"* → step 1 of the funnel exists in code.

### Drifted

- **`core/bridge.ts::surfaceSignal` as "the one gate governing every interruption."** It governs a
  minority of writes to the table it claims to own (count disputed, 13–18 bypassers), and the one
  path that *does* consult it (`executor.ts:146`) is tuned so it never opens. Systems Architect:
  *"The declared authority now governs a minority of writes and vetoes 100% of the ones it does
  govern."*
- **`BridgeSignal.status` as the definition of "needs you."** Addressed with a data migration, a
  helper, and a schema comment instructing future authors to "prefer" the helper. Advice is not a
  seam.
- **`core/salience.ts` — "salience decides WHETHER and WHEN it's worth interrupting Cole."** The
  bypass became total suppression. The acting layer is now *unable* to interrupt him about anything.
- **NORTH_STAR §2.5 "reversible by construction."** The newest grantable class has no inverse and
  mutates lead state irreversibly while its receipt says *"Reversible."*
- **CLAUDE.md rule 8, everywhere except the calendar.** `proposeAngles` reports `internal` — a
  *positive* claim — when its retrieval prerequisite is unmet, instead of `config` or `none`.
  `/intake` reports nothing at all. `reachabilityAudit.ts` prints clean over both. Product Skeptic:
  *"The rule's mechanical half is enforced; its semantic half — a door somebody can actually walk
  through — is not, and the clean output now functions as cover."*
- **NORTH_STAR §2 "recovers from restart."** It recovers once per boot, and only for jobs that left
  no trace row — which `markStarted` guarantees they all do. Retry within a day is architecturally
  absent.
- **`ACTION_CLASSES` as the single source of truth for grantability.** Three registered finalizers
  (`pattern.confirm`, `pattern.retire`, `autonomy.apply_grant`) still have no declared class and work
  only because unknown → gate; `systems.sop_draft` has no caller.
- **`researchTypes.ts`'s grounding vocabulary.** Re-mapped by two consumers into a value the producer
  cannot emit. **New instance of the exclusivity defect, created this week.**
- **`business/profile.ts` as the fact authority.** `positioning.ts` was corrected and
  `marketing.ts:87,172` immediately hardcoded an answer to the still-open `remote_audience` question.
  Same bypass, new file.
- **Command Deck spec, "hero metrics confront, never flatter."** The deck confronts; the phone gets
  the weaker line; the confronting branch is ranked below one overdue checkbox.
- **`rituals/engine.ts` and `buildSystemPrompt` still have no composition seam.**
  `generateMorningBriefing` gained a sixth inline `try { lines.push() } catch {}`;
  `buildSystemPrompt` gained a fifteenth inline layer (5.35) which is the *cause* of the
  double-injection defect. Systems Architect: *"precisely the failure mode a registry prevents."*

### Abandoned

- **`docs/SCOPE.md` as an honest ROI record.** Fifth council to name it, fifth to leave it.
- **The Home-page contract, "the needs-you strip renders NOTHING when nothing needs him."**
  Diagnosed twice, backfilled once, generator untouched.
- **`more/page.tsx`'s own stated invariant** — *"Nothing lives ONLY here — this is a listing, never
  a burial."* `/business` is buried and four PRs built on top of the burial.
- **NORTH_STAR §2 DoD, *"'plan my week' completes with created time-blocks."*** Untouched by all
  five PRs and by the three that followed. Two councils.
- **`docs/AUDIT_2026-07-10.md` debt #3 (no automated test suite; verification is live-fire smoke).**
  Reliability Engineer: *"the suite is larger and the gap is identical in kind: it verifies the code
  that was written, never the code that was bypassed."*

### Correctly parked

- **`docs/MCP_SPEC.md`** — frozen pending the Mini. Named by three chairs as correctly deferred; the
  Product Skeptic called it *"the best-written document in the repo."*
- **Payment rail.** `"stripe"` as an enum string with no integration. Unanimously correct deferral.
- **`outreach.send` / `email.send` / `content.publish` as outward with no finalizer.** The safety
  split held under a PR whose whole purpose was to make money.

---

## 6. THE HONEST STATE

### Proven — exercised against real infrastructure

- **The CRM money half.** Lead → Client → Engagement → Session → Invoice → Payment, proven end to
  end over real HTTP at the first council, unchanged and still the best-engineered part of the repo.
- **Deterministic-first rituals.** `rituals/engine.ts:42-67` and `:110-230` — a keyless,
  credential-less 07:00 artifact exists, every confronting footer computed from Postgres and appended
  after the voice pass. The one saving every chair scored as real (~1.2 hr/wk).
- **The outward gate's construction.** `actionClasses.ts:150-187` refuses `autonomy.*` by prefix
  before registry lookup; `executor.ts:245-253` claims on a whitelist so Dismiss and Undo mean no
  permanently; `reapStaleActing:185` treats an unknown class as outward. Nothing in five PRs weakened
  it.
- **The badge regeneration mechanism.** Not inferred — measured post-migration by four chairs
  independently, including growth **during the council's sitting**.
- **The salience suppression.** Executed by the Systems Architect (`score 0.595 push false`) and
  confirmed against live `content_publish_request` rows by the Product Skeptic.
- **Migrations honour the HNSW/GIN excision gotcha** (`20260806160000_offer_artifact/migration.sql:2-4`).
- **`reachabilityAudit.ts` runs clean** — and that is itself evidence, of the audit's coverage, not
  the repo's health.

### Plausible but unproven — no key, mock embeddings, no observed user

Every chair listed these, and every chair listed roughly the same ones. This is the largest bucket in
the repo.

- **Draft quality, angle quality, offer quality, briefing voice.** No LLM key in the audit
  environment. `draftOutreach`, `proposeAngles`, `draftAsset`, `draftOffer`, `inboxTriage`, the
  curriculum and chat have **only ever executed their refusal branch.** Chief of Staff: *"If the
  drafts are bad, review burden doubles and my −2.5 is optimistic; if they are good, my 0.6 hr/wk
  saving is pessimistic."*
- **Retrieval quality anywhere.** `EMBEDDINGS_PROVIDER=mock` — Layer 5.5, the semantic operator
  router, `semanticReuse`'s 0.93 threshold and `businessContextBlock` fact injection all run on
  meaningless geometry.
- **Whether `runResearch` returns anything relevant for a consumer-marketing query.** `"business"`
  routes to academic archives behind a 0.34 relevance gate. No chair could run it. The Adversary:
  *"it needs one live run to confirm which of the two bad labels Cole actually gets."*
- **Whether the frontend renders.** Never opened in a browser by anyone. `business/page.tsx` is
  ~1,100 lines with four new interactive panels, verified only by `next build`.
- **Whether Telegram push works end to end.** No token in the environment.
- **The real badge accumulation rate on the Mini.** The *mechanism* is proven; the daily number is
  inferred from the writer set and the schedule.
- **The disconnect flood's actual push behaviour.** The Reliability Engineer verified the arithmetic
  and the absence of dedup by reading; nobody ran `syncCalendar` against a revoked token with a live
  bot.
- **Cole's behaviour, entirely.** `Lead 0 · Client 0 · MarketingAngle 0 · AutonomyGrant 0 · Invoice
  0 · Payment 0` — the dev sandbox, not evidence about him. Every leverage number in this document,
  from every chair, is arithmetic on assumptions. Revenue Operator: *"Everything I say about review
  burden is a model, not a measurement — and nothing in `aurelius/measurement/` would settle it even
  after a month of use."*
- **Multi-day soak.** The DoD line *"runs for days"* remains the oldest unproven claim in the repo,
  and nothing in eight change sets moved it.

### Built but inert — code that exists and nothing can reach

- **`systems.sop_draft`** — declared grantable, one grep hit repo-wide, zero `executeAction` sites,
  still rendered on the Autonomy dial.
- **`opts.audience`** in `proposeAngles` — accepted by two callers, never read.
- **The express `/intake` endpoint** — narrow, sanitised, rate-limited, correctly built, and now
  bypassed by the actual form, which calls `captureInboundLead` in-process.
- **`resolveRef` and the `?ref=` attribution hop** — nothing in the repo emits a `/start?ref=<id>`
  URL. Revenue Operator: *"A landing page nobody is sent to, reached by a tracking parameter nothing
  writes."*
- **`recordOutcome`** — no automatic caller; the results loop that makes `anglePerformance` mean
  anything is hand-fed at 1 tap per send and per reply.
- **The `draft_outreach` bridge button** — renders, does nothing.
- **`MarketingAngle.sources`** — written, never displayed, under a note that says *"(listed below)."*
- **`AWAITING_DECISION`** — exported to stop drift; used only in the smoke suite. *(Flagged by the
  Reliability Engineer; the Adversary declined to endorse without re-verifying.)*
- **`finishDailyRun(_, false, _)`** — live-unreachable from cron.
- **The gated-ask push path** — `shouldPushNow` imported and called; returns false for 100% of
  inputs the caller can produce.

### Not built

- **A payment rail.** Collection is Venmo by hand.
- **A public street for the front door.** `docs/DEPLOY_MAC_MINI.md:503` still reads *"**If** you ever
  put the Mini behind a public hostname"* — conditional, hypothetical, no instruction. The Mini is
  Tailscale-only (`:199`, `:317`). Product Skeptic: *"There is now a front door with a form on it, on
  a street that does not exist."*
- **A price.** No offer can be activated until Cole types one, by correct design.
- **An audience.** `remote_audience` is still an open question in `profile.ts:249-255`.
- **Any revenue metric on the scoreboard.**
- **Same-day retry for any spine job.**
- **`planWeekLite` creating actual calendar blocks.**
- **An exclusivity check in `reachabilityAudit.ts`.**

---

## 7. RISKS — RANKED

**1. [CRITICAL] Cole acts on an invented marketing angle, and an invented price, believing both came
from his own data.** `marketing.ts:97`, `offers.ts:127`. He built this engine *because* he cannot
audit marketing claims, and it hands him a gold "from your own data" label on a pure model prior.
**Cost:** he tests a fabricated hypothesis on the twenty warm relationships he gets one pass through
— and if he ever discovers the mapping, he stops trusting every provenance label in the product,
including the honest ones. The Adversary: *"Ranked by damage-that-survives-discovery,
`marketing.ts:97` is first and nothing is close."*

**2. [CRITICAL] The confirm loop has no proactive channel — including for outward actions.** No
gated ask pushes, at any hour, for any class. The briefing does not count them. The fallback is a
3-slot shared "Signals worth a look" list ~24h later on a page he may not open. **Cost:** work
Aurelius does correctly is never seen, and Cole concludes it does nothing — while the `content.publish`
and `outreach.send` confirms that CLAUDE.md rule 1 calls non-grantable by construction sit silent in a
drawer.

**3. [CRITICAL] A dead Google token turns the phone into a siren.** ~96 badge rows and ~60 Telegram
pushes per day, recurring on a documented ~weekly expiry. **Cost:** he mutes the Telegram bot, and
every outward confirm the gate exists to protect is muted with it — the exact failure PR-B was written
to prevent, caused by PR-A. *(The Reliability Engineer softened this himself on the "not switched on
is a state, not a flaw" defence: if Cole is watching in week one and reconnects the first time it
buzzes twice, it costs one annoyed morning.)*

**4. [CRITICAL] "Re: Quick one, Sarah."** A forged reply thread as the first impression of Cole's
business, to former athletes and their parents. **Cost:** not an evening — the warm list is
non-renewable and you get one pass through it.

**5. [HIGH] The badge regrows and, this time, its floor is permanent.** ≥3 receipt-pending rows/day
from the spine alone plus wiki/mission/curriculum bursts, against 468 `noted` rows that will never
expire. **Cost:** the product. And it will be *more* damaging this time, because the team believes it
was fixed and `schema.prisma:391-394` tells the next engineer so.

**6. [HIGH] The CRM lies about its own pipeline.** Email-less leads marked `contacted` with no
artifact; the follow-up clock started on a message that does not exist. **Cost:** a CRM that lies is
worse than the Google Sheet it replaced, and the warmest names — the ones he only has a number for —
go silently quiet forever.

**7. [HIGH] The one-time revenue entry point is desktop-only.** Warm list, offer activation, angles,
content queue. **Cost:** the funnel's front door requires a laptop from a man whose scarcest resource
is time at one. *(Contested rank — the Chief of Staff notes the recurring confirm loop is already on
mobile tab 2.)*

**8. [HIGH] Nothing retries.** One 529, one cold Postgres, one expired token at 07:00, and the
briefing is gone for the day with `JobRun.status = "done"` and `pageFailure` unfired. **Cost:** the
daily habit that is the system's only proven leverage breaks on the first bad minute and he never
learns why.

**9. [HIGH] `docs/SCOPE.md` promises 5 hrs/week and a $1–2k/mo VA.** **Cost:** month two, when it
disagrees with reality, the sales sheet is what he remembers. Product Skeptic: *"the month-two
disillusionment is not 'it needs more work,' it's 'I was sold something.' That is the specific
emotion that kills personal systems."*

**10. [HIGH] Twenty-one outreach drafts a week with no offer defined.** `offerContextBlock` correctly
forbids inventing one. **Cost:** he burns his warm list on messages with no ask.

**11. [MEDIUM] The outreach treadmill.** Three leads re-drafted daily, each calling itself a follow-up
to an unsent message; leads 4..n never touched. **Cost:** LLM spend, review fatigue, and — if he
confirms one without reading it — an email referencing correspondence that does not exist.

**12. [MEDIUM] The Autonomy dial advertises a switch that does nothing** (`systems.sop_draft`).
**Cost:** the first grant a user flips that silently no-ops is the last grant they flip, on the surface
where trust *is* the product.

**13. [MEDIUM] Shipping outruns verification.** Eight change sets in a day, three migrations, one
applied from untracked code, a smoke count rising monotonically through all of it. **Cost:** the green
numbers stop meaning anything, and at that point nothing in this repo can tell Cole anything he'll act
on.

**14. [MEDIUM] Double-injected business context below the cache break.** **Cost:** money, on exactly
the calls the budget alarm was rebuilt to watch.

**15. [MEDIUM] Backup onto a dropped NAS mount reports success.** **Cost:** discovered on the only day
it matters.

**16. [MEDIUM] Granted actions are still silent while gated ones are also silent.** The finalize branch
never pushes. **Cost:** the more he trusts it, the less he hears from it.

---

## 8. WHAT TO BUILD NEXT

Ranked by (money or hours) ÷ effort, merging six lists. **Items 1–6 total under two hours and are
what every chair's list has in common.** The disagreements about ordering are preserved inline.

**1. Map `"model-only"` → `"none"` in both files. (20 min)** `marketing.ts:97` and `offers.ts:127`.
Reserve `"internal"` for the one legitimate producer — `marketing.ts:107`, where `priorEvidence`
actually contributed. Fix `:102`/`:132` so an `external` result with zero URLs downgrades to `"none"`,
not `"internal"`. Then **add the smoke assertion nobody has written**: stub `runResearch` returning
`grounding: "model-only"` and assert the printed note contains "NOT RESEARCH-BACKED". The Adversary:
*"the difference between a marketing engine and a confident liar, and it is the cheapest item on any
list this council will produce."* Five of six chairs put this in their top two.

**2. Set `severity` from the action class tier at `executor.ts:118`, and count gated asks in the
briefing. (30–50 min)** Outward gates → `critical` (which bypasses the salience floor entirely);
inward gates → `attention` with a real batched digest. Add gated-ask counts beside the `inbox_triage`
line at `rituals/engine.ts:141-153`, and move the outreach sweep before the briefing or the briefing
after the sweep. Chief of Staff, dissenting from the council's ordering: *"Three lines in `executor.ts`
decide whether the 2 hr/week the sweep costs buys anything at all. That is the highest ratio on any of
the six BUILD NEXT lists and it is not at the top of any of them."*

**3. Fix the outreach artifact — two edits. (30 min)** Pass a `newThread`/`isReply` flag to
`draftReply` and drop the `Re:` prefix for first contact (`gmail/engine.ts:119`). Make
`finalizeOutreachDraft` **throw** when `to` is falsy instead of marking the lead contacted
(`leadEngine.ts:199` vs `:210-218`). Revenue Operator: *"Protects the only channel he has."*

**4. Dedup `surfaceSignal` on `(sourceType, sourceId)` within 24h. (1 hr)** Copy `backup.ts:67-71`'s
`findFirst` guard into `surfaceSignal` itself so it kills the whole defect class rather than the
calendar instance. Stops the siren.

**5. Fix the badge — but ship both halves in one commit. (1–2 hrs)** Invert `schema.prisma:395` to
`@default("noted")` and set `status: "pending"` explicitly at the sites that mean it, **and** add
`"noted"` to both expiry filters at `queueSweep.ts:148,156`. **The Reliability Engineer's warning is
binding: inverting the default alone makes it worse**, because it routes more rows into a bucket with
no garbage collector.

**6. Add `/business` to `MobileTabBar` `also`, `more/page.tsx` GROUPS, and ⌘K. (15 min)** Five chairs
ranked this #1. The Chief of Staff's correction — that it gates the one-time paste, not the recurring
loop — is the reason it sits at 6 here rather than 1, and the Revenue Operator's *"a door onto an empty
shop is still an empty shop"* is the reason it is not omitted either. Fifteen minutes; two councils.

**7. Give `getBiggestRisk` the offer inputs, and move `business.empty` above the task ladder.
(20 min)** `productivity/service.ts:696-715` and `:644-665`. Better: have both callers use
`businessRiskInputs()` so the phone and the deck cannot disagree about what today's work is.

**8. Advance `nextActionAt` when a draft is *prepared*, not only when confirmed. (1 hr)**
`leadEngine.ts:250-259` — push a gated lead out by a day so the sweep rotates instead of grinding three
names, and stop `priorTouches` counting gated signals as prior contact (`:122-131`).

**9. Delete `systems.sop_draft` from `ACTION_CLASSES`, or give it a call site. (20 min)** Fourth
council. `content.draft` is now live and should be struck from the recommendation.

**10. Use `opts.audience` or remove it from the signature and both call sites, and delete the
hardcoded audience defaults. (15 min)** `marketing.ts:64, 87-88, 172`. A control that silently
discards its argument is worse than a missing one.

**11. Make failures actually retryable. (3 hrs)** Teach `ranToday` to ignore rows whose
`context.status` is `"error"`; remove the swallowing `catch` from the six `scheduleNamed` handlers so
`finishDailyRun(false)` can fire; `await` the three that don't; run `runCatchUp()` hourly instead of
once at boot.

**12. Extend `reachabilityAudit.ts` from existence to exclusivity. (3 hrs)** Three rules: a
`prisma.<model>.create` outside a module with a documented authority function for that model is a
finding; every grantable `ACTION_CLASS` needs ≥1 `executeAction` site; every registered finalizer maps
to a declared class. **This is the Systems Architect's dissent and it is the only item on any list that
would have caught this week's defects without a chair reading a file.**

**13. Make the verification adversarial. (1 hr)** The Product Skeptic's dissent: a smoke assertion for
the **funded-key, no-web-search** branch, and one asserting that an outward-tier gate produces a signal
`shouldPushNow` returns true for. Both branches are where Cole actually lives; neither is tested.

**14. Register an inverse for `outreach.draft`, or make it non-grantable until one exists. (1 hr)**
Snapshot the lead's prior status/`nextActionAt` in the payload; the inverse deletes the Gmail draft and
restores them. Until then `executor.ts:91`'s *"Reversible"* is false.

**15. Reconcile `docs/SCOPE.md`. (20–30 min)** Replace *"~5 hrs/week back"* and the VA line with what
is measurable today, and say the leverage arrives with clients, not with the key. Cheapest trust
preservation available; fifth council of asking.

**16. Guard `chatCompiler.ts` with `engineUnavailableText`. (5 min)** Named twice now.

**17. Render `MarketingAngle.sources`. (30 min)** The note already says *"(listed below)."*

**18. Move `research.ingest` / `knowledge.apply_proposal` `executeAction` calls outside their
`if (granted)` branches. (half day)** Restores the trust flywheel for two of seven keyholes and makes
them visible *before* they are granted, which is the only way Cole would decide to grant them.

**19. Probe the backup mount. (1 hr)** Write and read back a marker under `AURELIUS_BACKUP_DIR` before
`pg_dump`; make `runDbBackup` throw rather than return `{ok:false}`.

**20. Dedup `importWarmList` on email or `name + relationship`, and surface the skipped names. (30 min)**

**21. Revenue on the Sunday scoreboard — leads added, contacted, replies, invoiced, received.
(half day)** Leading indicators, not trailing corpus docs.

### Explicitly contested — do NOT do yet

- **Schedule `proposeAngles`.** Five chairs recommended it. **The Chief of Staff and the Adversary
  both argue it must wait until item 1 lands** — *"scheduling an engine that mislabels its own
  provenance multiplies a lie on a timer."* Untracked `marketingPass.ts` currently inverts that order
  and should not ship before the grounding map is fixed.
- **Invert `schema.prisma:395` on its own.** See item 5.
- **Publish `/intake` more widely.** The endpoint is now redundant to the `/start` route; the correct
  action is to delete one of the two unauthenticated write paths, not to add traffic to either.

### The one thing that no PR can do

Both the Revenue Operator and the Chief of Staff ended on the same point, from opposite standards.
Revenue Operator: *"None of my findings touch the actual binding constraint. Cole has 45 spare minutes,
no audience, and no inbound. The warm list is the only correct answer to that, and it requires **Cole**
to type twenty names — a thing no PR can do and no chair can score. Every defect I found is real and
every one of them is downstream of that."* And then: *"price the offer, schedule the angles, then wire
the nav."* Until a number exists in `Offer.priceCents`, every draft the system produces opens a
conversation it cannot close.

---

## 9. WHERE A CHAIR WAS CAUGHT OUT

Quality control on the council. Verified mis-citations only.

| Chair | Claim | What was actually true | Caught by |
|---|---|---|---|
| **Systems Architect** | *"the Home deck still calls `riskLineFrom(today, behindProjects, overdueTotal)` with no business argument (`productivity/service.ts:533`)"* — built into a drift finding, an EVIDENCE AGAINST bullet and a 5-minute BUILD NEXT item | `:533` is the **comment documenting the fix**; the call is at `:542` with four arguments, `businessRisk` built at `:541`. The blind surface is the **phone** (`getBiggestRisk:696-715`), not the deck. | Reliability Engineer, Revenue Operator, Chief of Staff, Product Skeptic, Adversary — all five. **Conceded in full.** |
| **Systems Architect** | *"eleven raw `bridgeSignal.create` writers"* | 13 by the Reliability Engineer's mechanical audit; 18 by the Adversary's. Undercount either way. | Adversary. Conceded implicitly via his own re-count of 21 total sites. |
| **Systems Architect, Chief of Staff, Product Skeptic, Adversary** | *"[fixed] a failed spine job permanently consumes the day"* | The reclaim is real and inert — swallowing handlers + `ranToday`/`markStarted`. Four chairs read the fixed function and not its callers. | Reliability Engineer. **All four conceded.** The Chief of Staff's concession names the lesson: *"RE found it by reading the call chain; I read the fix and stopped. That is exactly the failure mode this council exists to catch, and I committed it."* |
| **Revenue Operator, Product Skeptic, Adversary** | *"[fixed] Executor bypassing salience — `executor.ts:145-148` now routes through `shouldPushNow`"* | It routes and the gate never opens: `0.595 < 0.72`, verified by execution (Systems Architect) and by live rows (Product Skeptic). | Systems Architect, Reliability Engineer, Chief of Staff. **All three conceded.** Systems Architect: *"You graded a fix by reading the line that calls the function instead of the function."* |
| **Reliability Engineer** | *"16 raw sites… still pass no status,"* listing `corpus/ingest.ts:107` and `missions/engine.ts:245,285` | Those three **do** set a status. Audited figure 13. | **Self-caught on revision:** *"my arithmetic was sloppy in the exact way I criticised others for."* |
| **Revenue Operator** | *"`git status` shows `?? aurelius/business/offers.ts`… it is not in PR-E or any commit"* — load-bearing for his "[medium] verified state is not the shipped state" defect and a BUILD NEXT item | `git ls-files` returns the path; `git log` shows `e62d09f`. The untracked work was the **content queue**, not the Offer artifact. | Reliability Engineer. **Conceded** — and the Revenue Operator turned it into a stronger finding: the tree had moved again. |
| **Systems Architect, Chief of Staff, Product Skeptic, Adversary, Revenue Operator (blind)** | *"`content.draft` has zero `executeAction` call sites"* — the Adversary stated it as a flat grep result | `tools/adapters/content.ts:112` carries `actionClass: "content.draft"`, with a finalizer and an inverse, as of `28c1189`. True at the audited commit, false at HEAD. | Revenue Operator (on revision), Systems Architect (independently, in-tree). **Conceded by all.** |
| **Revenue Operator, Product Skeptic, Chief of Staff, Adversary** | *"`grep -rn intake frontend` → zero hits. There is no form."* | True at the audited commit. `frontend/app/start/page.tsx` + `/api/start/route.ts` exist at HEAD (`3c1c9cc`), exempted in `middleware.ts:19-20`. | Revenue Operator and Product Skeptic, both on revision. **Conceded.** The finding survives one storey up: there is no public street. |
| **Adversary** | *"all three [money branches] require an existing client or lead, i.e. all three are structurally unreachable at Cole's actual state of zero"* | Two of three. `staleFollowUps` is satisfied by a **Lead**, and `importWarmList` sets `nextActionAt: new Date()` on every imported name. | Systems Architect. |
| **Adversary** | *"`/intake` is a JSON-only POST behind `express.json()`; an ordinary HTML `<form>` submits urlencoded and would not parse"* | Correct about express, irrelevant at HEAD — the actual form is a React `fetch` with JSON. His conclusion survived for a different reason than he gave. | Revenue Operator. |
| **Chief of Staff** | Marked `riskLineFrom` **[fixed]** while separately pricing its ranking defect `[high]` | *"It cannot be both. The ordering is the entire content of the fix."* | Revenue Operator. |
| **Product Skeptic** | Self-declared audit-order bias: *"I checked the badge before I checked anything else, which is not a neutral audit order"* | It recurred: *"I opened `psql` before I opened `salience.ts`, and the thing I missed was in the file I did not open. The bias is real and it cost me a critical finding this round."* | **Self-caught, twice.** |
| **Chief of Staff** | *"`draft_outreach` is a button that isn't one"* | Verified correct by the Adversary. **But the Product Skeptic publicly refused to co-sign it** — *"the citation is to the frontend handling only two bridge actions, which is a claim about `home/page.tsx`, not about the button's target… It is the one finding in his list I would not put my name to without opening it."* Correct finding, thin citation. | Product Skeptic (procedural), Adversary (verified it). |
| **Reliability Engineer** | *"`AWAITING_DECISION` … used only in the smoke suite"* | Not disproven. **The Adversary declined to endorse it** — *"the kind of grep-shaped claim that this council has now been wrong about twice in one night."* Recorded as unverified by a second chair. | Adversary (procedural). |
| **The whole council** | Audited "five PRs" against `e471464` | **Eight change sets.** `e62d09f`, `28c1189`, `3c1c9cc`, plus an uncommitted eighth. Only the Adversary caught `e62d09f`; only the Revenue Operator and Product Skeptic caught `3c1c9cc`; nobody audited the untracked `marketingPass.ts` before the Adversary found it in the arguments. | Product Skeptic, Revenue Operator, Adversary. Adversary: *"A council that certifies a tree cannot certify a tree that moves faster than it reads."* |

**Pattern in the errors, stated by three chairs independently:** the mis-citations cluster on
**fixes graded by reading the diff rather than the call chain**. Four chairs certified a retry that
cannot fire; three certified a push path that cannot push. In every case the chair read the line the
commit message pointed at and stopped. The Reliability Engineer, who made neither error, is also the
only chair whose method was to read the *callers* of a fixed function — and the Systems Architect
generalised it into the week's largest finding: **three PR comments this week assert mechanisms the
code does not implement** (`calendar/engine.ts:57` "deduped by day"; `executor.ts:141-144` "batched";
`queueSweep.ts:127-128` "must still age out"), plus a schema comment instructing future authors to
remember. *"PR-B and PR-A were written comment-first, and the comments were graded instead of the
code."*

---

## APPENDIX — THE STRUCTURAL FINDING, CARRIED FORWARD

The first council's appendix named **declared single sources of truth that are not exclusive.** This
council found the shape reproduced **inside the PRs written to close it**, and gained new instances:

1. `needsDecision` / `surfaceSignal` — declared "the one place signals are created"; governs a minority
   of writes (13–18 bypassers, count itself disputed).
2. `ACTION_CLASSES` — three registered finalizers with no declared class; one declared class with no
   caller.
3. `researchTypes.ts`'s grounding vocabulary — re-mapped by two consumers into a value the producer
   cannot emit. **New this week.**
4. `businessContextBlock()` — two independent injectors, neither aware of the other, both below the
   cache break. **New this week.**
5. `AWAITING_DECISION` — exported to stop drift, consumed only by the smoke suite, with two inline
   copies still live. *(Unverified by a second chair.)*

The Systems Architect's closing argument, which no chair contradicted:

> *"Every council so far has fixed instances. None has built the check. `reachabilityAudit.ts` tests
> **existence**; this repo's defect is **exclusivity**… Every other item on every list is a thing a
> person has to remember. That one is the only thing proposed all week that would have caught this
> week's defects without a chair reading the file."*

---

*Recorded 2026-08-06. Six chairs, blind assessments then cross-examination. Two chairs at 3, four at
4. The record preserves the disagreement; it does not resolve it.*
