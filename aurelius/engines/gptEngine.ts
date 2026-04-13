import OpenAI from "openai";

export const gptEngine = async (systemPrompt: string, userMessage: string) => {
  // Lazy init — dotenv has already loaded by now
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  return completion.choices[0].message.content;
};
