I have the substrate. Here is the architected dream.

---

# THE PRESENCE ARCHITECTURE — the seat that makes Aurelius *there*

## The thesis: one mind, many windows

Today Aurelius is a place Cole goes — a Telegram thread, a web Bridge. Presence is the inversion of that: Aurelius is *where Cole already is*, and the surfaces are just windows onto a single continuous mind. The architecture that makes this true is already latent in the repo. The Mac Mini (DEPLOY_MAC_MINI.md) is the **one brain, always-on, sovereign**. The Bridge (`core/bridge.ts`) is the **one nervous system** every surface reads and writes. The salience engine (`core/salience.ts`) is the **one attention gate**. Nothing about presence requires a second mind — it requires more *windows* onto the mind that exists, and a voice so the mind can reach *out* through them, not just answer when tapped.

So the design rule for every surface is identical: **a surface never holds state.** The car, the wrist, the gym phone, the desktop — each is a thin client that renders the Bridge and streams audio to/from the Mini over Tailscale. Conversation memory, the salience queue, grants, the compiled-pattern lens — all central. Cole starts a thought in the car (`transcribeAudio`, `voice.ts`) and finishes it at his desk mid-sentence, because there was only ever one conversation. That coherence is the whole game, and it's free the moment surfaces stop being apps and become windows.

## What Aurelius is on each surface

- **Phone / Telegram** — the pocket window it already is (`bot.ts`), but with a voice track added. Text when quiet, voice-note reply when Cole spoke first.
- **The car** — the flagship presence surface, because Cole *drives between things all day*. Hands-free, eyes-free, full-duplex spoken dialogue. This is where the briefing stops being read and starts being *heard*.
- **The gym floor** — a wrist tap or one wake-phrase captures "Jake trap bar two plates and a quarter for three" straight into the training log. Signals-only on the way out (the `write_feedback` lock, G5). Aurelius is silent here unless summoned — a coach mid-session cannot be interrupted by an opportunity ping.
- **The home (the Mini itself)** — the ambient anchor. A single far-field mic in one room, wake-word-gated, is the *most* restrained surface, not the most invasive (see etiquette).
- **The desktop** — the Delivery Cockpit and, eventually, Hammerspoon "hands" (DEPLOY §9.4) — the only surface where Aurelius *acts* on the machine, and only inside granted classes.
- **The wrist** — a salience terminus, not an input. It buzzes only for what `shouldPushNow` already rates ≥0.72-or-critical. A watch that only ever shows the things that cleared the gate is a watch Cole trusts.

## The interaction model, positions taken

**Summoned by default; proactive by salience.** These are the two existing modes and they are correct. Cole's phone lights up only when `shouldPushNow` fires (`salience.ts:71`) — that logic is the etiquette engine and it already exists. Presence does not mean *more* interruption; it means the interruptions that pass the gate arrive *in the right modality for where Cole is*.

**Wake-word for capture, never always-transcribing.** Take the strong position: the home mic and the car are **wake-word gated** (a local hotword — "Aurelius" / "Marcus"), not continuously recording. Ambient *always-listening* is deferred forever unless Cole explicitly asks; the constitution's "act inward, gate outward" has a presence corollary — **capture inward, retain gated.** Even after the wake word, nothing enters durable memory (`recordTurns`, the nightly distiller) without passing salience and leaving a visible receipt on the Bridge. Cole can always see the last thing it heard and delete it.

**Interruptible full-duplex.** Real Jarvis is barge-in: Cole talks over the reply and the reply stops. This needs streamed STT + streamed TTS with a voice-activity cutoff on the output — architecturally, the Mini runs local Whisper and a local TTS process, and the token stream from the fast tier drives audio synthesis incrementally.

## The latency architecture a felt-instant Jarvis requires

The chain that makes a voice feel *present* rather than *submitted*:

1. **Local STT** — whisper.cpp on the Mini (DEPLOY §9.3), replacing the Groq hop in `voice.ts` for zero network round-trip.
2. **Fast conversational tier** — Groq is already wired (`engines/groqEngine.ts`) as the sub-second lane; the router (`llm/router.ts`) already picks tiers by fit. Conversational turns route to Groq; `/deep` still escalates to Opus.
3. **Warm prompt cache** — `CACHE_BREAK` and the two-half STATIC/LIVE assembly already exist precisely so the persona+identity+tools prefix is cached. A spoken turn re-pays only the LIVE tail.
4. **Streamed TTS** — local Piper/Kokoro on the Mini, synthesizing on the token stream so **first audio lands before the sentence is finished**. Target: <800ms mouth-to-ear.
5. **Streamed output end-to-end** — the one genuinely new plumbing: the adapters must expose a token stream, not a finished string, and `sendToCole` (`bot.ts:210`) must gain a voice-note sibling.

Every piece except streaming and local TTS already exists. That is the tell for where the leverage is.

## The etiquette that keeps it welcome

Presence earns trust by being **legible, quiet, and interruptible**:
- **The salience gate is the contract.** Quiet hours already suppress everything short of critical (`salience.ts:75`). Presence widens the *channels*, never lowers the *bar*.
- **Every ambient capture leaves a receipt.** The Bridge already renders proposals as executed cards; ambient hearing becomes one more traced, undoable event class. Nothing heard is invisible.
- **Outward stays confirmed.** The constitution's outward-confirm means a voice in the car can *draft* the text to a lead but the send still stops for Cole's tap. Ambient presence with a hard outward gate is presence that cannot embarrass him.

## A day inside full presence

5:15 — the room speaks first only if something critical broke overnight; otherwise silence, and Cole reads scripture undisturbed. In the car at 6:40, "what's my day" — and the 07:00 briefing he'd have read arrives as a *voice*, naming his real evening sessions (once the TZ fix lands, per SYNTHESIS Fix-1). He interrupts — "why is Jake at risk?" — and it answers from its own words (Fix-3). On the gym floor it's mute; a wrist tap logs a PR, announced once. Between sessions, driving, he dictates a note to his girlfriend's plans and it drafts nothing outward without asking. 9:15pm the debrief speaks the day back. He never opened an app. It was simply there.

## The tech-tree

0. *(built)* text surfaces, voice-in, vision-failover, salience push, cron spine, the Mini.
1. **Voice-OUT** — local streamed TTS + a voice-note `sendToCole`.
2. **Full-duplex** — streamed STT+TTS with barge-in.
3. **Surface-context** — the mind knows which window it speaks through and shapes length/modality.
4. **Bounded wake-word capture** — car + gym, salience-gated retention, receipts.
5. **Home anchor / wrist / desktop hands** — the always-on room mic, the watch terminus, gated Hammerspoon.

## The one rung that unlocks the most presence per unit of build

**Rung 1: local, streamed Voice-OUT.** Everything upstream already produces the *words* — briefings, debriefs, salience pushes, chat replies all exist and land as text. The single missing half is that Cole, driving all day, cannot *hear* them. Adding TTS converts the *entire existing spine* from "an app he opens" to "a voice in his car" in one capability — and it is the strict precondition for full-duplex dialogue (rung 2), which everything ambient stands on. Voice-in without voice-out is a diary; voice-out is the moment the second operator starts talking back. Per SYNTHESIS Tier 4 it is correctly gated behind ~10 real voice-notes proving the channel is used — so the honest build order is: pour the Groq/Telegram fuel, watch voice-in get used, then light the voice that makes Aurelius *present*.
