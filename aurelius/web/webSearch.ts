// aurelius/web/webSearch.ts
//
// LIVE WEB — Aurelius's window on the real-time internet.
//   • search(query) → a grounded answer + real source links, across a FAILOVER
//     ARRAY of providers: the first configured one that answers wins; if it
//     errors (quota, rate-limit, outage) the next is tried, so research never
//     goes dark because one provider had a bad day.
//   • fetch(url) → a page's readable text. Uses a rendering scraper (Firecrawl)
//     when configured — which reads JS-heavy / anti-bot pages a raw fetch
//     can't — and falls back to a plain keyless fetch otherwise.
//
// PROVIDER COVERAGE (add any subset — each is dormant-honest until its key is
// set, and they're tried in this priority order):
//   1. Tavily        (TAVILY_API_KEY)   — purpose-built for agents, cleanest
//                                          synthesized answer. Free ~1k/mo.
//   2. Brave Search  (BRAVE_API_KEY)    — its OWN index, not Google — genuine
//                                          coverage diversity. Free ~2k/mo.
//   3. Gemini        (GEMINI_API_KEY)   — Google Search grounding on the key
//                                          you already have; real Google, cited.
//   4. SerpAPI       (SERPAPI_KEY)      — Google SERP scrape; paid, last resort.
//
// Note: "an array of search providers" buys RESILIENCE + one alternate index
// (Brave), not 4× the coverage — Tavily/Gemini/SerpAPI mostly read the same
// Google index. The real coverage wins are Brave (different index) + Firecrawl
// (reads pages the others can't) + the keyless academic tier in researchEngine.

const WEB_TIMEOUT_MS = Math.max(5_000, Number(process.env.WEB_TIMEOUT_MS) || 30_000);
const SCRAPE_TIMEOUT_MS = Math.max(WEB_TIMEOUT_MS, 45_000); // rendering is slower

export type WebSource = { title: string; url: string };
export type WebSearchResult = { provider: string; answer: string; sources: WebSource[] };

const env = (k: string) => process.env[k]?.trim();

/** Every configured search provider, in priority order. */
function searchProviders(): Array<{ name: string; run: (q: string) => Promise<WebSearchResult> }> {
  const p: Array<{ name: string; run: (q: string) => Promise<WebSearchResult> }> = [];
  if (env("TAVILY_API_KEY")) p.push({ name: "tavily", run: tavilySearch });
  if (env("BRAVE_API_KEY")) p.push({ name: "brave", run: braveSearch });
  if (env("GEMINI_API_KEY")) p.push({ name: "gemini_grounding", run: geminiSearch });
  if (env("SERPAPI_KEY") || env("SERP_API_KEY")) p.push({ name: "serpapi", run: serpApiSearch });
  return p;
}

export function webSearchConfigured(): boolean {
  return searchProviders().length > 0;
}

/** The failover loop: first provider to return a usable result (answer OR
 *  sources) wins; a provider that throws or comes back empty steps aside for
 *  the next. If none are configured, or all fail, the error names why. */
export async function webSearch(query: string): Promise<WebSearchResult> {
  const providers = searchProviders();
  if (providers.length === 0) {
    throw new Error(
      "No web search configured — add GEMINI_API_KEY (you likely have it), a free TAVILY_API_KEY (tavily.com), or a free BRAVE_API_KEY (brave.com/search/api)."
    );
  }
  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const r = await provider.run(query);
      if ((r.answer && r.answer.trim()) || r.sources.length > 0) {
        if (failures.length) console.warn(`[web] ${provider.name} answered after: ${failures.join(" · ")}`);
        return r;
      }
      failures.push(`${provider.name}: empty`);
    } catch (err: any) {
      failures.push(`${provider.name}: ${(err?.message ?? String(err)).slice(0, 120)}`);
    }
  }
  throw new Error(`Web search failed on every configured provider — ${failures.join(" · ")}`);
}

