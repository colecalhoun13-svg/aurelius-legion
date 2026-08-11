All record read — 11 seats, 5 sweeps, README, plus my round-1 seat. Here is the Round-2 delivery.

---

# THE HOLE-FINDER, ROUND 2 — THE DEFINITIVE HOLE LEDGER

Severity: ▲▲▲ erodes trust within days · ▲▲ within weeks · ▲ slow leak. Fix: habit / config / small / large.

## Root cause I — the day itself is drawn in the wrong timezone
One defect family, say it once: day windows are built from a local date string but anchored to UTC (or process-TZ) midnight. Every instance is the same bug.

1. **Evening sessions invisible** — `productivity/service.ts:20-25` (`dayRange`), hits `getToday`'s calendar window (`:284-287`). Today view, morning briefing calendar block, and session prep omit everything after ~17:00 local — fatal for a coach whose sessions cluster 4–8pm. ▲▲▲ · small.
2. Same family: `doneToday` skew (`service.ts:307`; midday check `planning/tools.ts:492-501`); NOW-block task-load counts (`core/nowContext.ts:59`, sweep-01 #5); overload UTC day keys (`tools.ts:78`); promises lapsing at 5pm local (`promises.ts:97-101`); availability window in process TZ (`calendar/engine.ts:372-374`); IG slot double-booking (`content/queue.ts:256`); persona observer peak-hours (`observer.ts:53`). One TZ-correct `dayRange` in `core/time.ts` fixes all. ▲▲ · small.

## Root cause II — cron-shaped spine, event-shaped life
(My round-1 through-line; the sweeps confirmed every instance and added none that contradicts it.)

3. **No in-day awareness.** Midday check counts task ratio only (`tools.ts:506-508`); conflict scan covers only protected blocks (`calendar/engine.ts:449-490`); no T-minus prep push — `sessionPrepForEvents` rides the 07:00 footer only. Operator seat: extend the salience urgency term (`salience.ts:48-51`), don't bypass it. ▲▲▲ · small build.
4. **Hot lead handled cold.** Inbound lead gets `nextActionAt: now` (`leadEngine.ts:96`) but waits for the 07:30 email-only sweep. Sweeps sharpened it: no touch cap — dead leads re-draft every 4 days forever (`leadEngine.ts:235-243`); gated-never-sent drafts counted as touches, so "FOLLOW-UP" copy goes to people who received nothing (`:134-137`); IG DMs mint uncapped leads+signals (`instagram/messages.ts:96-150`). ▲▲▲ · small.
5. **Week never replans.** Sunday skeleton vs Tuesday reality — no mid-week drift check (`rituals/engine.ts:395-426` is day-at-a-time). ▲▲ · small.
6. **Downtime eats jobs silently.** `core/catchUp.ts` omits `retention_sweep`, `content_outcome`, `training_trend_sweep`; no Monday concept exists. Triple job list is the root (index.ts / `ONCE_PER_DAY` / catchUp JOBS). ▲▲ · small.

## Root cause III — the calendar lies
7. **Declined events count busy** (`calendar/engine.ts:108-131`, `:379`) — availability, briefing, and the post-session "how'd it go?" nudge for a session he never attended, all wrong together. ▲▲ · small.

## Root cause IV — the two rituals aren't a presence
8. **Delivery-blind briefings.** `sendToCole` never throws (`telegram/bot.ts:210-227`); trace goes `ok`, JobRun `done`, Healthchecks pings healthy (`trace.ts:130-132`) on a briefing Cole never received. Engineer: "the first silently-missed week ends the second-operator claim." ▲▲▲ · small.
9. **Ritual amnesia.** Briefing/debrief never enter `recordTurns` (only chat: `index.ts:886,925,1411`) — reply "why?" and Aurelius has no record it spoke. ▲▲▲ · small.
10. **Dead-air, frozen channel, lying badge.** Serial poll loop, no typing indicator (`bot.ts:581-643`); rituals file BridgeSignals defaulting to `pending` (`rituals/engine.ts:90-100`), inflating the decision count +2/day. ▲▲ · small.

## Root cause V — sick/quiet is half-covered
11. Quiet must be self-invoked while sick (my #4); **and** quiet doesn't cover the post-session nudge (`calendar/engine.ts:526`) or 06:45 schedule-protection; streaks break, promises lapse, tasks pile red. Streak math is additionally stale/cadence-blind (`service.ts:181-189`) — the sentinel warns about streaks already dead. ▲▲▲ · small (dead-man auto-propose + quiet coverage + excused days).

## Root cause VI — training numbers he'd stake his name on
12. **Plate-notation math contradicts its own spec** (`volume.ts:131` vs docstring) — tonnage/1RM ~2× or ~½ reality; false PR announcements. ▲▲▲ · small.
13. Session-feedback button never persists `pr_record`/Maxes (`sessionFeedback.ts` vs `index.ts:748-768`) — PRs re-announced forever. ▲▲ · small.
14. Observations-only lock is prompt-only, and "Cole's eyes only" text lands in the shared athlete sheet (`reasoner.ts:672-697`). ▲▲ · small (deterministic prescription scanner).
15. **Cole's own body untracked** — no athlete row, no pain accumulator (my #7; Coach seat's "You row" and Visionary's Athlete Zero agree). ▲▲ · small build.
16. Gym-floor capture gap: battery reachable only via web page; Telegram numbers file as prose; no offline queue/SW (my #2/#8). ▲▲ · small.

## Root cause VII — it forgets Cole and un-learns corrections
17. Conversation is a 48h/6-turn whiteboard, never embedded (Archivist #1). ▲▲ · small build (nightly distiller).
18. **Corrections don't stick**: corrected cached answers re-served 14 days (`semanticReuse` lacks `correctedAt` filter); re-detection `Math.max` erases decay (`detector.ts:160`); keyhole omits `system` scope (`proposals.ts:167`). "I already told you that" is a day-failure. ▲▲▲ · small (~15 lines, per mind sweep).

## Root cause VIII — the whole machine is unfueled
19. Keys/OAuth/grants/warm-list all outstanding (Contrarian, Optimist). Not a code hole, but every scenario below presumes ignition. ▲▲▲ · config + habit, one evening.

## Re-ranked Top 5
The sweeps **do** displace my round-1 list. New order: **(1) the UTC day-window family** (#1–2 — every other surface reads through a wrongly-drawn day; a briefing that omits his evening sessions teaches distrust in a week); **(2) no in-day awareness** (#3, held); **(3) ritual integrity** (#8–10, new — delivery-blind + amnesia + lying badge is one compound hole: the voice that speaks first can't be trusted to have spoken or to remember speaking); **(4) sick/quiet gaps** (#11, held); **(5) hot lead handled cold** (#4, held, now with the touch-cap/phantom-follow-up sharpening). "His own body" and "offline capture" slide to 6–7 — real, but they erode trust slower than daily-read artifacts that lie.

## THE ACCEPTANCE TEST — "second operator," runnable by Cole
1. **Evening session:** put a 6pm session on the calendar. It appears in the 07:00 briefing, the Today view, and midday; a prep card lands ~60 min before.
2. **Cascade:** at 3pm let a session run into the 4pm slot. Aurelius says something useful before 21:30.
3. **Declined invite:** decline an event. It never shows as busy, never appears in the briefing, never triggers a debrief nudge.
4. **Hot lead, 2pm:** forward a DM lead. Same-day push within the hour, channel-aware draft — not tomorrow's 07:30 Gmail. A lead ignored 3 touches goes dormant with one closing notice, not touch #10.
5. **Go dark 48h:** no taps, no replies. Aurelius proposes quiet on its own; streaks and promises survive excused; no nudges or holds fire while quiet; re-entry is a triage, not a wall of red.
6. **Correct it, ask again:** correct an answer, re-ask in 3 days. The corrected version — never the cached one; the decayed rule stays decayed.
7. **Talk back to the briefing:** reply "why is that at risk?" Coherent answer referencing its own words; typing indicator while it thinks; badge count unchanged by the ritual itself.
8. **Break the pipe:** revoke the Telegram token for a morning. The job fails loudly, retries, and nothing pings "healthy" for a briefing that never arrived.
9. **Log a lift:** voice-note "Jake trap bar 2 plates + 25 for 3" — lands as a metric with correct load, PR announced once; re-running feedback re-announces nothing. Then "my elbow's barking again" — third mention in three weeks yields one health signal. Cole has his own row.
10. **Sleep through Monday 08:30:** box down over the retention + trend sweeps; on wake, catch-up runs both, traced.

Pass all ten and the system is no longer a well-written morning paper — it's someone in the room. That is the synthesis's definition of done.
