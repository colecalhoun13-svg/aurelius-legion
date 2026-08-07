# ROADMAP — THE DEMAND ENGINE

*Council of six chairs (Demand Architect · Marketing Strategist · The Analyst ·
Retention & Referral Operator · Systems Architect · The Contrarian), attacked by
The Adversary against one test: **does a named human enter the Lead table.**
Recorded verbatim from the designs; nothing invented, nothing softened.*

---

## 1. WHERE COLE IS MISSING — the converged diagnosis

Cole built the demand-**handler** and left the demand-**generator** — and the
whole retention/referral **back-half** — empty. That is the answer to his
question, and all six chairs converged on it independently.

The handler is real and good. The public `/intake` endpoint self-records into
`captureInboundLead` (crm/leadEngine.ts:348), `resolveRef` turns an 8-char code
back into the exact angle that earned a lead (crm/leadEngine.ts:334),
`Lead.angleId` is documented as "the whole attribution chain: angle → lead →
offer → engagement → payment" (prisma/schema.prisma:763), and
`anglePerformance` ranks angles by leads-not-vibes (business/marketing.ts:347).
Every part of that chain is built.

**And not one of them is reachable by an actual stranger.** The Demand Architect
put it plainly: it is "a door in a field with no path to it and no sign on it."
Three things that turn a post into a click into a row do not exist:

- **No emitter.** The Adversary opened the files: `grep -rn "?ref=" --include=*.ts`
  over the whole tree returns **zero hits**. The attribution chain is fully built
  on the read side and *nothing anywhere emits a ref link*. `angleId` is
  populated on `/intake` and never read for ranking, because it is null on every
  organic lead — no post carries a trackable link. This is the single most
  important missing line of code in the entire round, and every chair buried it
  as a supporting "item 2." **It is a #1 build.**
- **No reason to enter.** `/intake` is a bare form. "See where you stand" is the
  missing reason — a lead magnet that uses Cole's rarest asset (real tracked
  numbers most coaches don't have) as the hook, where getting your score *is* the
  capture.
- **No page to point at.** Aurelius already runs a public web origin
  (`media/host.ts:50`, mounted index.ts:124) and "uses that power for nothing but
  hosting Instagram JPEGs so Meta can fetch them" (The Contrarian). It has a
  public HTTP surface and points all of it inward at drafting.

The deeper miss, on the Systems Architect's lens: prior rounds built
**generators** (marketingPass, outreachSweep) and a **ledger** (crm/service.ts)
but never the **sensor layer** that lets a generator learn. `instagram/insights.ts`
reads reach and per-post performance and *nothing joins it to a lead*. So the
system can tell Cole "this reel got 4,000 reach and 90 saves" and cannot tell him
whether that reel produced one human. "The gap on my lens is not a missing
channel; it is a missing *filter*" (The Adversary). Reach, saves, engagement,
posts-published — vanities every prior round let stand because no one made
`COUNT(Lead WHERE angleId=X)` the only number that reports.

And the **retention/referral back-half is where the money and leverage actually
are, and it is the emptiest square on every prior roadmap.** `crm/service.ts` can
record a `check_in` Session, name a block about to lapse (`whatNeedsAttention`,
service.ts:471), total a client's `lifetimeCents` (service.ts:594) — "but nothing
drives any of it" (Retention Operator). `logSession` fires only when Cole *types*
it. There is no cadence, no silence-detector, no drafted check-in. The referral
engine — the only channel that produces a brand-new named Lead at zero audience
and near-zero dollars — **does not exist in code at all.** `LEAD_SOURCES` lists
`"referral"` and `Lead.referredBy` is a column, but they are "enum decoration":
the one writer of `referredBy` (`importWarmList`, leadEngine.ts:83) *misuses* it,
stuffing the relationship ("former athlete", "parent") into the referrer column —
a verified bug that poisons the exact field a referral flywheel needs.

Two hard facts frame the whole build, both caught by The Adversary against the
charter:

- **The offer gate is dark.** `marketingPass.ts:47` literally
  `return { ran: false, reason: "no_offer" }` — **the entire content spine
  refuses to run until an Offer is `active`**, and no Offer has ever been set
  active. Every content item from every chair drafts toward a pass that will not
  fire. Only the Marketing Strategist caught it.
- **BreatheFire is NOT live.** The brand doc, verbatim: *"Partnerships: NONE
  current — actively seeking the next one. BreatheFire … was a PRIOR collab and
  is NOT live right now … Do not design any item that assumes a partner audience
  Cole does not currently have."* The charter's "LIVE apparel cross-promo
  PARTNERSHIP" is stale. Four chairs called it "live" and designed
  borrowed-audience items on a partner that does not exist.

Cole's real assets are three: **a modest active IG, a proven dichotomy hook, and
a warm list.** Design on those or don't design.

---

## 2. THE THREE ROLES (and the fourth)

### The Marketer — becomes an operator that speaks Calhoun and shows its evidence
Today it writes "competent generic-coach copy in a voice that isn't his, over a
research base that is a pure model guess" (Marketing Strategist) — on an
Anthropic-only key `marketSourceCount` returns 0 and every angle is honestly
stamped `grounding: "none"`. It becomes a real marketer when (a) Cole's brand —
the dichotomy template, the mantra, the voice sample from
`docs/CALHOUN_PERFORMANCE_BRAND.md` — is *ingested* so `proposeAngles`/`draftAsset`
stop guessing his voice, and (b) one web-search key turns the research branch from
failure-mode into grounded citation Cole can open. *Builds it: items 3 (Offer
Probe), 13 (brand ingest + research key), 8 (partnership acquisition), the
contrarian angle miner.*

