// aurelius/tools/adapters/web.ts
//
// The web tool — Aurelius's window on the live internet. search() grounds an
// answer in current Google/Tavily results with source links; fetch() reads a
// page. The LLM calls these when it needs real-time facts instead of guessing.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { webSearch, webFetch, webSearchConfigured } from "../../web/webSearch.ts";

// SSRF guard. web.fetch takes a model-supplied URL, and the model can be steered
// by injected corpus/web/email content, so a fetch must never reach the deploy
// host's own network — cloud metadata (169.254.169.254), loopback, or private
// LANs. Block literal private/link-local/loopback IPs + internal hostnames. (Full
// DNS-rebinding defense needs resolve-then-check; this stops the direct cases.)
function ssrfBlockReason(rawUrl: string): string | null {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return "unparseable url";
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return "internal hostname";
  }
  if (host === "::1" || host === "0.0.0.0") return "loopback";
  // IPv4 literal ranges: loopback 127/8, private 10/8, 172.16–31/12, 192.168/16,
  // link-local/metadata 169.254/16.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 169 && b === 254 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31) {
      return "private/link-local address";
    }
  }
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return "private IPv6";
  return null;
}

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
      const blocked = ssrfBlockReason(url);
      if (blocked) return { ok: false, output: null, error: `refusing to fetch a ${blocked} — web.fetch is for the public internet only` };
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
