// aurelius/voice/tts.ts
//
// VOICE-CLONED DELIVERY (NORTH_STAR #23) — turn Cole's OWN APPROVED words into
// audio in his voice. The constitution's line matters here: this voices words
// Cole has already approved (a content draft he okayed, a briefing, text he
// hands it) — it is NOT a channel for autonomous speech. It only ever speaks
// text it's GIVEN; it never composes an answer and voices it unsupervised.
//
// Free-tier by design and dormant-honest (Cole's call):
//   • ELEVENLABS_API_KEY (+ optional ELEVENLABS_VOICE_ID) — the cloning path;
//     free tier supports a cloned voice. This is "his voice."
//   • OPENAI_API_KEY — fallback to OpenAI TTS (a neutral voice, not cloned) so
//     the capability works before a clone exists.
//   • neither set → DORMANT: it reports config (with the exact fix), never
//     fabricates audio or silently no-ops.
//
// Producing the audio file is INWARD (Cole reviews/uses it). DELIVERING it
// anywhere outward stays his tap — this returns a file, it doesn't post it.

import fs from "node:fs";
import path from "node:path";

/** Where clips live on disk. Served by Express (see index.ts) behind THE LOCK —
 *  these are Cole's own words, private, unlike the public media host. */
export const VOICE_DIR = process.env.VOICE_DIR?.trim() || path.resolve(process.cwd(), "vault", "voice");
/** The authenticated route Express streams VOICE_DIR under. */
export const VOICE_ROUTE = "/api/voice";
const MAX_CHARS = 5000; // keep a single clip bounded (and free-tier friendly)

export type VoiceStatus = { configured: boolean; provider: string | null; cloned: boolean; reason: string | null };

export function voiceStatus(): VoiceStatus {
  if (process.env.ELEVENLABS_API_KEY?.trim()) {
    return { configured: true, provider: "elevenlabs", cloned: !!process.env.ELEVENLABS_VOICE_ID?.trim(), reason: null };
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    return { configured: true, provider: "openai", cloned: false, reason: "OpenAI TTS is a neutral voice — set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID for your cloned voice." };
  }
  return {
    configured: false,
    provider: null,
    cloned: false,
    reason: "Voice is dormant — set ELEVENLABS_API_KEY (free tier, your cloned voice via ELEVENLABS_VOICE_ID) or OPENAI_API_KEY (neutral fallback).",
  };
}

/**
 * Synthesize APPROVED text to an audio file on disk. Returns the path (Cole
 * uses/shares it) or an honest dormant/config error. Never fabricates audio.
 */
export async function synthesizeSpeech(text: string, opts: { filename?: string } = {}): Promise<{
  ok: boolean;
  path?: string;
  /** The route the clip is reachable at (e.g. /api/voice/foo.mp3) — resolves
   *  through the app so Cole can actually play it, not a dead disk path. */
  url?: string;
  provider?: string;
  cloned?: boolean;
  bytes?: number;
  error?: string;
}> {
  const words = (text ?? "").trim();
  if (!words) return { ok: false, error: "Nothing to voice — give me the approved words to speak." };
  if (words.length > MAX_CHARS) return { ok: false, error: `Too long for one clip (${words.length} > ${MAX_CHARS} chars). Split it.` };

  const status = voiceStatus();
  if (!status.configured) return { ok: false, error: status.reason ?? "Voice is not configured." };

  let audio: ArrayBuffer;
  try {
    audio = status.provider === "elevenlabs" ? await elevenLabs(words) : await openaiTts(words);
  } catch (err: any) {
    return { ok: false, error: `Voice synthesis failed (${status.provider}): ${(err?.message ?? String(err)).slice(0, 160)}` };
  }

  try {
    fs.mkdirSync(VOICE_DIR, { recursive: true });
    // Sanitise to a safe basename: this name becomes part of a served URL, so a
    // slash or dot-segment would be a traversal hole.
    const base = (opts.filename || `voice-${words.slice(0, 24).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`)
      .replace(/[^a-z0-9._-]+/gi, "-")
      .slice(0, 60) || "voice";
    const name = `${base}.mp3`;
    const file = path.join(VOICE_DIR, name);
    const buf = Buffer.from(audio);
    fs.writeFileSync(file, buf);
    // Absolute when the app's public origin is known (so a Telegram link is
    // tappable and opens the clip behind the app unlock), relative otherwise
    // (the browser resolves it against the app origin via the /api/voice proxy).
    const appBase = process.env.APP_PUBLIC_BASE_URL?.trim();
    const url = appBase ? `${appBase.replace(/\/+$/, "")}${VOICE_ROUTE}/${name}` : `${VOICE_ROUTE}/${name}`;
    return { ok: true, path: file, url, provider: status.provider!, cloned: status.cloned, bytes: buf.length };
  } catch (err: any) {
    return { ok: false, error: `Voiced, but couldn't write the file: ${(err?.message ?? String(err)).slice(0, 160)}` };
  }
}

async function elevenLabs(text: string): Promise<ArrayBuffer> {
  const key = process.env.ELEVENLABS_API_KEY!.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM"; // a default until Cole's clone id is set
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.arrayBuffer();
}

async function openaiTts(text: string): Promise<ArrayBuffer> {
  const key = process.env.OPENAI_API_KEY!.trim();
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice: "onyx", input: text, response_format: "mp3" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.arrayBuffer();
}