### The Analyst — becomes the ratio machine that confronts, not the counter that flatters
"Every number this system produces is a numerator or a raw cost — never a ratio…
The system will soon be able to *record* money and *count* leads. Nothing divides
one by the other. ROI is a division; the analyst is the operator that does the
division, and it does not exist" (The Analyst). It becomes the referee: it makes
`COUNT(Lead WHERE angleId=X)` the only scoreboard, prices Cole's 45 minutes per
channel, computes cost-per-lead and CAC-vs-LTV, and pushes **one uncomfortable
truth a week** to his phone — "3 hours of content produced 0 leads, reallocate."
*Builds it: items 6 (confronting read), 2 (angle ledger), 10 (channel spend
ledger), 11 (Cole's-minutes ledger), price confrontation, LTV ranker.*

### The Demand-Generator — becomes the missing front of the funnel
Today "a mouth with no food" (The Contrarian): attention arrives and there is no
artifact between it and the CRM. It becomes the emitter that stamps every post
with a trackable link, the assessment page that converts a scroll into a named
row, the partnership outreach that finds borrowed audiences, and the paid arm that
boosts *only* a post that already earned a human. *Builds it: items 2 (ref
emitter), 4 (assessment), 8 (partnership), 9 (paid boost).*

### The Retention & Referral Operator — the fourth role, the back-half, where LTV lives
"The front-of-funnel chairs are fighting for strangers at $8–40 a lead while a $0
channel sits unbuilt behind the clients Cole already has" (Retention Operator). It
becomes the heartbeat that notices a silent client before churn, drafts the
re-sign 21 days out instead of at the 7-day cliff, catches the PR at the emotional
peak and fires the referral ask, and turns a client's result into the case study
that becomes the next ad. *Builds it: items 5 (referral engine + `referredBy`
fix), and the dormant cohort — check-in cadence, renewal watch, proof engine, PR
ledger, LTV ranker.* A referred client "carries a CAC of roughly one drafted
message and one of Cole's confirms."

---

## 3. THE ORDERED LIST — ranked by leads-per-hour-of-Cole

*Numbered = execution order. `[FREE]` = $0-marginal; `[$]` = costs something,
flagged. Duplicates collapsed to one build with all chairs attributed.*

### 1. Paste the warm list — the honest #1, already built · `[FREE]`
- **Role:** demand-generator
- **Channel / zero-audience / CPL:** People who already know him. **Yes — the
  only channel that lands a named human at zero audience AND zero spend today.**
  CPL ≈ $0.
- **What:** `importWarmList` (crm/leadEngine.ts:58) already exists; the outreach
  sweep drafts openers bounded 3/run (leadEngine.ts:249), Cole confirms send.
- **Why:** The Adversary: "Cole's fastest path to ten clients is people he already
  knows, one honest message at a time." It seeds client #1, which arms everything
  dormant below.
- **Invoker:** existing `outreach_sweep` (index.ts:1596) + `importWarmList`.
- **Prereqs:** Cole pastes the list. The `referredBy` field misuse (leadEngine.ts:83)
  should be fixed here so warm-list relationship stops poisoning the referrer column.
- **Build cost:** ~0 (built); ~2h for the `referredBy` fix. · **Ongoing:** ~2 min
  per drafted opener he confirms; $0.
- **Background vs confirm:** drafts unattended; the one confirm is each outward send.
- **Produces a human:** Yes, directly — a warm name he messages becomes a Lead/Client.
- **Tier:** the true #1 at his scale.
- **How we'd know:** named Lead rows from the warm list, then client #1.

### 2. The ref-link emitter — weld the open end of attribution · `[FREE]`
*(Systems Architect #1 · Demand Architect #2 · Adversary #2 — the same build, three times)*
- **Role:** seam / demand-generator
- **Channel / zero-audience / CPL:** His existing IG posts. **Yes** — it makes
  posts he already makes measurable. CPL: **this is what makes CPL exist at all.** $0.
- **What:** A `TrackLink`/`/l/:code` (or `/r/:ref`) public GET registered beside
  `/intake` (index.ts:200, AUTH_EXEMPT index.ts:141) that 302-redirects to
  `/intake?ref=<first-8-of-draftId>` — which `resolveRef` already resolves
  (leadEngine.ts:334) — and counts the click. `stageForPublish`/`saveDraft`
  (content/queue.ts:139/51) mint the link and surface it *inside the draft Cole
  reviews.* Because **Instagram strips links from captions** (Systems Architect's
  key catch), the confirm card hands Cole the one **bio-link** URL to set plus the
  "link in bio" caption line — a naive `?ref=` in caption text "never travels and
  every lead lands with null attribution — the loop looks alive and measures
  nothing."
- **Why:** "The attribution chain is built and unreachable" (Systems). Without it,
  `angleId` is null forever and `anglePerformance` ranks on hand-typed replies.
- **Invoker:** the existing publish confirm (mints link); `/l/:code` mounted route;
  `resolveRef` closes it.
- **Prereqs:** `/intake` (shipped), `resolveRef` (shipped), `MEDIA_PUBLIC_BASE_URL`
  set — else the doctor reports `config`, not `live`.
- **Build cost:** 4–6h. · **Ongoing:** ~0 tokens; Cole updates his bio link when he
  changes featured angle (a ~20-second confirm, batched into publish).
- **Background vs confirm:** click-counting + resolution unattended; the one confirm
  is the existing publish confirm, now carrying "set your bio link to this."
- **Produces a human:** Decisively-indirect — it is the mechanism by which a
  stranger who taps a post becomes a *named, angle-attributed* Lead instead of an
  anonymous null. It doesn't create the human; it makes the human traceable.
- **Tier:** 8→9 (nothing above it reaches 9 while the loop leaks here).
- **How we'd know:** share of new Leads with non-null `angleId` climbs from ~0
  toward the majority; `TrackLink.clicks` gives a real top-of-funnel number.

### 3. The Offer Probe — make the offer a testable product, not a paragraph · `[FREE]`
*(Marketing Strategist #1 — the understated unlock)*
- **Role:** marketer
- **Channel / zero-audience / CPL:** His IG story/DM + a one-section landing per
  variant. **Yes** — needs no audience beyond his modest following and warm list. CPL $0.
- **What:** `probeOffer()` takes 2–3 offer *variants* Cole ratifies (same promise,
  different shape/price/framing), writes each as a short DM + landing section via
  `draftAsset` (business/marketing.ts:255), mints a distinct ref per variant, and
  floats them to slices of the warm list and IG. Whichever variant's ref produces
  replies/leads is the one Cole flips to `active` (`Offer.status → active`, his hand
  only). Re-price from evidence, never a guess.
- **Why:** `marketingPass.ts:47` refuses to run with no active offer — **the entire
  content spine is dark until this fires.** The design currently asks Cole to
  *perfect* an offer in the abstract, "which for a man who lacks marketing
  confidence means never." This lets his market pick the winner cheaply.
- **Invoker:** new tool `business.probe_offer`; results read by the Sunday marketing
  pass once an offer goes active.
- **Prereqs:** Cole ingests offer promise + candidate prices into the Offer table;
  the ref chain (item 2).
- **Build cost:** 6h. · **Ongoing:** ~5 min once to pick variants + read the winner;
  one research pass in tokens; $0.
- **Background vs confirm:** drafts all variants unattended; the one confirm: "Three
  offer shapes are drafted and tracked — approve floating them?"
- **Produces a human:** Yes — each variant link resolves through `/intake?ref=` → a
  named Lead attributed to the winning variant.
- **Tier:** 8 (the gate; nothing downstream works without it).
- **How we'd know:** a Lead whose `angleId` traces to one variant, and an Offer
  flipped to `active` on that evidence.

### 4. "The Standard" — the assessment that IS the lead magnet and self-records the lead · `[FREE per lead; needs his IG traffic]`
*(Contrarian #1 framing — honest about traffic · Demand Architect #1 · Marketing #8 · Adversary #3 — collapsed 4×)*
- **Role:** demand-generator
- **Channel / zero-audience / CPL:** An owned public page linked from his IG bio +
  story CTA. **Partly — works at his modest scale, NOT at zero traffic** (Adversary's
  correction to Demand #1's "zero audience" claim; the Demand chair's own words:
  "a lead magnet with no traffic is a landing page for nobody"). $0 hosting, $0/lead.
- **What:** A public `GET /start` (or `/standard`) page served off the origin that
  already serves `/media`, added to AUTH_EXEMPT exactly as `/intake` is. An athlete
  or parent enters the five numbers Cole already tracks (vertical, broad, 5-10-5,
  10-yd, top speed) plus name/email/phone/sport, and gets back a benchmark card /
  gap report in Cole's dichotomy voice ("Your squat says show. Your sprint says you
  never trained go."). The gated final tier POSTs straight to `captureInboundLead`
  carrying the `?ref=`. Add `"assessment"`/`"website"` to `LEAD_SOURCES`
  (crm/service.ts:48). Benchmark math is a static table Cole supplies once — **no
  model call in the hot path, so it can't fail-branch on a prospect.**
- **Why:** His CTA today is "drop it below" — a comment, not a Lead. "A comment is
  vanity; this converts the same attention into a named row" (Adversary). It
  productizes his diagnosis — "the one thing only he can do" — into a machine that
  runs while he's at his day job.
- **Invoker:** the page's own POST → `captureInboundLead` → `addLead`.
- **Prereqs:** `MEDIA_PUBLIC_BASE_URL` set (else `config`, not `live`); item 2 (ref
  plumbing); **Cole supplies his real per-sport benchmark bands once** — without them
  the scoring is generic "and the item is dishonest" (Contrarian: "a machine that
  scores athletes against standards Cole never supplied is worse than nothing").
- **Build cost:** ~10–14h. · **Ongoing:** ~0 Cole-min per capture (self-records); ~1
  LLM call per completion for the voiced report; $0.
- **Background vs confirm:** runs fully unattended; the one confirm reaches him only
  when a scored human becomes a hot lead: "New lead from The Standard — [name],
  [sport], scored low on [gap]. Draft the opener?"
- **Produces a human:** Yes — the submit IS the Lead insert, keyed to a real contact
  and a diagnosed gap. Strongest stranger→row mechanism in the round.
- **Tier:** 9.
- **How we'd know:** Lead rows with `source="website"`/`"assessment"`, an `angleId`
  ref, and assessment answers in `notes` — "leads that named themselves."

### 5. The Referral engine + the `referredBy` fix — DORMANT until client #1 · `[FREE]`
*(Retention Operator #2 — with the verified bug · Demand #4 · Marketing #5 · Systems #5 · Analyst #5 · Contrarian #6 — collapsed 6×)*
- **Role:** retention/referral
- **Channel / zero-audience / CPL:** Word-of-mouth at a client's emotional peak.
  **Yes — works at literally zero audience, the only channel that compounds free.**
  CPL ≈ one drafted message + one confirm — the cheapest named Lead the business can
  produce.
- **What:** **First fix leadEngine.ts:83** — it writes `referredBy: raw.relationship`,
  stuffing "former athlete"/"parent" into the referrer column; "if relationship keeps
  overwriting the referrer, step 4 records garbage and step 5 thanks the wrong person
  or nobody" (Retention Operator; the one genuine, verified bug in the round). Then a
  `Referral` model (absent — no such model exists) linking referrer Client → referred
  Lead, plus four hooks: **(a) peak detection** off `recordPayment` (service.ts:436)
  and a logged PR; **(b) the ask** drafted inward at that peak; **(c) track** — the
  returned name lands via `captureInboundLead` with `source="referral"`,
  `referredBy=<clientId>` correctly scoped; **(d) close the loop** — when the referred
  lead converts (`convertLead`, service.ts:149), thank the referrer, which lands
  *them* at a new peak.
- **Why:** "The highest-ROI channel he owns is absent from the code." Nearly every
  prior roadmap skipped it.
- **Invoker:** peak-triggered via `recordPayment`/Stripe `paid` self-record + the PR
  event; weekly reconciliation in the Sunday sweep. **NONE fires until the first
  Client row exists — ships dormant-honest (hard rule 4), never renders an
  encouraging zero.**
- **Prereqs:** first client (item 1/the warm list must land one); the `referredBy`
  fix; the PR ledger for the PR-triggered path; Stripe `paid` self-record (item 7)
  for the payment-triggered peak.
- **Build cost:** 8–10h. · **Ongoing:** ~2 min per ask; low tokens; $0.
- **Background vs confirm:** peak-detection + tracking unattended; the one confirm:
  "Jake just PR'd / re-signed — ask who else trains like this? Draft ready."
- **Produces a human:** Yes, directly, once armed — a referred name enters the Lead
  table with `source="referral"` and a `referredBy` resolving to a real Client,
  "the highest-converting kind."
- **Tier:** 9→10 (the compounding, free, zero-audience far end).
- **How we'd know:** the first Lead whose `referredBy` points at a real client — "a
  lead Cole neither found nor paid for."

### 6. The confronting analyst read — one uncomfortable truth a week, pushed not shown · `[FREE]`
*(The Analyst #2 · Adversary #4 — with the angle ledger #2/#1 beneath it)*
- **Role:** analyst
- **Channel / zero-audience / CPL:** No spend — it prices his 45 minutes and governs
  every channel. Zero cost, works today.
- **What:** A deterministic read that ranks every channel by **dollars-per-hour-of-
  Cole's-attention** and by cost-per-lead, finds the single worst *reallocation*, and
  emits **one line**: *"Content took 2.3 h of your confirms last week and produced 0
  leads; the warm-list angle produced 2 at 12 min each. Cut a content slot, add a
  warm-list slot?"* Hard anti-vanity rule: it may only confront about a channel with a
  **real denominator** (a lead or a dollar); a channel with neither is reported as
  *"no signal yet — here's the cheapest way to create some,"* **never a fabricated
  rate.** Rides the existing Sun 20:00 scoreboard → Mon 07:00 briefing (index.ts:1707);
  no new screen.
- **Why:** "This is the sentence Cole asked for verbatim… A summary informs; a
  confrontation reallocates." Every prior round measured what *Aurelius* costs; none
  measured what *Cole's own hours* return.
- **Invoker:** existing `weekly_scoreboard` (index.ts:1707) + briefing footer.
- **Prereqs:** the angle ledger (`COUNT(Lead WHERE angleId=X)`, items 2 + the join),
  the channel-spend + Cole's-minutes ledgers, `spend.ts` (exists, does the dollar
  half by taskType).
- **Build cost:** 6–8h. · **Ongoing:** one bounded LLM call/week to phrase the truth
  in his voice (~pennies); Cole's cost ~30 sec reading one line.
- **Background vs confirm:** computed unattended; the one confirm is a *decision*
  prompt, and only when a channel is provably dead.
- **Produces a human:** No — the governor that points his next hour at the channel
  that does, and "refuses to flatter him when he originates none."
- **Tier:** 9 — the "confronts instead of vanity-counts" DoD bar made literal.
- **How we'd know:** the channel it tells him to cut loses share of his confirm-minutes
  the next week; leads-per-Cole-hour trends up while his minutes stay flat.

### 7. The Stripe webhook — the `paid` transition self-records · `[$ ~2.9%+30c/txn, no monthly]`
*(Systems Architect #2 · Adversary #8)*
- **Role:** seam / retention
- **Channel / zero-audience / CPL:** Not acquisition — the far-end sensor. Charged
  only on money that already arrived, so ROI-trivial.
- **What:** A `POST /webhooks/stripe` mirroring the `/intake` pattern —
  rate-limited, AUTH_EXEMPT but **signature-verified** with `STRIPE_WEBHOOK_SECRET`.
  On `checkout.session.completed`/`invoice.paid` it matches payer email to a `Client`
  and writes a `Payment` row (schema:1008). Unmatched payments log an unattributed
  MoneyEvent and surface "money arrived I can't attribute" — **never guess** the
  client. Venmo/Zelle receipts parsed from the Gmail inbox Aurelius already reads,
  same discipline. Dormant-honest without the key.
- **Why:** "Today a payment is a thing Cole types. The analyst can't compute
  CAC-vs-LTV because LTV's inputs never self-arrive." Item 9's kill line and item 6's
  ROI need dollars joined to the angle chain.
- **Invoker:** the mounted webhook route (Stripe calls it); inbound self-records, no tap.
- **Prereqs:** the Client/Invoice/Payment ledger (shipped); Stripe account + key
  (Cole, one-time). **No MoneyEvent model / Stripe route exists today** (Adversary
  verified) — this is a real build, honestly `config` until the key lands.
- **Build cost:** 8–12h incl. signature verification + reconciliation. · **Ongoing:**
  ~$0 fixed + txn %; Cole confirms nothing; one phone notice only on an unattributable
  payment.
- **Background vs confirm:** every paid transition records itself; the one notice is
  only the exception — "$X arrived, I can't match it to a client — whose is it?"
- **Produces a human:** No — turns a Client into a *measured* LTV, which is what lets
  the system say which acquisition channel is worth paying to scale.
- **Tier:** 9→10 (CAC-vs-LTV, hence disciplined paid spend, is impossible without it).
- **How we'd know:** a `Payment` row appears with no keystroke; the money total moves
  on its own.

### 8. Partnership ACQUISITION outreach — find the NEXT partner (BreatheFire is a template, not a channel) · `[$ research key ~$30–50/mo]`
*(Adversary's reframe of K1 · Demand #5 · Marketing #4 · Systems #6 · Contrarian #3 — collapsed 5×, "live" claim stripped)*
- **Role:** demand-generator
- **Channel / zero-audience / CPL:** Outreach to non-competing coaches, PTs,
  nutritionists, apparel, gyms Cole does NOT work at, for a borrowed audience.
  **Yes at his scale — you rent someone else's audience.** $0 media; research tokens
  only.
- **What:** Once a web-search key lands, research surfaces *named* non-competing
  candidates and Aurelius drafts intro outreach as `outreach.draft` (INWARD, Gmail
  draft only — mirrors crm/leadEngine.ts:107), bounded 3/run like the warm-list sweep.
  **BreatheFire is the *shape* of partner to seek, not a live audience** (Adversary:
  "reframed as outreach to find the next partner… which produces a *partner*, not a
  lead"). Each partner gets a unique `/r/<partnerRef>` so their referred leads are
  attributed. Sending stays `outreach.send`, outward, Cole's confirm.
- **Why:** "He has one working partnership and nothing in code finds or drafts the
  next ten." Aurelius has 24/7 compute to prospect while Cole sleeps.
- **Invoker:** a partner-lane in the outreach sweep / a `partnership_sweep` registered
  via `scheduleNamed` (index.ts:1610) — flagged: today NONE exists.
- **Prereqs:** **the FUNDED research key** (`TAVILY_API_KEY`/`GEMINI_API_KEY`/`SERPAPI_KEY`)
  — "this is the item that most needs it or it hallucinates named partners"; the
  outreach draft path (built); item 2 for attribution; a `Partner` table.
- **Build cost:** 10–12h (8h if research already funded). · **Ongoing:** ~2–3 drafts/
  month to review; research tokens; $0 media.
- **Background vs confirm:** finds + drafts unattended; the one confirm: "send this
  collab pitch to [partner]?"
- **Produces a human:** Indirectly-then-directly — a confirmed partner posts Cole's
  `/r/` link; their followers hit the assessment → Leads carrying that partner's ref.
  **Honest label: it produces a *partner*; leads count only when they arrive through
  the ref emitter (item 2).**
- **Tier:** 8→9.
- **How we'd know:** a partner reply, then `/intake` rows carrying that partner's ref.

### 9. The measured paid boost — amplify ONLY a post that already earned a human · `[$ bounded test budget + kill line]`
*(Demand #6 · The Analyst #6 · Adversary #5 — collapsed 3×)*
- **Role:** analyst / demand-generator
- **Channel / zero-audience / CPL:** Paid IG boost of an *organically-proven* post.
  **NOT a zero-audience channel — deliberately gated behind organic proof.**
  Cost-per-lead is the entire control: a test budget (e.g. $50) + a `$Y/lead` kill
  threshold set up front.
- **What:** The angle ledger flags any angle whose `angleId` already has ≥1 organic
  Lead as boost-eligible. Aurelius proposes boosting that exact post, computes CPL live
  from boost spend ÷ new `/intake` leads carrying that ref, and surfaces "this ad is
  $47/lead, above your $30 line — kill it?" — mirroring `spend.ts`'s once-per-threshold
  alarm discipline. **It cannot arm** until an angle clears `anglePerformance`'s
  real-signal bar. Spend is outward, Cole's confirm, non-grantable. Self-terminating:
  hits the budget or the kill line, it stops.
- **Why:** Cole said he'll spend "just not out the ass." "This makes paid a disciplined
  accelerant on a proven message, never a crutch." Unmeasurable spend is *structurally
  impossible* because eligibility requires a prior attributed lead.
- **Invoker:** a boost-eligibility check inside the weekly marketing/scoreboard pass;
  the spend proposal is a Bridge confirm.
- **Prereqs:** items 2 + the angle ledger (organic CPL must exist first — hard-gated);
  item 7 (the money ledger); a Meta ads token (`config`, not `live`, until it lands).
- **Build cost:** 8–14h. · **Ongoing:** the ad $ Cole approves (bounded, self-
  terminating); ~1 decision tap per threshold.
- **Background vs confirm:** eligibility + kill-threshold monitoring unattended; the one
  confirm is the spend approval, and later the "kill it" decision.
- **Produces a human:** Yes — boosted proven post → more `/intake` taps on a ref that
  already converts, stamped `source="paid_ads"`. Every dollar is traceable to a named
  row or the boost is killed.
- **Tier:** 9→10 (the first honest paid arm).
- **How we'd know:** cost-per-lead in dollars, computed, under the kill line — or killed.

### The substrate items (feed the above; not standalone human-producers)

- **10. Channel Spend Ledger** (The Analyst #1) `[FREE to run]` — a `ChannelSpend`
  model + deterministic `channelRoi.ts` join to the Lead ledger and to revenue through
  `Client → Engagement → Payment`. "This is the one build that turns spend from
  banned-because-unmeasurable into allowed-because-measured." An unattributable spend is
  counted **loudly and separately**, never folded in as $0. *~10h. Tier 8 (enabling for
  9).*
- **11. Cole's-minutes ledger** (The Analyst #3) `[FREE]` — tags each confirm with its
  channel + a coarse `estMinutes` constant (content review ≈ 4 min, outreach ≈ 2, spend
  ≈ 1; **labelled as estimates, never presented as measured**), so item 6's
  "3 hours of content" becomes computable. *~6h. Tier 9 (the hero metric's missing
  denominator).*
- **12. Wire IG insights into angle performance** (Systems #4) `[FREE]` — a poller
  matching published `ContentDraft.permalink` to Meta media insights, writing reach/saves
  back onto the draft and aggregating to the angle, so a zero-lead post reads as "seen by
  400, converted 0" vs "seen by 12." **Reach becomes a ratio input (leads ÷ reach), never
  a standalone report line** — the Adversary's vanity correction. Adversary's factual note:
  insights.ts is *already* imported by tools/adapters/content.ts, so it is not unconsumed;
  the real gap is that it is not wired to attribution. Needs an interval schedule entry —
  flagged: none exists today. *~7h. Tier 9.*
- **13. Teach the generator Cole's brand + fund real grounding** (Marketing #2) `[$ ~$30–50/mo]`
  — ingest the dichotomy template, mantra, and voice sample from
  `docs/CALHOUN_PERFORMANCE_BRAND.md` into `persona.*`/knowledge so `proposeAngles`/
  `draftAsset` speak Calhoun, and fund one web-search key so angles render
  `grounding: external` with openable links instead of honest `"none"`. "The difference
  between a clever post generator and an operator that speaks Calhoun and can show you why
  it thinks this will land." *~4h wiring + ~15 min Cole ingest. Tier 9.*

### The dormant cohort — build now, arm at client #1, never report live over zero clients

*The Adversary's ruling: "first-class AND dormant is the only honest way to hold both
truths." The charter is right the far half is under-weighted 3:1; it must be built,
inert, arming the instant a client exists.*

- **Check-in cadence engine** (Retention #1) — `checkInEveryDays` on Engagement + a
  `retentionSweep()` that drafts a check-in for any client past cadence, bounded ~3/run.
  Fills the deferred retention half; gives retention a pulse. *6–8h.*
- **Renewal / re-sign watch** (Retention #5 · Systems #7 · Marketing #6) — drafts the
  re-sign **21 days out, not at the 7-day cliff** (Adversary's factual correction: the
  existing `whatNeedsAttention` horizon is 14 days, not the "7" the Retention chair cited),
  framed with `lifetimeCents` + PRs as earned proof. "endsAt IS the re-sign conversation."
  *3–6h.*
- **Progress/PR ledger** (Retention #3) — a lightweight `Metric` capture
  `{clientId, label, value, unit, isPR, achievedAt}` on `logSession`; the `isPR` event is
  what items 5, the proof engine, and the referral reflex subscribe to. "Notice the PR at
  the emotional peak" has nothing to notice on without this. *5–6h.*
- **Proof engine** (Retention #4 · Contrarian #2) — on a PR, draft an **anonymized**
  before→after case study in the dichotomy voice → `content.draft` → `content.publish`
  (Cole's confirm), carrying a fresh ref. Consent enforced by the existing `isMinor` gate
  — a minor's result never drafts public without the parent flag. Turns delivery into
  demand. *6–8h. Depends 3-deep on a client.*
- **Price confrontation** (The Analyst #4) — from close-rate × realized LTV, surface
  *"You've closed 4 of 5 at $200/mo and they stay ~7 months — that's a $1,400 client you're
  pricing like a $200 one. Raise new-client rate to $275?"* Reconstructed from the ledger,
  never self-reported; re-pricing existing clients is never auto. **Silent until n ≥ N
  closed deals** — "n=1 is not a finding." *7h.*
- **LTV-weighted channel ranker + churn sentinel** (The Analyst #5 · Retention #6) — rank
  channels by *realized LTV*, not lead count ("your one referred client has paid $1,400;
  your six IG leads have paid $0 — referrals are your best channel"); flag a client whose
  session cadence drops or whose block nears `endsAt` with no renewal touch. *9h.*

---

## 4. THE DEMAND LOOPS

### Loop A — The attributed content loop *(build first; 80% built, leaking at one weld)*
Stages: **(1)** `marketingPass` picks the angle Cole's own results favor
(marketingPass.ts:82) and drafts one asset — inward, exists today. **(2)** Cole edits
and taps publish; `stageForPublish` mints a per-angle **TrackLink** (item 2) and the
confirm card hands him the caption CTA plus the one bio-link URL. **(3)** The post goes
out on Cole's confirm — outward, gated. **(4)** `instagram/insights.ts` self-records
reach against that post (item 12) — *did anyone see it.* **(5)** A stranger taps the bio
link → `/l/:code` 302s to `/intake?ref=code` → `captureInboundLead` + `resolveRef` write a
Lead with `angleId` — *self-recording, no keystroke.* **(6)** If they pay, the Stripe
webhook (item 7) writes a Payment against that Lead's Client. **(7)** `anglePerformance`
now ranks angles by **reach → leads → dollars**, and next week's pass doubles down on the
angle that produced a human.
- **What closes it self-recording:** the `/intake` POST writing the Lead with its resolved
  `angleId`, and the Stripe webhook writing the payment — the two events no human types.
- **What silently breaks it:** the **bio link.** Instagram strips caption links, so a naive
  `?ref=` in caption text never travels and every lead lands null — "the loop looks alive
  and measures nothing." Route through the single bio link, and Cole must set it once per
  featured angle. Second silent break: a payer who pays under a different email than they
  submitted — the Stripe match fails and the dollar records unattributed. **Both fail
  loud** ("I can't attribute this"), never guess.

### Loop B — The Standard Loop *(the front door)*
**(1)** Cole posts his proven dichotomy reel, CTA changed from "Drop it Below" to "get your
Athletic Standard score → link in bio." **(2)** A stranger taps → `/start?ref=` → enters
their five numbers → **self-records a Lead** with `source="website"` and `angleId` stamped,
no Cole keystroke. **(3)** The inbound-lead signal hits his phone with a "Draft a reply"
action — the one human touch. **(4)** Weekly, the marketing pass joins insights reach to
leads-per-angle → organic CPL, and mines the anonymized submissions into next week's
Standard Report, which carries a fresh ref — closing back to stage 1.
- **What closes it self-recording:** stages 2 and 4 (the Lead row and the attribution).
- **What silently breaks it:** `MEDIA_PUBLIC_BASE_URL` unset (`/start` 404s — must report
  `config`, never `live`); the ref never stamped into the draft body (every lead lands
  `angleId=null` and the analyst is back to guessing); Cole never swaps the bio CTA (the
  loop has no entrance — "Aurelius should nag until it's live"); his real numeric standards
  never ingested (scoring goes generic, the report stops sounding like him).

### Loop C — The Referral Flywheel *(the compounding far end, dormant until client #1)*
**(1) Deliver** — Cole logs a check-in, now driven on rhythm by the cadence sweep.
**(2) Detect the peak** — the PR ledger extracts a PR (`isPR` event), or `recordPayment`/
Stripe `paid` marks a re-sign. **(3) Prompt the ask** — the referral engine drafts the ask
at that exact moment; Cole taps send (outward, his confirm). **(4) Capture the human** — the
referred name arrives (often by text, self-recording against a stable phone identity) and
lands as a Lead with `source="referral"`, `referredBy=<client>`. **(5) Close the loop** —
when that lead converts, thank the original referrer, landing *them* at a new peak, and the
flywheel turns again.
- **What closes it self-recording:** the `paid` transition attributing revenue back to
  `referredBy`, "so the loop proves its own ROI without Cole bookkeeping."
- **What silently breaks it:** the **`referredBy` misuse at leadEngine.ts:83** — if
  relationship keeps overwriting the referrer, step 4 records garbage and step 5 thanks the
  wrong person. **Fix that column before anything else in the loop, or it compounds noise
  instead of clients.**

### Loop D — The ROI-Confrontation Loop *(the brain over the other three)*
MEASURE (every confirm books its channel + minutes; every real dollar books a
`ChannelSpend` row) → ATTRIBUTE (the `/intake` ref lands each Lead on a channel/angle; the
Stripe `paid` self-record lands each dollar on a Client) → DIVIDE (Sunday, deterministic:
cost-per-lead, dollars-per-hour, LTV/CAC — "the arithmetic that does not exist today") →
CONFRONT (Monday 07:00, one line to his phone) → REALLOCATE (Cole cuts one channel's slice
of his 45 minutes, adds another's) → RE-MEASURE.
- **What silently breaks it:** a channel with leads but **no cost denominator** reads as
  infinite ROI and dodges the confrontation (item 11 is the fix); spend with no attributed
  lead lets an unmeasurable ad hide. Both degrade to *"insufficient signal, here's how to
  create some"* — **never a fabricated ratio.** "A ratio invented from a missing
  denominator is the one lie this chair exists to prevent."

---

## 5. THE CHEAPEST PATH TO COLE'S FIRST TEN LEADS

The Adversary's ruling, verified against the code: **"He does not need a new channel. He
needs three builds and one paste, in this order."** Total Cole time: a few hours across a
couple of weeks; total marginal $: **$0.**

1. **Paste the warm list** (`importWarmList`, built) and let the bounded sweep draft
   openers he confirms. People who already know him — his fastest path to the first several
   clients, at $0, this week. *Cole: ~2 min per opener he confirms.*
2. **Ship the ref emitter (item 2)** so the dichotomy posts he *already makes* stop
   dead-ending in comments and start writing `angleId`-stamped rows. Change one CTA line
   from "Drop it Below" to "link in bio." *Cole: ~20 sec to set the bio link per featured
   angle. Build: ~5h.*
3. **Stand up the assessment page (item 4)** as the bio-link destination — the reason a
   stranger who stopped actually types their name. It self-records; zero Cole minutes per
   lead. *Build: ~10–14h. Cole: supply his benchmark bands once.*
4. **The first paying client arms the referral flywheel (item 5).** Fix `referredBy`
   (leadEngine.ts:83) first so it remembers who sent whom.

Run **the Offer Probe (item 3)** in parallel — it unlocks the dark content spine
(marketingPass.ts:47) and costs Cole ~5 minutes to ratify variants once.

**Where a measured paid arm is worth turning on:** only after item 2 exists AND one organic
angle has produced ≥1 attributed lead AND a Meta ads token is set. Then item 9 boosts *that
proven post* on a **bounded test budget (e.g. $50) with a kill threshold set up front (e.g.
$15/lead)** — "this boost is $X/lead vs your line — kill it?" Everything else — full
partnerships, build-in-public, the retention suite beyond dormant scaffolding — is
amplification on a loop that must first prove it converts one warm human cheaply.

---

## 6. THE ANALYST'S FIRST CONFRONTATION

Once the loops record real outcomes, one line arrives on his phone Monday at 07:00 — a
decision, not a dashboard:

> **"Content took 2.3 h of your confirms last week and produced 0 leads. The warm-list angle
> produced 2 at 12 min each, and your one referred lead has paid $1,400 while your six IG
> leads have paid $0. Cut a content slot this week, add a warm-list slot — and ask your
> referred client's coach for one more. Kill the content lane? y/n"**

The discipline is subtraction — exactly **one** truth per week. And the honesty floor holds
in the early weeks when there is no denominator yet:

> **"Not enough signal on any channel to compute a rate. The cheapest experiment to create
> some: paste 10 more warm-list names and set your bio link to the assessment."**

Never a fabricated ratio over his price; never a reach number rendered as progress. "If a
week produces 10,000 impressions and zero `/intake` rows, this machine tells him that week
produced nothing, in gold text, instead of rendering an encouraging reach number."

---

## 7. BUILT TOGETHER OR NOT AT ALL

Sets where a partial build is vanity or worse:

- **The ref emitter (2) + the assessment page (4) + the angle ledger (12/the join).** The
  page without the emitter is "a door in a field again." The emitter without the ledger read
  is a fingerprint no one dusts. Reach numbers (item 12) without the `COUNT(Lead WHERE
  angleId=X)` join beside them **are** the vanity this whole round exists to kill. Ship the
  three as one attributed loop or none.
- **The referral engine (5) + the `referredBy` fix (leadEngine.ts:83).** Build the flywheel
  on the poisoned column and "it compounds noise instead of clients." Fix the column *first*.
- **The Stripe webhook (7) + the paid boost (9) + the confronting read (6).** The boost's
  kill line is measured in $/lead; without self-recorded payment the LTV half is blank and
  "every paid decision is half-blind." Paid spend ships only when its money sensor does.
- **The offer probe (3) before any content item.** Every angle/content build drafts toward
  `marketingPass.ts:47`, which returns `{ran:false, reason:"no_offer"}`. Shipping content
  generation while the offer is `draft` is motion toward a pass that refuses to run.
- **Any acquisition door (2, 4, 8) + the gym boundary guard.** A public form captures a name
  and a sport, never "is this athlete my employer's?" Ship the doors with the fail-closed
  flag-and-freeze, or the engine will eventually draft an opener to an athlete Cole is
  contractually forbidden to sell to.

---

## 8. REJECTED — the Adversary's kills, with the failed human-test

- **K1 — "Leverage the LIVE BreatheFire partnership"** (as written in Demand #5, Marketing
  #4, Contrarian #3, Systems #6). **Failed test:** *what named human enters the Lead table
  because of a partner Cole does not have?* None — the brand doc states in bold that
  BreatheFire "was a PRIOR collab and is NOT live right now." *Survives only reframed as
  partner-**acquisition** outreach (item 8), which produces a partner, not a lead, and whose
  downstream leads count only through the missing ref emitter.* The "live template to lean
  on" framing is killed.
- **K2 — "The Standard page works at ZERO audience"** (Demand #1, verbatim: "Yes, works at
  zero audience — it's a page, not a following"). **Failed test:** fails on its own author's
  admission — "a lead magnet with no traffic is a landing page for nobody." *The page
  survives as item 4; the "zero audience" claim is killed — it is a converter of his existing
  traffic, never an originator.*
- **K3 — Standard Report / build-in-public as a near-term lead producer** (Demand #7,
  Contrarian #5). **Failed test:** produces no human inside the horizon that matters (first
  ten leads) — Demand #7 needs weeks of submissions that don't exist; Contrarian #5
  self-flags "a bet on months, not weeks." *Not deleted — demoted to "bet, park until the
  assessment has data." Shipping now is motion over leads.*
- **Vanity metrics struck:** reach/saves/engagement as standalone report lines (defensible
  only as a ratio denominator); "PR events recorded per week" and "posts drafted / candidates
  found" (effort counts, not outcomes — "activity theater"); `MAX_PER_RUN` framed as
  throughput ("three drafts is three drafts; the metric is replies and rows").
- **Sequencing errors (right item, wrong time):** all six referral engines, all retention
  items, the proof engine + PR ledger, and all paid-boost governors — correct designs, inert
  over zero clients or downstream of prereqs that don't yet exist. **They ship dormant-honest
  (hard rule 4), arming at client #1, and must never render an encouraging zero.**

*Clean win noted: **no unmeasured or unbounded spend was proposed by any chair.** Every paid
item is measured (cost-per-lead against a kill line), bounded (a test budget), and gated
(organic-proven-first). The research key (~$30–50/mo) is a fixed measured cost, not per-lead
burn. "No chair proposed 'buy traffic to skip the work.'"*

---

## 9. THE HONEST CEILING

**Can this system GENERATE demand, or only amplify Cole's own effort?** The Adversary opened
the files and the verdict is mechanical, not rhetorical: **it amplifies. It does not
originate.** Every survivor *converts, attributes, routes, or measures* attention — and the
attention has exactly one source: Cole's face in the reel, his reps, his voice, his warm
list, his coaching result. "The ref emitter records that a stranger tapped; it cannot make
the stranger care. The Stripe webhook records that money arrived; it cannot make someone pay.
The assessment administers *his* diagnostic; it cannot invent the standard. The referral
engine times the ask at the PR; it cannot manufacture the gratitude."

The Demand Architect and Marketing Strategist concur from their own lenses: "I will not
pretend a machine makes strangers *care*… the engine amplifies a signal, it does not
originate one." "Aurelius cannot *find* demand where Cole has planted none."

The system's real, non-trivial power at his modest scale is **negative and honest**: it stops
him from mistaking motion for leads. "That is not demand generation; it is demand *honesty*
plus demand *conversion*."

**The ceiling this design reaches is a 9** — a disciplined amplifier that captures,
attributes, and compounds every scrap of attention Cole originates, and refuses to flatter him
when he originates none. **The 10 — a system that generates demand while Cole sleeps — exists
only on the far side of client #1**, when the referral and proof flywheels start turning his
real results into his next leads at $0. And even at 10, the origin is still his coaching.

**What still requires his first conversations:** the warm-list messages he sends, the offer he
ratifies, the brand he ingests, the one post he publishes, the one referral he asks. "The
machine turns one input into a measured loop; it cannot manufacture the input."

**The gym_arrangement question, sitting above every dollar.** Cole is *employed* by the gym;
its athletes are his employer's, never his (CLAUDE.md, 2026-08-05). This is the one dependency
no chair could code around. A public `/start`, an SMS keyword, and a partner referral are open
doors that capture a name and a sport, never "is this athlete my employer's?" — `LEAD_SOURCES`
has no ownership dimension. Every acquisition item can, in principle, surface a lead Cole is
contractually forbidden to sell to. The honest design **fails closed**: any ambiguous lead is
flagged for Cole's eyes and **frozen from all outreach drafting** — Aurelius surfaces it and
asks, it never auto-drafts an opener to a name that might be his employer's. As the Systems
Architect insisted, "I refuse to pretend that boundary is enforced by good intentions; it needs
a column and a `where` clause." And as the Contrarian closed: "a single mis-aimed outreach to
the wrong athlete is a career problem, not a marketing miss — and that judgment can only ever be
Cole's hand."

*Build the emitter, fix the column, unlock the offer, paste the list. The rest is
amplification — and amplification of zero is zero.*
