All disputed claims are now verified in code. The record is complete; here is the Business Seat's Round 2 delivery.

---

# THE BUSINESS SEAT — ROUND 2: re-audit, cross-examination, final plan

## 1. The re-issued funnel audit — with the sweep folded in, and one correction to the sweep

**First, the dispute I was charged to settle: the sweep is wrong about The Standard, and I can prove it.** `frontend/app/api/standard/route.ts:2,48,60` imports and calls `assessStandard` + `summarizeStandard`; `/standard` (page.tsx:61) POSTs to it; `frontend/middleware.ts:24-25` makes both public; phase 2 writes a Lead via `captureInboundLead(source:"assessment")`, rate-limited 15/hr/IP. The sweep grepped only the backend territory — **`frontend/app/api/` is a production caller surface its invoker-grep never saw.** The same blind spot felled two more of its dead-code verdicts: `stageBoost` is invoked by the Business page's "Stage the spend →" button via `/api/crm/growth` (route.ts:51), and `researchPartners`/`draftPartnerIntro` ride the same route. The Standard lead magnet is live code; my round-1 plan's bio-link→`/standard` step stands. (Lesson for the synthesis: reachabilityAudit and future sweeps must treat frontend API routes as invokers.)

**Everything else in the sweep survives my re-verification, and I adopt it:**

- **Touch cap / gated-mislabel — CONFIRMED, and worse than stated.** `priorTouches` (leadEngine.ts:133-137) counts BridgeSignals, and the executor's gate path files a signal with the same `sourceType`/`sourceId` (`executor.ts:149-156`) — so with `outreach.draft` ungranted, day 1 files a pending confirm, day 2 drafts "this is a FOLLOW-UP" to a person who received nothing, and because the sourceId is touch-numbered, an unconfirmed lead mints a *new* pending card daily. And no touch cap exists: the finalizer rotates `nextActionAt` +4d forever. **This changes the 30-day plan** — it fires in week 1 (mislabel) and week 3 (cap saturation of the 3/day sweep).
- **paidBoost phantom spend — CONFIRMED.** `finalizeBoost` (paidBoost.ts:113-129) records an `ad_spend` row on confirm while the Meta call is an explicit TODO comment. The stager is reachable; the *money* isn't real. This converts my round-1 "premature" into **"unsafe to configure"** — post-client-1, with a fence now.
- **moneyLedger/scoreboard kind-filter miss (ledger.ts:40-53, scoreboard.ts:81-83), no refund handling (selfRecord.ts:48 — only positive events), IG DM flood cap absent (messages.ts) — all CONFIRMED.** Triage: DM cap matters in week 2 (the moment the bio link goes live); kind-filter is a two-line policy fix before the first payment; refunds are post-client-1 by definition but pre-month-2-billing.

The funnel's shape is unchanged: two broken rungs, both Cole-decisions (no public origin, no active offer) — plus now a short fix list *on the path*.

## 2. Cross-examination — BUILT vs SUPPLIED vs FIXED, final ruling

**Visionary's Proof Engine:** its named week-slice — "ref-link emitter plus one public standards page wired to /intake" — **already exists** (`trackLinks.ts`, `/api/standard`→`captureInboundLead`). The Proof Engine is not a build; it is `APP_PUBLIC_URL`, real benchmark bands, and a bio link. Ruling: **SUPPLIED.** The Combine Card render sliver is gym-lane proof; per Cole's own `online_proof_model` fact and the `training_only` refusal in `retention.ts:270`, it cannot feed the remote lane. Defer.

**Visionary's Delivery Cockpit:** correctly gated on `delivery_scope` at zero clients — the Contrarian wins the frame. But the Hole-Finder's #6 identifies the one sliver client #1 actually needs: the onboarding runway is tasks *about* artifacts; auto-drafting the day-0 welcome and day-1 intake into those tasks is small, inward, and due in week 4. Ruling: **one BUILT sliver, triggered by the first yes; the rest waits for a client to ask.**

**Contrarian's premature list:** I co-sign it wholesale for the business lane — voice, wearables, dashboards, MCP, portal. Where the Contrarian's "name the user" test cuts *for* me rather than against: the business lane's user is named (Cole, plus a warm list of real humans), and nothing below is a feature — it is four inputs and five small fixes. The four-Cole-inputs thesis survives every sweep amendment untouched: no finding changed what must be SUPPLIED; the sweep only added what must be FIXED on the way.

