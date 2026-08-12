# BUILD PLAN — the super-Jarvis routing map (2026-08-12)

Cole's directive: *"work end to end with the fastest and most complete build
possible — the plan that makes sure everything is covered and routed the right
way, not willy-nilly … everything perfect, with inputs and outputs, not
random."*

This is that plan. It takes every 🟢 greenlit item from
`SUPER_JARVIS_ROADMAP.md` and **routes it into dependency-ordered waves**, so
substrate lands before the things that stand on it, and nothing is built that
nothing can invoke (repo rule 8). It is the build order and the contract.

## The one rule every item obeys
Each item ships with **INPUT → OUTPUT · INVOKER · GATE** before a line is
written:
- **Input / Output** — well-defined; no "does vibes," a named shape in and out.
- **Invoker** — the thing that calls it: a schedule entry, a mounted route, a
  registered tool, a **bus reaction**, or a control in the UI. No orphans.
- **Gate** — `inward` (finalizes inside a Cole-granted class, reversible,
  traced, lands on the Bridge) or `outward` (send/publish/spend — always stops
  for Cole's tap, non-grantable by construction).

Governing constraints, always on: hand back **at most one decision** per event ·
Cole stays the voice · **fallbacks everywhere** (no hard fail when a provider is
down) · gym athletes never become business targets · no fabricated proof before
client #1.

---

## Wave 0 — SUBSTRATE (everything reactive stands on this)
The reactive nervous system + the shared picture of the day. Build first; every
later wave attaches here instead of re-wiring.

| Item | Input → Output | Invoker | Gate | Status |
|---|---|---|---|---|
| **Router efficiency** | message/turn → same answer, fewer embeds + parallel prompt build | `getEmbeddingAdapter`, `buildSystemPrompt` (every turn) | inward | ✅ shipped |
| **Event bus** (#63) | `emit(event)` → 0..n traced, isolated reactions | `core/events.ts::emit` + `registerAllReactors()` at boot | inward | ✅ shipped |
| **Day Model** (#64) | clock+calendar+load+grants+open loops → one struct every part reads | boot singleton, refreshed by calendar-sync + bus events | inward | 🟢 next |
| **Delivery-verified notifications** (#65) | a push → confirmed receipt or a retry/escalation | wraps `sendToCole`/Bridge push | inward | 🟢 |
| **Nightly conversation distiller** (#59) | last 48h turns → durable memory + open threads | 21:xx schedule entry | inward | 🟢 |

## Wave 1 — THE FLAGSHIP (the thing that gives Cole his life back)
"A lead texts while you're coaching and the reply is already drafted, waiting
for your one tap."

| Item | Input → Output | Invoker | Gate | Status |
|---|---|---|---|---|
| **Lead-came-in catch** (#26) | `lead.inbound` → drafted reply waiting for one tap | bus reaction `auto_draft_reply` → `draftOutreach` | inward draft / **outward send** | ✅ shipped |
| **Nurture engine** (#29) | open lead + cadence → next drafted touch, never dropped | schedule sweep (bounded) + `lead.*` reactions | inward draft / outward send | 🟢 next |
| **Lead-reply capture** | inbound email on an outreach thread → lead flips to "conversing", drafts a reply | Gmail poll → `lead.reply_received` reaction | inward | 🟢 |

## Wave 2 — THE BUSINESS ENGINE (his own remote coaching business, from zero)
Everything filters `kind:"client"` — gym/training-only athletes are excluded in
the query, always.

| Item | Input → Output | Invoker | Gate |
|---|---|---|---|
| **Booking + payment** (#33/34) | intent → Cal.com slot + Stripe link → confirmed session/payment | `/api/booking` route + Stripe webhook (exists) | outward |
| **Churn radar** | engagement signals → at-risk flag + drafted save | schedule sweep | inward |
| **Discovery-call co-pilot** | lead + notes → live prep sheet + follow-up draft | tool + Bridge card | inward |
| **Paperwork autopilot** | won lead → agreement/intake docs pre-filled | `lead.won` reaction | inward |
| **Market/competitor intel** (#37) | niche → digest of what others charge/say | weekly schedule | inward |
| **Niche-wedge finder** | offer + market → where to plant the flag (marketing) | tool, on-demand | inward |
| **Consistent-pricing proposals** | scope → one price (up or down), never per-lead dynamic | tool | inward draft / outward send |
| **Capacity / money-truth** | roster + ledger → honest "what's real", says zero when zero | scoreboard + Bridge | inward |
| **Retention / renewal / referral** (#36) | client lifecycle → timed asks/drafts | schedule (dormant to client #1) | inward draft / outward send |
| **Partnerships** | non-gym/non-PT partner types → outreach drafts | tool + sweep | inward draft / outward send |
| **Productization = recommendations** | his delivery data → "package this" suggestions (not auto-built) | analyst | inward |
| **Business flight-simulator** (#35) | a plan → modeled outcome before he commits | tool, on-demand | inward |

## Wave 3 — COLE'S COCKPIT (body, faith, money — Athlete Zero)
His data first; he's the proof before any client exists.

| Item | Input → Output | Invoker | Gate |
|---|---|---|---|
| **Athlete Zero + WHOOP** (#44/#8) | direct WHOOP API → his readiness/recovery on the Bridge | 10–15 min poll (dormant until token) | inward |
| **n=1 self-experiments** (#45/#46) | his logs → tracked experiments + own readiness/injury signal | schedule | inward (signals only) |
| **Protect the sacred blocks** (#47) | calendar → defends faith/family/rest, proposes or (if granted) guards | schedule-protection (exists) | inward act / else propose |
| **Faith rhythm** (#48) | beyond the daily quote → a deeper cadence | schedule | inward |
| **Wealth ledger + personal finance** (#51) | manual/CSV import → his personal money dashboard | `/api/finance` route + import tool | inward (sensitive — spec source) |
| **Real P&L / tax-ready books** | business ledger → P&L + tax-ready export | analyst + route | inward |

## Wave 4 — THE COACHING EYE (deepen what already sees)
| Item | Input → Output | Invoker | Gate |
|---|---|---|---|
| **Predictive injury / readiness** (#7) | load+trend → early risk signal | training sweep | inward (signal) |
| **Digital twin per athlete** (#9) | history → per-athlete model, prove the value | tool + trends page | inward |
| **Cross-athlete pattern sense** (#11) | roster → what's working across athletes | weekly schedule | inward |
| **Auto block-review** (#13) | a finished block (Cole's definition) → what worked/didn't | `block.completed` reaction | inward (needs his def of "block"/"worked") |
| **Long-term development curves** (#14) | longitudinal data → trajectory per athlete | trends page | inward |
| **Cohort vs NATIONAL numbers** (#15) | roster + standards dataset → where they rank nationally | tool (needs real dataset) | inward |
| **Athlete-facing progress artifact** (#18) | athlete data → a shareable progress piece | tool | inward draft / outward share |
| **Milestone catches** (#20) | PR/threshold crossed → a caught moment | `pr.recorded` reaction | inward |

## Wave 5 — CLONE / SCALE COLE (draft as him, never speak as him)
| Item | Input → Output | Invoker | Gate |
|---|---|---|---|
| **Coaching-brain clone** (#21) | a coaching question → a DRAFT in his method for his approval | tool | inward draft (never unsupervised) |
| **Lead-facing AI drafts** (#22) | lead message → a drafted reply, he stays the voice | bus reaction (already the flagship shape) | inward draft / outward send |
| **Voice-cloned delivery** (#23) | HIS approved words → audio in his voice | tool, on-demand (dormant until provider) | outward (his content, his tap) |
| **Board of directors** (#58) | a real decision → the council aimed at it | tool, on-demand | inward |

## Wave 6 — CONTENT & BRAND (the outward engine, already gated)
| Item | Input → Output | Invoker | Gate |
|---|---|---|---|
| **PR → proof post** (#39) | a recorded PR → drafted proof content | `pr.recorded` reaction | inward draft / **outward publish** |
| **Content drafts in his voice** (#40) | topic → draft in brand voice | tool + schedule | inward draft / outward publish |
| **Multi-channel reels** (#41) | one idea → per-channel cuts | tool | inward draft / outward publish |
| **Content-outcome loop** (#43) | published + attribution → what to make more of | analyst | inward |
| **Auto-documentarian** (#38) | his day's raw moments → organized raw material for content | schedule/capture | inward |

---

## Deliberately parked (not built speculatively)
Society-of-agents (later stage) · entity pages / horizon runner (calendar notes
instead) · film/VBT bar tracking · recruiting D-thresholds · newsletter
broadcast · price-raise-on-existing (honest pricing) · borrowed-audience ·
gym/PT-clinic partnerships · wearable interaction surfaces · local models
(deploy-era). Un-park only with Cole's word and the missing inputs
(pricing/capacity/the standard/datasets) in hand.

## How a wave gets built (the discipline)
1. Spec each item's INPUT → OUTPUT · INVOKER · GATE (this doc is the index).
2. Build on existing engines — reuse `draftOutreach`, `executeAction`,
   `surfaceSignal`, the bus — never a parallel second implementation.
3. Verify live: backend `tsc` + `reachabilityAudit` + `smokeSuite` (real
   Postgres), frontend `tsc`/`next build` when touched.
4. Adversarial council review (correctness · constitution · reachability)
   before merge.
5. Ship the vertical slice; let Cole steer the next wave.
