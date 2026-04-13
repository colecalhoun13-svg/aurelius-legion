/**
 * groqEngine.ts
 * Aurelius OS v3.4 — Groq Llama‑3.3 Engine Wiring
 */

export async function runGroq({ message, systemPrompt }) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error("Groq API key missing (GROQ_API_KEY).");
    return "Groq engine is not configured. Missing API key.";
  }

  const body = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]
  };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
    console.error("Groq engine error:", err);
    return "Groq engine encountered an error while processing the request.";
  }
}
