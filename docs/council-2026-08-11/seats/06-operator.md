**THE OPERATOR — presence and interaction read** (grounded in code as of 2026-08-11)

## 1. Today's presence, honestly

Across a normal weekday Aurelius speaks first exactly twice, guaranteed: 07:00 briefing and 21:30 debrief (`aurelius/index.ts:1711-1716, 1768-1773`, both `sendToCole`). Conditionally: 13:00 midday check — which correctly stays silent when Cole is on pace (`planning/tools.ts:506-508`) — plus salience-gated pushes (score ≥ 0.72, quiet hours 22:00–07:00, `core/salience.ts:71-78`) and the ~21:30 streak sentinel. Everything else (05:30 triage, 07:30 outreach, sweeps) works silently and reports through the briefing.

The ritual copy is genuinely operator-grade. The debrief commits "Tomorrow starts with: X. I'll hold you to it at dawn" (`rituals/engine.ts:446`), and the briefing checks it: "Last night you said today starts with X — it's not on the deck. Put it there, or tell me what changed" (`rituals/engine.ts:351`). That debrief→dawn thread is the single most operator-like behavior in the system — it's a *relationship across days*, not a report. The midday line ("Half the day is gone: 2/7 moved... Pick the one that matters") earns its interruption.

But the cadence is still a courteous cron job: two fixed brackets and a long mute between 07:30 and 21:15 unless something crosses 0.72. Nothing speaks *at the moment Cole's day demands it* — the NOW layer (`core/nowContext.ts`) computes event countdowns for the prompt, but no push is anchored to "your 4pm session is in 15 minutes, here's the prep." Presence today is a well-written morning paper and a nightly ledger, not someone in the room.

## 2. THE PRESENCE LADDER

**Rung 0 — today.** Two brackets + salience pushes + confirm buttons on the thumb. Cost: paid. Kill-switch: `/quiet` (holds all four pushy rituals, `planning/quiet.ts:34`) — already right.

**Rung 1 — conversational closure (do first, see §4).** No new channel. Make the push channel and the dialogue one thread: record ritual output as conversation turns, send `sendChatAction: typing` while thinking, stop serializing the bot. Cost: days. Annoyance risk: zero — nothing new arrives. This rung is invisible and changes everything.

**Rung 2 — clock-anchored interrupts.** One new interrupt class: dueAt-driven, tied to Cole's calendar shape (session prep 15 min out — `sessionPrepForEvents` already computes it, it just rides the 07:00 footer today). Position on interrupts-vs-digests: keep digest batching as the default and let *time*, not enthusiasm, be the only new reason to interrupt. The salience urgency term (`salience.ts:48-51`) is the mechanism; extend it, don't bypass it. Annoyance guard: max one clock-anchored push per event; kill-switch: same `/quiet`.

**Rung 3 — voice-out, reply-in-kind.** ElevenLabs (or local TTS on the Mini) answering Telegram *voice notes with voice notes* (`sendVoice`). Position: yes, but strictly reply-in-kind — voice-in gets voice-out; typed text never does; the briefing stays text because a briefing is scanned, not listened to. This is what makes gym-floor mode and car mode real: both are just "Cole's hands are busy," and reply-in-kind covers both without building a mode. Cost: ~$5-22/mo or whisper.cpp+local TTS at Mini deploy (already the plan, `telegram/voice.ts:8`). Annoyance: a 90-second voice essay — cap spoken replies at ~30s, longer answers say "sent the rest as text." Kill: no `ELEVENLABS_API_KEY` → dormant, per hard rule 4.

**Rung 4 — the Mini as ambient presence.** The always-on box's presence value is *reliability and latency*, not spectacle: sub-second capture, catch-up briefings after downtime (`core/catchUp.ts` already does this), local STT. Hammerspoon "hands" stay gated behind the grant system exactly as DEPLOY_MAC_MINI.md Part 9 specs. Position: no wake-word speaker in the house yet — a mic that's always listening is a trust spend with no salience gate, and the constitution's whole design is that interruptions are *scored*. A wake-word is an interruption Cole makes of Aurelius; fine — but build it after voice-out proves the loop.

**Rung 5 — full Jarvis.** Interruptible spoken dialogue, ambient awareness, desktop hands. Only reachable if every rung below kept the channel unmuted. The etiquette rule that holds the whole ladder: *Aurelius never adds a recurring push without removing or merging one* — presence budget is fixed; salience decides who spends it.

## 3. Three interaction defects breaking the operator illusion (verified)

**(a) Aurelius forgets what it just said.** Rituals push via `sendToCole` but are never written to conversation memory — `recordTurns` is called only from the chat endpoint (`index.ts:886, 925, 1411`), and `recentConversationBlock` (`memory/conversation.ts:45`) is the only short-term thread in the prompt. RitualInstances aren't embedded either (no ritual source in `retrieval/`). So when Cole answers the 07:00 briefing with "why is that at risk?", the pipeline has *no record that Aurelius spoke*. An operator who initiates and then can't sustain the conversation he started is the illusion breaking at the exact moment it matters.

**(b) The bot goes silent and deaf while thinking.** Updates are processed sequentially inside the poll loop (`telegram/bot.ts:581-643`, awaited `handleCommand` with a 90s loopback timeout at line 480). No `sendChatAction` exists anywhere in `telegram/`. A voice note gets "Heard: ..." then up to 90 seconds of dead air, and a second message — even `/brief` — queues behind the first. Dead air plus a frozen channel reads as "app," not "operator."

**(c) The rituals violate the badge discipline the system fought for.** `fileInstance` raw-creates its BridgeSignal without `status` (`rituals/engine.ts:90-100`), so the schema default "pending" applies (`schema.prisma:397-401` documents this exact failure — 460 receipts as 460 decisions). Every briefing and debrief inflates the awaiting-decision count by two per day. A bell that lies daily gets muted, and a muted channel kills every rung above.

## 4. The non-negotiable

**Conversational closure (Rung 1).** Presence is not more messages — it is that the voice which speaks first at 07:00 and the voice that answers "why?" at 07:03 are demonstrably the same mind, still typing, still holding the thread. Fix (a) and (b) — ritual turns into `recordTurns`, a typing indicator, unserialize the loop — and today's two brackets already *feel* like an operator. Skip it, and voice-out, car mode, and the Mini are production values on a cron job.
