/**
 * geminiEngine.ts
 * Aurelius OS v3.4 — Gemini 2.0 Engine Wiring
 */

export async function runGemini({ message, systemPrompt }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("Gemini API key missing (GEMINI_API_KEY).");
    return "Gemini engine is not configured. Missing API key.";
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: systemPrompt },
          { text: message }
        ]
      }
    ]
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );

    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch (err) {
    console.error("Gemini engine error:", err);
    return "Gemini engine encountered an error while processing the request.";
  }
}
