I've grounded myself in NORTH_STAR, the 3.4 vision doc, the Mac Mini plan, the Demand Engine roadmap, and the actual module tree (voice-in exists, PR detection exists, the attribution chain exists but emits nothing, the assessment engine exists, the public media origin exists). Here is the Visionary seat's delivery.

---

# THE VISIONARY — Eight Big Moves

Ranked by life-change-per-effort. All rails hold: outward always gates, autonomy never self-escalates, gym athletes never become targets, honest failure everywhere.

## 1. The Earpiece — Aurelius speaks

**Vision.** Cole's day is hands-on-a-barbell, eyes-on-an-athlete, phone-in-pocket. The second operator he needs is *audible*. He says "Aurelius" into his AirPods on the drive to the gym and the morning briefing is spoken — risk line, first move, what's waiting at the gates. He answers out loud; missions launch. By evening the debrief plays on the drive home and the "tomorrow starts with" commitment is made in his own voice. Aurelius stops being an app he opens and becomes a presence that rides along.
**Second operator, not feature.** An operator you must read is an advisor. An operator you converse with while doing your actual job is a colleague.
**Foundation.** Voice-in is already built (`aurelius/telegram/voice.ts`, Groq Whisper, dormant-honest). Rituals already push to Telegram. One Box chat is the single pipe. Only voice-OUT is missing.
**Week slice.** TTS replies on the Telegram bridge: voice-note answers to voice-note questions, plus the 07:00 briefing and 21:30 debrief delivered as audio. One provider adapter, honest-dormant without a key.

## 2. Gym-Floor Capture — session mode

**Vision.** Between coaching cues, Cole mutters into his phone: "Marcus, trap bar, 405 for 2, grindy. Dre tweaked his ankle warming up." Aurelius parses that ramble into structured set rows, flags the PR the moment it lands ("405x2 is a lifetime best — tell him"), files the ankle note on Dre's timeline, and the Monday trend sweep already knows. The whole training floor becomes captured, structured, compounding — with zero typing, ever. This is the second brain finally standing where Cole's life actually happens.
**Second operator.** It's the difference between a filing cabinet and a scribe who follows you around and already knows everyone's numbers.
**Foundation.** `telegram/voice.ts` (STT), `training/prDetection.ts`, `battery.ts`, `sessionFeedback.ts`, the athlete pages, the PWA share target. All the organs exist; nothing connects speech to structure.
**Week slice.** A `/session` Telegram mode: voice notes parse (LLM, deterministic fallback) into set rows against the roster, immediate PR callback, unrecognized names ask once. Observations only — never a prescription.

## 3. The Proof Engine — the public scoreboard

