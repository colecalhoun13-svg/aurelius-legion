I have the grounding I need. Here is my seat's contribution.

---

# THE CHIEF OF STAFF — the operating model at full power

*Read on the substrate of `SYNTHESIS.md`. I am not re-litigating the fix list; I am describing the mind those fixes make possible, and the one capability that most changes what Cole can hold in a day.*

## The one thing a second operator is for

Cole's attention is a single serial thread. It runs one block at a time, pays a tax every time it switches, goes blind to the horizon the moment a session starts, and cannot be in the 4pm while thinking about the 6pm. That is not a discipline failure — it is the structural ceiling of being one person. A chief of staff's entire value is that he holds the *whole day in working memory* so the principal only ever has to hold the *current block*. Everything below is one claim: **Aurelius should carry the shape of Cole's day so Cole doesn't have to.**

The repo today is built cron-shaped — 07:00 briefing, 13:00 check, 21:30 debrief (`rituals/engine.ts`). Cole's life is event-shaped: a 5:30 wake, coaching blocks that run long, drives between sites, a lead that lands mid-session, an evening business build, a family dinner that must not be eaten by any of it. The gap between those two shapes is the gap between a well-written morning paper and someone in the room. Closing it is the work.

## The full-power day, in Cole's life

**5:30am.** Cole's phone doesn't show a briefing — it shows a *plan for a day already modeled*. Aurelius built a **Day Model** overnight: every calendar event resolved (declined ones gone, per DoD #3), each person-shaped block pre-joined to what the Brain holds (`sessionPrep.ts` already does the recall — today it dumps into a footer; at full power each note is attached to its event in a live structure). The biggest-risk line is real, not a footer: *"You have 4 coaching blocks and the girlfriend's thing at 7 — the only hour to touch the business build is 8–9pm, protect it or move it now."* His own lift is on the model too, programmed by him, tracked by it.

**7:40am, first block.** A parent texts mid-session: *"can Jake do Saturday instead?"* Cole can't stop coaching. Aurelius sees the inbound (the inbox-capture lane), recognizes Jake, drafts the reschedule reply against the actual calendar — **inward, `inbox.triage_draft`, a Gmail draft, nothing sent** — and holds it. It does *not* buzz Cole mid-rack; the salience gate (`core/salience.ts`) knows a reschedule is not a fire.

**11am, a lead comes in.** The `/intake` endpoint fires or a DM gets forwarded. This is the one that only a second operator catches: Cole is under a bar with an athlete. Aurelius captures the lead, researches it, drafts warm-list outreach (`outreach.draft`, inward), and surfaces *one* line at the next gap — not ten. DoD #4: same-day, within the hour, channel-aware. A one-man business cannot afford a lead to sit until evening, and a one-man coach cannot look at his phone at 11am. Only the tireless parallel mind bridges that.

**2:15pm, the day slips.** The 1pm ran to 2. This is the moment a cron spine is blind to and a chief of staff lives for: **cascade detection.** The Day Model re-solves the remaining hours — the drive to the second gym now collides with the 3:30, the 8pm business hour is at risk. Aurelius says, before Cole feels it: *"The 1 ran long — you'll hit traffic to the 3:30. I moved nothing, but the 8pm build is now your only deep-work; want me to hold it hard?"* That is the replan, not a ticket.

**6pm, drive home.** The pocket channel (Telegram) is the operator on the passenger seat. Cole voice-notes *"Jake trap bar two plates plus 25 for three, elbow barking again."* It logs the PR once (DoD #9), and on the third elbow mention in three weeks files *one* health signal — never a prescription (hard rule 5).

**7pm, family dinner.** Aurelius goes quiet, on purpose. The dinner is a protected block on the model; the streak sentinel and every non-critical push wait behind quiet hours. **Protecting the dinner is a first-class action, not the absence of one.**

**8pm, the business build.** The hour it fought to protect all day. Aurelius arrives with the evening teed up: the two leads still warm, the one draft awaiting his confirm, the single highest-leverage move — not a wall of red, a closed loop waiting for one tap.

**9:15pm, debrief.** Not "here's your day" — *"tomorrow starts 5:30, your first athlete is the knee rehab, and you told me last night you'd program her — that's still open."* The debrief→dawn thread that already exists, now anchored to the modeled tomorrow.

## The initiative model — colleague, not intern

The line between a trusted second operator and an over-eager intern is **earned, evidenced, and reversible** — and the repo already has the instrument for it. `trustLedger.ts` counts acted / confirmed / undone per action class; `suggestNextGrant` offers a keyhole only after **≥3 confirms with zero undos**. That is the growth path: Aurelius doesn't decide to do more — it *shows Cole the evidence* that it could ("you've confirmed inbox drafts 4× with no undos — want me to just handle it?") and waits for his hand on the switch. Autonomy never escalates its own autonomy (`checkGrantable` refuses scope `autonomy` by construction). The intern asks permission for everything or nothing; the chief of staff **acts inside exactly the mandate he's been given, finishes the loop to the last reversible step, and leaves the irreversible one for the boss.** That is `actionClasses.ts` made behavioral: inward finalizes, outward always stops.

The initiative *content* grows from `initiative.ts`'s deterministic scanners — but at full power those scanners run against the **Day Model and the CRM**, not just corpus staleness: "no lead touched in 3 days," "this block has slipped twice this week," "the business hour got eaten 4 nights running — that's the pattern, not the exception." It proposes the diagnosis; Cole picks the fight.

## The horizon: replan, cascade, the sick-day

The system must survive Cole, not just serve him. DoD #5: go dark 48h and Aurelius **proposes quiet for itself** — streaks survive excused, no nudges fire, re-entry is a triage not a wall. At full power it goes one step further: it can **declare a sick day for him.** Three missed morning blocks, a "feeling wrecked" voice note, an unbroken pattern — Aurelius collapses the day's model to essentials, drafts the two client messages that can't wait (holds them for confirm), moves the movable, and tells him *"I cleared what I could; here are the two things only you can send."* The week that replans itself is the same machinery at 7-day scale: Sunday planning reads the *actual* follow-through ledger (`IntentActionGap`) and re-solves, rather than pasting last week's template.

## The one capability that most changes what Cole can hold

**Build the Day Model: a single live, event-shaped representation of Cole's day that every surface reads and that re-solves itself when reality moves.**

Not the T-60 prep card alone (that's the first *feature* it makes possible, already named in Tier 4) — the **substrate underneath it.** Today the day is recomputed independently by the briefing, Today, midday, and session-prep, each from its own query, each drifting (the TZ bug in `SYNTHESIS` Fix-1 is exactly this disease: four readers, four "todays," one of them wrong). One Day Model, built after the TZ fix and delivery-verification land, becomes the organ that makes prep clock-anchored, cascade detectable, replanning possible, and the sick-day declarable. Every other chief-of-staff behavior in this document is a *read* or a *write* against it.

It is the difference between a mind that **narrates** Cole's day and one that **runs** it. Cole holds the current block. Aurelius holds the day. That is the second operator a first operator structurally cannot be.
