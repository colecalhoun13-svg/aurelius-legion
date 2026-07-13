// aurelius/tools/adapters/web.ts
//
// The web tool — Aurelius's window on the live internet. search() grounds an
// answer in current Google/Tavily results with source links; fetch() reads a
// page. The LLM calls these when it needs real-time facts instead of guessing.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { webSearch, webFetch, webSearchConfigured } from "../../web/webSearch.ts";

export const webAdapter: ToolAdapter = {
  name: "web",
  description:
    "Live web access: real-time search (grounded answer + source links) and fetching a page's readable text. Use for current facts, trends, news — never fabricate them.",
  actions: [
    {
      name: "search",
      description: "Search the live web for current information; returns a grounded answer plus source links.",
      dataSchema: '{ "query": string }',
      example: '[TOOL: tool=web action=search data={"query": "2026 youth speed training trends"}]',
    },
    {
      name: "fetch",
      description: "Fetch a URL and return its readable text.",
      dataSchema: '{ "url": string }',
      example: '[TOOL: tool=web action=fetch data={"url": "https://example.com/article"}]',
    },
  ],
  async run(action, data): Promise<ToolAdapterResult> {
    if (action === "search") {
      const query = (data?.query ?? "").toString().trim();
      if (!query) return { ok: false, output: null, error: "web.search needs a query" };
      if (!webSearchConfigured()) {
        return {
          ok: false,
          output: null,
          error: "Web search not configured — add GEMINI_API_KEY (you have it) or a free TAVILY_API_KEY.",
        };
      }
      try {
        const r = await webSearch(query);
        return { ok: true, output: { answer: r.answer, sources: r.sources, provider: r.provider } };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "web search failed" };
      }
    }
    if (action === "fetch") {
      const url = (data?.url ?? "").toString().trim();
      if (!/^https?:\/\//i.test(url)) return { ok: false, output: null, error: "web.fetch needs a valid http(s) url" };
      try {
        const r = await webFetch(url);
        return { ok: true, output: { title: r.title, url: r.url, text: r.text.slice(0, 8000) } };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "web fetch failed" };
      }
    }
    return { ok: false, output: null, error: `unknown web action: ${action}` };
  },
};
