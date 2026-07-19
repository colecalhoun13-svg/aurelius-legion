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
    {
      name: "youtube_transcript",
      description:
        "Fetch a YouTube video's transcript and (by default) ingest it into the corpus so the brain learns it. Best-effort — YouTube blocks some server IPs; reliable at the Mini.",
      dataSchema: '{ "url": string, "ingest"?: boolean (default true), "domain"?: string }',
      example: '[TOOL: tool=web action=youtube_transcript data={"url": "https://youtu.be/dQw4w9WgXcQ"}]',
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
        // Defuse directive syntax in fetched pages — external content must never
        // carry an executable [TOOL:]/[SAVE:] back into the conversation.
        const { defuseDirectives } = await import("../../llm/directiveParser.ts");
        return { ok: true, output: { title: r.title, url: r.url, text: defuseDirectives(r.text.slice(0, 8000)) } };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "web fetch failed" };
      }
    }
    if (action === "youtube_transcript") {
      const ref = (data?.url ?? "").toString().trim();
      if (!ref) return { ok: false, output: null, error: "youtube_transcript needs a url (or video id)" };
      try {
        const { resolveContentSource } = await import("../../research/sources.ts");
        const source = resolveContentSource(ref);
        if (!source) return { ok: false, output: null, error: `no content source can handle: ${ref}` };
        const fetched = await source.fetch(ref); // already defused by the source
        let docId: string | null = null;
        if (data?.ingest !== false) {
          const { ingestDocument } = await import("../../corpus/ingest.ts");
          const r = await ingestDocument({
            title: fetched.title,
            content: fetched.content,
            sourceType: "url",
            sourceUrl: fetched.url,
            domain: (data?.domain ?? "research").toString(),
            triggeredBy: "cole",
            dedupKey: `youtube:${fetched.url}`,
          });
          docId = r.doc.id;
        }
        return {
          ok: true,
          output: {
            title: fetched.title,
            url: fetched.url,
            ingested: docId !== null,
            docId,
            transcript: fetched.content.slice(0, 8000),
            summary: `Transcript of "${fetched.title}" (${fetched.content.length} chars)${docId ? ", ingested into the corpus" : ""}`,
          },
        };
      } catch (e: any) {
        return { ok: false, output: null, error: e?.message ?? "transcript fetch failed" };
      }
    }
    return { ok: false, output: null, error: `unknown web action: ${action}` };
  },
};