async function tavilySearch(query: string): Promise<WebSearchResult> {
  const depth = env("TAVILY_SEARCH_DEPTH") || "advanced";
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env("TAVILY_API_KEY"),
      query,
      search_depth: depth,
      max_results: 8,
      include_answer: "advanced",
    }),
    signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Tavily search failed (${res.status}): ${(await res.text()).slice(0, 150)}`);
  const j: any = await res.json();
  return {
    provider: "tavily",
    answer: (j?.answer ?? "").trim(),
    sources: (j?.results ?? []).map((r: any) => ({ title: r?.title ?? r?.url, url: r?.url })).filter((s: WebSource) => s.url),
  };
}

async function braveSearch(query: string): Promise<WebSearchResult> {
  // Brave has its OWN web index — the one provider here that isn't reading
  // Google. No synthesized answer field; the ranked results ARE the value.
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`, {
    headers: { Accept: "application/json", "X-Subscription-Token": env("BRAVE_API_KEY")! },
    signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Brave search failed (${res.status}): ${(await res.text()).slice(0, 150)}`);
  const j: any = await res.json();
  const results: any[] = j?.web?.results ?? [];
  return {
    provider: "brave",
    // Synthesize a light answer from the top descriptions so downstream code
    // that reads `answer` still gets substance.
    answer: results.slice(0, 3).map((r) => r?.description).filter(Boolean).join(" ").replace(/<[^>]+>/g, "").slice(0, 2000),
    sources: results.map((r) => ({ title: r?.title ?? r?.url, url: r?.url })).filter((s: WebSource) => s.url),
  };
}

async function serpApiSearch(query: string): Promise<WebSearchResult> {
  const key = env("SERPAPI_KEY") || env("SERP_API_KEY");
  const res = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${key}&num=8`, {
    signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`SerpAPI search failed (${res.status}): ${(await res.text()).slice(0, 150)}`);
  const j: any = await res.json();
  const organic: any[] = j?.organic_results ?? [];
  const answer = (j?.answer_box?.answer || j?.answer_box?.snippet || organic.slice(0, 2).map((r) => r?.snippet).filter(Boolean).join(" ") || "").slice(0, 2000);
  return {
    provider: "serpapi",
    answer,
    sources: organic.map((r) => ({ title: r?.title ?? r?.link, url: r?.link })).filter((s: WebSource) => s.url),
  };
}

// Grounding-capable models get deprecated too — try candidates until one works.
const SEARCH_MODEL_CANDIDATES = [
  env("GEMINI_SEARCH_MODEL"),
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
].filter((m): m is string => !!m);
let cachedSearchModel: string | null = null;

async function geminiSearch(query: string): Promise<WebSearchResult> {
  const key = env("GEMINI_API_KEY");
  const candidates = cachedSearchModel ? [cachedSearchModel] : SEARCH_MODEL_CANDIDATES;
  let res: Response | null = null;
  let lastErr = "no models tried";
  for (const model of candidates) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: query }] }],
          tools: [{ google_search: {} }],
        }),
        signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
      }
    );
    if (res.status === 404) { lastErr = `model ${model} unavailable (404)`; cachedSearchModel = null; res = null; continue; }
    cachedSearchModel = model;
    break;
  }
  if (!res) throw new Error(`Gemini search: no available model (${lastErr})`);
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

/**
 * Read a page. With FIRECRAWL_API_KEY set, uses Firecrawl — which renders JS
 * and returns clean markdown, reading pages that block or need a browser (the
 * scraping coverage a raw fetch can't reach). Falls back to a plain keyless
 * fetch otherwise. The caller sees the same shape either way.
 */
export async function webFetch(url: string): Promise<{ title: string; text: string; url: string }> {
  if (env("FIRECRAWL_API_KEY")) {
    try {
      return await firecrawlFetch(url);
    } catch (err: any) {
      // A rendering scrape can fail (credits, unsupported page) — fall back to
      // the raw fetch rather than returning nothing.
      console.warn(`[web] firecrawl fetch failed, falling back to raw (${(err?.message ?? err)?.toString().slice(0, 100)})`);
    }
  }
  return rawFetch(url);
}

async function rawFetch(url: string): Promise<{ title: string; text: string; url: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "AureliusOS/1.0" },
    signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`fetch failed (${res.status})`);
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? url;
  return { title, text: htmlToText(html).slice(0, 60000), url };
}

async function firecrawlFetch(url: string): Promise<{ title: string; text: string; url: string }> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("FIRECRAWL_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`firecrawl (${res.status}): ${(await res.text()).slice(0, 150)}`);
  const j: any = await res.json();
  const md: string = j?.data?.markdown ?? "";
  if (!md.trim()) throw new Error("firecrawl returned no content");
  return { title: j?.data?.metadata?.title ?? url, text: md.slice(0, 60000), url };
}