**Vision.** Calhoun Performance's binding constraint is that nothing arrives. Cole's rarest asset is real tracked numbers. Fuse them: a public "See where you stand" page — enter your lifts, get scored against real standards, and getting your score *is* the lead capture. Every piece of content carries a ref link; every lead traces to the angle that earned it; the CRM stops rendering encouraging zeroes because named humans start entering the Lead table. Aurelius runs the whole loop inward — drafts the content, mints the links, scores the entrants — and Cole confirms every publish.
**Second operator.** A feature waits for leads. An operator builds the road to the door, watches who walks it, and reports which sign worked.
**Foundation.** `assessment/benchmarks.ts`, the public origin in `media/host.ts`, `/intake`, `crm/trackLinks.ts`, the fully-built-but-never-fed attribution chain the Demand Engine council found (`Lead.angleId` populated by nothing). Excludes gym athletes in the query, per the law.
**Week slice.** The ref-link emitter (the roadmap's own named #1 missing line of code) plus one public standards page wired to `/intake`.

## 4. The Horizon Runner — prep before Cole knows he needs it

**Vision.** Sixty minutes before anything on the calendar, a card lands in Cole's pocket: who it's with, last notes, open threads, the draft he'll want, the number he'll be asked for. A lead call comes pre-briefed with the lead's whole history. A training block ends and next-block prep questions are already queued. Cole never walks into anything cold again, and never asked for any of it.
**Second operator.** Initiative is the line between assistant and operator. This is Aurelius acting on the clock's behalf, inward, traced, reversible.
**Foundation.** The NOW layer (countdowns already in every prompt), calendar sync every 15 minutes, the initiative pulse, missions engine, the granted executor. NORTH_STAR already names "the horizon watcher" as a reconvene item.
**Week slice.** A 15-minute poller that fires an event-prep mission at T-60 for calendar events matching known leads/clients/athletes, output to Telegram.

## 5. The Apprentice — programming intelligence, observations only

**Vision.** Aurelius studies how Cole programs the way an intern studies a master coach: every sheet, every week-over-week change, every deload becomes a ReasoningCacheEntry; patterns compile ("Cole pulls volume 30% pre-camp"). It never writes a program. Instead it hands Cole a mirror — "week 4, and here's what you usually do at week 4; here's the athlete who breaks your pattern" — and pre-stages the questions. Cole programs faster and sharper; Aurelius quietly becomes the only apprentice who has seen every rep he ever wrote.
**Second operator.** It learns the *craft*, not the data — the compounding-intelligence promise pointed at the thing Cole is best at.
**Foundation.** Compiled Understanding is live in the main brain, the Sheets tool reads real sheets, `training/reasoner.ts` exists, signals-only is constitutional.
**Week slice.** A sheet-diff ingester: each week's programming delta becomes cache entries; Sunday surfaces the top three detected patterns as proposals.

## 6. The Film Room — the NAS becomes an eye

**Vision.** The UGREEN NAS is bought as backups. Make it the film vault: every athlete video drops in a watch folder, auto-links to the athlete, and Cole's 20-second voice annotation becomes the searchable movement history. "Show me Marcus's squat depth over six months" is one question. Proof clips for the outward lane (client-kind only, always gated) come from the same shelf.
**Foundation.** The vault, `media/host.ts`, `research/youtubeTranscript.ts`, voice-in, the Mini plan's 4-bay "athlete video later" note.
**Week slice.** Watch-folder ingest → athlete-linked media rows → voice-note annotations attached and embedded for recall.

## 7. The Delivery Cockpit — Aurelius is the product

**Vision.** The remote business's product is delivery, and Cole used to deliver on Sheets and texts. Aurelius becomes the delivery platform: weekly check-in drafts assembled from each client's actual data, a private progress page per client on the public origin, renewal signals before the block ends. The first paying client onboards onto Aurelius itself — the second operator becomes the moat.
**Foundation.** The full `crm/` chain (onboarding, retention, sms, ledger), the share page, Gmail drafts. Gated on the `delivery_scope` question — so the slice stays Cole-facing.
**Week slice.** The weekly check-in assembler: data-grounded draft per active client into Gmail drafts, named in the briefing.

## 8. Athlete Zero — nobody asked about this one

**Vision.** Cole coaches everyone and nobody coaches Cole. Aurelius opens an athlete file on *him*: his training, sleep, streaks, load, the same trend sweep and PR detection the roster gets — signals only, Cole owns every decision, exactly as the law requires. The debrief starts speaking to him the way he speaks to his athletes. The coach finally has a coach's mirror, and the persona layer learns him from his body, not just his messages.
**Foundation.** The entire training engine, habits, streak sentinel, the Operator Score. One new row: Cole on his own roster.
**Week slice.** Cole as a special athlete record fed by session-mode captures; his own trend line appears in the Sunday scoreboard.

---

The through-line: the organs of a super-Jarvis are mostly built. What's missing is *presence* (1, 2), *initiative* (4), and *the outside world* (3, 7). Ship the Earpiece and Gym-Floor Capture first — they change every single day; the Proof Engine changes the business's one binding constraint.