**Final order: SUPPLIED (public origin, warm list, offer price, benchmark bands) → FIXED (touch-cap/mislabel, DM cap, kind-filter, refunds) → BUILT (texted-tap, program fulfillment, runway drafts, bands config).**

## 3. FINAL — the 30-day plan to client #1, fixes inline

- **Day 0 (before the warm list is pasted): fix the outreach spine.** (a) `priorTouches` counts only *finalized* drafts — filter on signal status or `lastContactAt`, not raw signal existence; (b) touch cap: 3 touches without reply → `dormant` + one closing signal. ~15 lines total; without (a) the very first ungranted week sends "follow-up" copy to strangers.
- **Days 1–3 (Cole):** set `APP_PUBLIC_URL` + `MEDIA_PUBLIC_BASE_URL`; paste the warm list; run the Offer Probe — three variants, three tracked links.
- **Week 1–2:** sweep drafts 3/day; Cole sends the emailed, texts the phone-only (the **"I texted them" tap** ships here so the phone lane gets logged). Supply real benchmark bands — the Standard is *live*, contra the sweep; generic bands are the only dishonesty left in it. Bio link → minted `/l/` code → `/standard`. **Prerequisite before connecting IG:** the DM daily cap (mirror `INBOUND_PUSH_CAP=5`), so the first story can't flood the pipeline.
- **Week 3:** price and activate the leading variant; if "program" leads, attach the Stripe payment link (**program-sale fulfillment** — the one-off Offer + payment link + "send the sheet" onboarding task).
- **Week 4:** first yes → `convertLead` → runway, now with **auto-drafted welcome/intake**; set `STRIPE_WEBHOOK_SECRET`. **Prerequisite before the first payment lands:** the `kind:"client"` filter in `moneyLedger` and the scoreboard aggregates — two lines, policy consistency.
- **Immediately post-client-1, before month-2 billing:** `charge.refunded` handling so earned can decrement.

**Build list this justifies (in order):** touch-cap + mislabel fix (day 0) · DM cap (pre-IG) · "I texted them" tap (week 1) · program-sale fulfillment (week 3) · runway welcome/intake drafts (week 4) · kind-filter unification (the sweep's shared `businessPayments()` where-clause is the right shape) · benchmark-bands config surface (can slip; the code-table works once Cole's numbers are in it).

**Kill/defer, honestly:** paidBoost — **fence it**: do not set `META_ADS_TOKEN` until `finalizeBoost` moves real money; the ledger-honesty inversion is disqualifying. Partnership sweep (reachable but produces partners, not leads; needs a research key). Combine Card render, Delivery Cockpit beyond the runway sliver, athlete portal, SMS 10DLC, refund *automation* beyond decrement, all scale machinery. The Adversary's line still closes the seat: amplification of zero is zero — the machine is ready, the fixes are days, and the remaining inputs are Cole's hands only.

---

**Summary of what was done:** Read the entire round-1 record (11 seats, 5 sweeps) and re-verified every disputed claim in code. Key finding: the business-stack sweep's three dead-code verdicts (The Standard's `assessStandard`, `stageBoost`, partnership tools) are **wrong** — all three are invoked from `frontend/app/api/` routes (`frontend/app/api/standard/route.ts:48`, `frontend/app/api/crm/growth/route.ts:36-53`) that the sweep's backend-only grep missed. Its five logic defects (touch cap absence + gated-draft mislabel in `aurelius/crm/leadEngine.ts:133-137`, phantom spend in `aurelius/business/paidBoost.ts:113-129`, missing kind filters in `aurelius/crm/ledger.ts:40-53` and `aurelius/measurement/scoreboard.ts:81-83`, no refund handling in `aurelius/crm/selfRecord.ts:48`, no IG DM cap in `aurelius/instagram/messages.ts`) are all **confirmed** — the gated-mislabel is worse than reported (a new pending card mints daily per unconfirmed lead). The delivered ruling: four Cole inputs SUPPLIED first, five small fixes FIXED inline (two as hard day-0/pre-IG prerequisites), three-plus-one small BUILDs, paidBoost fenced until it moves real money. No files were modified (read-only charge honored); the deliverable above is the round-2 seat text for the council record.
