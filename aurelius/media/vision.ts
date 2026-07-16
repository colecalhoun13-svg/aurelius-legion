// aurelius/media/vision.ts
//
// MULTIMODAL INPUT — Aurelius sees, with FAILOVER. Cole hit this live: Gemini's
// vision quota 429'd and both schedule screenshots came through as nothing,
// while his OpenAI and Anthropic keys — both vision-capable — sat idle. Vision
// now works like the text router: IMAGES try Gemini → OpenAI → Anthropic (in
// key order), and only fail when every configured provider has refused, with a
// message naming who failed and why. VIDEO stays Gemini-only (the only engine
// that takes inline video) and says so honestly when Gemini is down.
//
// Dormant-honest without any key, like every other integration. Big video /
// frame-precise athlete-film analysis lands with the Mac Mini pipeline
// (local whisper + ffmpeg) — see docs/DEPLOY_MAC_MINI.md §9.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_INLINE_BYTES = 18 * 1024 * 1024; // Gemini inline payload ceiling (~18MB)

// Model IDs get deprecated/renamed — hardcoding one guarantees a 404 the day
// it's retired. Try candidates until one answers; cache the winner per process.
const GEMINI_VISION_CANDIDATES = [
  process.env.GEMINI_VISION_MODEL?.trim(),
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-pro",
].filter((m): m is string => !!m);

let cachedGeminiModel: string | null = null;

const geminiKey = () => process.env.GEMINI_API_KEY?.trim();
const openaiKey = () => process.env.OPENAI_API_KEY?.trim();
const anthropicKey = () => process.env.ANTHROPIC_API_KEY?.trim();

/** Any vision-capable provider configured (images). Video needs Gemini specifically. */
export function visionConfigured(): boolean {
  return !!(geminiKey() || openaiKey() || anthropicKey());
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

type InlineData = { mimeType: string; data: string };

async function callGemini(inlineData: InlineData, prompt: string): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("no GEMINI_API_KEY");

  const candidates = cachedGeminiModel ? [cachedGeminiModel] : GEMINI_VISION_CANDIDATES;
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
      cachedGeminiModel = null;
      continue;
    }
    // Quota/rate/server trouble is PROVIDER-wide — another Gemini model won't
    // fix a 429'd project. Throw so the orchestrator fails over providers.
    if (!res.ok) {
      throw new Error(`Gemini ${model} → ${res.status}: ${(await res.text()).slice(0, 160)}`);
    }

    const json: any = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p?.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    cachedGeminiModel = model; // remember the one that answered
    if (!text) throw new Error(`Gemini ${model} returned no analysis`);
    return text;
  }

  throw new Error(`Gemini: no available model (${lastErr})`);
}

async function callOpenAIVision(inlineData: InlineData, prompt: string): Promise<string> {
  const key = openaiKey();
  if (!key) throw new Error("no OPENAI_API_KEY");
  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5.4-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${inlineData.mimeType};base64,${inlineData.data}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${model} → ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json: any = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  const text = (typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((c: any) => c?.text).filter(Boolean).join("\n")
      : ""
  ).trim();
  if (!text) throw new Error(`OpenAI ${model} returned no analysis`);
  return text;
}

async function callAnthropicVision(inlineData: InlineData, prompt: string): Promise<string> {
  const key = anthropicKey();
  if (!key) throw new Error("no ANTHROPIC_API_KEY");
  const model = process.env.ANTHROPIC_VISION_MODEL?.trim() || "claude-sonnet-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: inlineData.mimeType, data: inlineData.data } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${model} → ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json: any = await res.json();
  const text = (json?.content ?? [])
    .map((b: any) => b?.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) throw new Error(`Anthropic ${model} returned no analysis`);
  return text;
}

/** Image analysis with provider failover: Gemini → OpenAI → Anthropic. Only
 * providers WITH keys are attempted; the final error names every refusal. */
async function analyzeImageWithFailover(inlineData: InlineData, prompt: string): Promise<string> {
  const providers: Array<{ name: string; configured: boolean; call: () => Promise<string> }> = [
    { name: "gemini", configured: !!geminiKey(), call: () => callGemini(inlineData, prompt) },
    { name: "openai", configured: !!openaiKey(), call: () => callOpenAIVision(inlineData, prompt) },
    { name: "anthropic", configured: !!anthropicKey(), call: () => callAnthropicVision(inlineData, prompt) },
  ];
  const attempted = providers.filter((p) => p.configured);
  if (attempted.length === 0) {
    throw new Error("No vision provider configured — set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY to send Aurelius photos.");
  }

  const failures: string[] = [];
  for (const p of attempted) {
    try {
      const text = await p.call();
      if (failures.length > 0) console.warn(`[vision] ${p.name} answered after: ${failures.join(" · ")}`);
      return text;
    } catch (err) {
      failures.push(`${p.name}: ${((err as any)?.message ?? String(err)).slice(0, 160)}`);
    }
  }
  throw new Error(`Vision failed on every configured provider — ${failures.join(" · ")}`);
}

export async function analyzeImage(buffer: Buffer, mimeType: string, caption?: string): Promise<string> {
  if (buffer.length > MAX_INLINE_BYTES) {
    throw new Error(`Image too large (${(buffer.length / 1e6).toFixed(1)}MB > 18MB).`);
  }
  return analyzeImageWithFailover({ mimeType, data: buffer.toString("base64") }, IMAGE_PROMPT(caption));
}

export async function analyzeVideo(buffer: Buffer, mimeType: string, caption?: string): Promise<string> {
  if (buffer.length > MAX_INLINE_BYTES) {
    throw new Error(
      `Video too large for inline analysis (${(buffer.length / 1e6).toFixed(1)}MB > 18MB). ` +
        `Long/athlete-film analysis lands with the Mac Mini pipeline (local whisper + frame extraction).`
    );
  }
  if (!geminiKey()) {
    throw new Error("Video analysis needs GEMINI_API_KEY (the only engine that takes inline video) — photos fail over to OpenAI/Anthropic, video can't.");
  }
  try {
    return await callGemini({ mimeType, data: buffer.toString("base64") }, VIDEO_PROMPT(caption));
  } catch (err) {
    throw new Error(`Video analysis failed (Gemini is the only inline-video engine): ${((err as any)?.message ?? String(err)).slice(0, 200)}`);
  }
}
