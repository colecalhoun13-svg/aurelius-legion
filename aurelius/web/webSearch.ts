// aurelius/web/webSearch.ts
//
// LIVE WEB — Aurelius could not touch the real-time web before this. Two things:
//   • search(query) → a grounded answer + real source links.
//   • fetch(url)    → a page's readable text (keyless).
//
// Search backend, in preference order:
//   1. Tavily (TAVILY_API_KEY) — purpose-built for agents, cleanest results.
//   2. Gemini Google Search grounding (GEMINI_API_KEY — the key you already
//      have; no new signup) — real Google results, cited.
// Honest-dormant with neither.
//
// NOTE on Instagram: this gives live web/news/trend search + page reading. Deep
// per-account Instagram analytics still needs the Meta Graph API (parked) —
// this won't scrape private IG data, and shouldn't.

export type WebSource = { title: string; url: string };
export type WebSearchResult = { provider: string; answer: string; sources: WebSource[] };

export function webSearchConfigured(): boolean {
  return !!(process.env.TAVILY_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim());
}

export async function webSearch(query: string): Promise<WebSearchResult> {
  if (process.env.TAVILY_API_KEY?.trim()) return tavilySearch(query);
  if (process.env.GEMINI_API_KEY?.trim()) return geminiSearch(query);
  throw new Error(
    "No web search configured — add GEMINI_API_KEY (you likely have it) or a free TAVILY_API_KEY (tavily.com)."
  );
}

async function tavilySearch(query: string): Promise<WebSearchResult> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 6,
      include_answer: true,
    }),
  });
  if (!res.ok) throw new Error(`Tavily search failed (${res.status}): ${(await res.text()).slice(0, 150)}`);
  const j: any = await res.json();
  return {
    provider: "tavily",
    answer: (j?.answer ?? "").trim(),
    sources: (j?.results ?? []).map((r: any) => ({ title: r?.title ?? r?.url, url: r?.url })).filter((s: WebSource) => s.url),
  };
}

async function geminiSearch(query: string): Promise<WebSearchResult> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_SEARCH_MODEL?.trim() || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini search failed (${res.status}): ${(await res.text()).slice(0, 150)}`);
  const j: any = await res.json();
  const cand = j?.candidates?.[0];
  const answer = (cand?.content?.parts ?? [])
    .filter((p: any) => typeof p?.text === "string")
    .map((p: any) => p.text)
    .join("")
    .trim();
  const sources: WebSource[] = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c: any) => c?.web)
    .filter(Boolean)
    .map((w: any) => ({ title: w?.title ?? w?.uri, url: w?.uri }))
    .filter((s: WebSource) => s.url);
  if (!answer) throw new Error("Gemini search returned no answer");
  return { provider: "gemini_grounding", answer, sources };
}

/** Strip HTML to readable text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function webFetch(url: string): Promise<{ title: string; text: string; url: string }> {
  const res = await fetch(url, { headers: { "User-Agent": "AureliusOS/1.0" } });
  if (!res.ok) throw new Error(`fetch failed (${res.status})`);
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? url;
  return { title, text: htmlToText(html).slice(0, 60000), url };
}
