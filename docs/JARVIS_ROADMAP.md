# JARVIS ROADMAP (2026-10-13)

**Ordering rule:** security → reliability → highest goal-movement per build-hour.
Respect the unfreeze gates (nothing built ahead of the data that would use it) and the
<20-min/day attention budget. Effort in Claude Code sessions: **S** ≈ 1, **M** ≈ 2–3,
**L** ≈ 4+. "Moves" = the `STATE_OF_AURELIUS.md` capability # and the level it reaches.
Prompt map → `docs/SUPER_JARVIS_ROADMAP.md` (its #IDs); "NEW" where none fits.

## Next 2 weeks — stop the bleeding, make it trustworthy
These are small, high-certainty, and all defend what you already have.

| Step | What it changes in your day | Moves | Effort | Depends on | Verify | Prompt |
|---|---|---|---|---|---|---|
| **1. Ship the security patch** | The app lock can't be skipped by a stranger | #12 → 3 (holds) | S (done, needs merge) | PR #91 merge + frontend redeploy | the `curl` bypass test returns 401/302, not 200 | NEW (hygiene) |
| **2. Daily doctor push** | One morning text lists what's actually broken + the fix, so you stop finding out weeks late | #14 → 3; #11 alerting | S | reuse `runDoctor()` + Telegram push | force a FAIL (pull a key) → push arrives | #65 delivery-verified |
| **3. Fix stranded vectors + guard** | The brain stops silently forgetting; recall returns your real history | #5 → 3 | S | real embeddings key; backfill `--force` (mock guard already shipped) | SQL #7/#8: one model, 0 null vectors | NEW (foundation) |
| **4. Publish Google OAuth + `GOOGLE_GMAIL_REDIRECT_URI`** | Gmail + Calendar stop dying every 7 days | #1/#4 reliability | S (your console task) | Google Cloud console | token survives >7 days (doctor green) | NEW (hygiene) |
| **5. Top up Anthropic/xAI** | Reasoning runs on the intended model, not a fallback | #11 → 3 (clean) | S (billing) | — | doctor shows 0% failover | Governing rule (fallbacks) |

*Attention note: steps 1, 4, 5 are mostly your 20-minute ops tasks, not build sessions.*

## Next 6 weeks — make it feel like Jarvis (connect the substrate you already paid for)
Each is connection work on things that exist, ordered by life-impact per hour.

| Step | What it changes in your day | Moves | Effort | Depends on | Verify | Prompt |
|---|---|---|---|---|---|---|
| **6. Due-task / event nudge** | It pings you *when* something is due or a meeting's about to start — not just at 7am | #3 → 3 | M | Day-Model read; salience + Telegram rail | set a task due in 10 min → nudge fires once | #64 Day Model (⚠ you marked Horizon #62 ❌ "calendar notes" — this is the scoped, calendar-note version, not the rejected runner) |
| **7. Life events on the bus** | It reacts to your day (mail needs you, calendar moved, promise overdue), not only to a clock | #6 → 4 | M | event bus (`core/events.ts`) + reactors | emit a test life-event → a gated Bridge card appears | #63 event bus (keystone) |
| **8. Warm-list surface + one-tap send** | You paste 30–50 names; it drafts; you tap send — the one motion that gets a first client | #7 → 3 | M | business-page UI + existing `outreach.draft`/gated send | import 5 names → 5 drafts → one tap sends one | #26 lead catch (flagship) + #27–32 |
| **9. Close the voice loop** | You talk to it and it talks back (voice note out, mic in the app) | #13 → 4 | M | `voice/tts.ts` + Telegram `sendVoice` + mic | send a voice note → spoken reply returns | #52/#53 voice; #23 voice-clone |
| **10. Missions that act (gated)** | Overnight it doesn't just research — it *does* the inward step and leaves it reversible on the Bridge | #6 → 4 | M–L | `missions/engine.ts` + `autonomy/executor.ts` gate | a scheduled mission finalizes one inward action, undoable | NEW (foundation; near #66) |
| **11. CI `verify` gate** | Changes stop silently breaking; red blocks merge | #14 reliability | M | GitHub Actions + ephemeral Postgres | open a breaking PR → CI fails | NEW (hygiene) |

## Later — gated (do NOT build until the gate opens)
| Step | Gate that must open first | Moves | Prompt |
|---|---|---|---|
| Content→distribution flywheel (one angle → a week of grounded posts) | A niche picked + a reason to post (audience build is long-horizon) | #9 → 3 | #40/#41/#43 |
| Stripe checkout + one auto-fulfilled digital product (first passive $) | An audience exists to sell to **and** a defined offer | #8/#9 | #33/#34 booking+payment |
| Client-lifecycle depth (retention/onboarding/SMS/paperwork) | **Client #1 exists** | #8 → 3 | #36 retention etc. |
| Next.js 15 major upgrade (clears residual DoS advisories) | A planned breaking-change session (not urgent) | #12 | NEW (hygiene) |
| Athlete analytics depth (roster patterns, dev curves) | A real roster with logged data | coaching-eye | #11/#14 |

## What I'd cut or not build
- **Don't build more business/marketing engines.** `offers/positioning/marketing/paidBoost/
  partnership/productization/marketIntel/brand/flightSim/analyst` already exist for a 0-client,
  0-audience business. Freeze them `config`; don't extend until there's data. (Your own
  `business/profile.ts`: "a pipeline with nothing in it earns nothing.")
- **Don't build the rejected items.** Horizon runner (#62) and entity pages (#60) you already
  marked ❌ — step 6 honors that with the scoped calendar-note version, not a rebuild.
- **Don't build passive-income products now.** Every model is audience-gated; building a store
  before an audience is the 0-client CRM mistake again.
- **Don't force Next 15 or the Tailwind-v4 audit fix** this cycle — breaking changes for
  DoS-class issues on an app-locked single-tenant system; schedule deliberately.
- **Rent, don't build, the commodity limbs** (client app, billing, scheduling, email delivery):
  TrueCoach/Everfit, Stripe, Calendly, Kit — ~$0–30/mo. Point the bespoke brain at the moat
  (your day, your judgment, your outreach), per `OBJECTIVE_REVIEW_2026-10.md`.

## Sequencing logic
Security (1) and reliability (2–5) first because a Jarvis you can't trust or that silently
degrades is worse than none. Then 6–10 are the *connections* that convert "speaks at 7am"
into "acts across my day," cheapest-life-impact-first; every one reuses built substrate, so
they're M not L. 11 (CI) runs alongside to keep 6–10 from rotting. Everything audience- or
client-gated waits for its gate — the whole point.
