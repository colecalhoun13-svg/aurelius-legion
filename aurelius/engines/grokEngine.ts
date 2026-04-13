/**
 * grokEngine.ts
 * Aurelius OS v3.4 — Grok‑3 Engine Wiring
 */

export async function runGrok({ message, systemPrompt }) {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    console.error("xAI API key missing (XAI_API_KEY).");
    return "Grok engine is not configured. Missing API key.";
  }

  const body = {
    model: "grok-3",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]
  };

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error("Grok engine error:", err);
    return "Grok engine encountered an error while processing the request.";
  }
}
