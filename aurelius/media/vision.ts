// aurelius/media/vision.ts
//
// MULTIMODAL INPUT — Aurelius sees. Gemini reads a photo (describe + OCR any
// text) or watches a short video (describe + transcribe speech). Dormant-honest
// without GEMINI_API_KEY, like every other integration.
//
// Model is configurable (GEMINI_VISION_MODEL); defaults to a fast multimodal
// tier. Big video / frame-precise athlete-film analysis lands with the Mac Mini
// pipeline (local whisper + ffmpeg) — see docs/DEPLOY_MAC_MINI.md §9.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_INLINE_BYTES = 18 * 1024 * 1024; // Gemini inline payload ceiling (~18MB)

// Model IDs get deprecated/renamed by Google — hardcoding one guarantees a 404
// the day it's retired. Try a list of vision-capable models until one answers,
// then cache the winner for the process. GEMINI_VISION_MODEL, if set, goes first.
const VISION_MODEL_CANDIDATES = [
  process.env.GEMINI_VISION_MODEL?.trim(),
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-pro",
].filter((m): m is string => !!m);

let cachedVisionModel: string | null = null;

export function visionConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim();
}

const IMAGE_PROMPT = (caption?: string) =>
  `You are Aurelius's eyes. Describe this image so it becomes a useful, searchable note in Cole's second brain.\n` +
  `- Transcribe ALL visible text verbatim (whiteboards, documents, screenshots, handwriting).\n` +
  `- Summarize what the image shows in 1-2 lines.\n` +
  `- Note anything actionable (a task, date, name, number).\n` +
  (caption ? `Cole's caption: "${caption}". Weigh it.\n` : "") +
  `Be concise. Plain text, no preamble.`;

const VIDEO_PROMPT = (caption?: string) =>
  `You are Aurelius's eyes and ears. Turn this video into a useful, searchable note.\n` +
  `- Transcribe any speech.\n` +
  `- Describe what happens, in order, briefly.\n` +
  `- If it shows athletic movement (a lift, sprint, jump, drill), report OBSERVATIONS ONLY — what you see in the mechanics — as SIGNALS for Cole. NEVER prescribe or program; Cole makes the coaching calls.\n` +
  (caption ? `Cole's caption: "${caption}". Weigh it.\n` : "") +
  `Be concise. Plain text, no preamble.`;

async function callGemini(inlineData: { mimeType: string; data: string }, prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("Missing GEMINI_API_KEY — media analysis needs a Gemini key");

  const candidates = cachedVisionModel ? [cachedVisionModel] : VISION_MODEL_CANDIDATES;
  let lastErr = "no models tried";

  for (const model of candidates) {
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData }] }] }),
    });

    // A 404 means this model is gone/renamed — try the next candidate.
    if (res.status === 404) {
      lastErr = `model ${model} unavailable (404)`;
      cachedVisionModel = null;
      continue;
    }
    // Any other non-OK (quota, bad request, safety) is a real error — surface it.
    if (!res.ok) {
      throw new Error(`Gemini vision failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }

    const json: any = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p?.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    cachedVisionModel = model; // remember the one that answered
    if (!text) throw new Error(`Gemini (${model}) returned no analysis`);
    return text;
  }

  throw new Error(`Gemini vision: no available model (tried ${candidates.join(", ")}). Last: ${lastErr}`);
}

export async function analyzeImage(buffer: Buffer, mimeType: string, caption?: string): Promise<string> {
  if (buffer.length > MAX_INLINE_BYTES) {
    throw new Error(`Image too large (${(buffer.length / 1e6).toFixed(1)}MB > 18MB).`);
  }
  return callGemini({ mimeType, data: buffer.toString("base64") }, IMAGE_PROMPT(caption));
}

export async function analyzeVideo(buffer: Buffer, mimeType: string, caption?: string): Promise<string> {
  if (buffer.length > MAX_INLINE_BYTES) {
    throw new Error(
      `Video too large for inline analysis (${(buffer.length / 1e6).toFixed(1)}MB > 18MB). ` +
        `Long/athlete-film analysis lands with the Mac Mini pipeline (local whisper + frame extraction).`
    );
  }
  return callGemini({ mimeType, data: buffer.toString("base64") }, VIDEO_PROMPT(caption));
}
