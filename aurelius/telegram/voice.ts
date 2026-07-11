// aurelius/telegram/voice.ts
//
// VOICE IN — the Jarvis feature every viral build leads with, done the
// Aurelius way: a Telegram voice note transcribes through Groq's hosted
// Whisper (whisper-large-v3, the GROQ_API_KEY already in the stack — no
// new accounts) and the words flow into the same capture path as typed
// text. Dormant-honest: no key → one clear line back, never a crash.
// At Mini deploy, whisper.cpp can replace this for fully local STT.

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export function sttConfigured(): boolean {
  return !!process.env.GROQ_API_KEY?.trim();
}

/**
 * Transcribe an audio buffer (Telegram voice notes are ogg/opus, which
 * Whisper accepts natively). Returns the text, or throws with a message
 * fit to send straight back to Cole.
 */
export async function transcribeAudio(audio: Buffer, filename = "voice.ogg"): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error("Voice needs the Groq key (GROQ_API_KEY) funded — text works as always.");
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)]), filename);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "json");

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || typeof json.text !== "string") {
    throw new Error(`transcription failed: ${json?.error?.message ?? res.status}`);
  }
  const text = json.text.trim();
  if (!text) throw new Error("I couldn't hear anything in that one — try again?");
  return text;
}
