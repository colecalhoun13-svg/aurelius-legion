// aurelius/research/researchAdapters/bookSourcesAdapter.ts
//
// BOOK SOURCES — the connector the curriculum's WORK units were missing.
// Paper archives (arXiv/PubMed/S2/OpenAlex) can never hold "Why We Sleep"
// or Zatsiorsky — they index papers, not books — so book-canon study was
// structurally source-less. Three free, keyless connectors that CAN:
//
//   • Wikipedia — substantial encyclopedia articles on famous works and
//     authors (real secondary text about the primary source).
//   • Open Library — bibliographic ground truth (authors, year, subjects).
//   • Project Gutenberg — FULL primary text for the public-domain canon
//     (Sun Tzu, Marcus Aurelius, Musashi, Clausewitz, Machiavelli…).
//
// Same contract as openSourcesAdapter: each source fails independently and
// returns []; results are relevance-gated against the subject so a near-miss
// search can't smuggle junk into a synthesis.

import type { ResearchResult } from "../researchTypes.ts";
import { filterRelevant } from "./relevance.ts";

const TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctl.signal,
      headers: { "User-Agent": "AureliusOS/1.0 (personal research agent)" },
    });
  } finally {
    clearTimeout(t);
  }
}

/** "The Art of War — Sun Tzu" → "The Art of War Sun Tzu" (search-friendly). */
function searchable(subject: string): string {
  return subject.replace(/[—–/]/g, " ").replace(/\s+/g, " ").trim();
}

/** Wikipedia: search → per-page summary extracts (the real meat). */
export async function wikipediaSearch(subject: string, limit = 2): Promise<ResearchResult[]> {
  try {
    const q = searchable(subject);
    const search = await (
      await fetchWithTimeout(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=3`)
    ).json();
    const pages: any[] = (search?.pages ?? []).slice(0, limit + 1);
    const out: ResearchResult[] = [];
    for (const p of pages) {
      if (out.length >= limit) break;
      try {
        const sum = await (
          await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.key)}`)
        ).json();
        const extract = (sum?.extract ?? "").trim();
        if (!extract) continue;
        out.push({
          title: sum.title ?? p.title ?? "untitled",
          snippet: extract.slice(0, 700),
          url: sum?.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${p.key}`,
          source: "wikipedia",
          confidence: 0.85,
        });
      } catch {
        // one bad page never sinks the sweep
      }
    }
    return out;
  } catch (err) {
    console.warn("[research] wikipedia unavailable:", (err as any)?.message ?? err);
    return [];
  }
}

/** Open Library: bibliographic metadata — who, when, what it's about. */
export async function openLibrarySearch(subject: string, limit = 2): Promise<ResearchResult[]> {
  try {
    const q = searchable(subject);
    const json = await (
      await fetchWithTimeout(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=title,author_name,first_publish_year,subject,key`
      )
    ).json();
    return (json?.docs ?? []).slice(0, limit).map((d: any) => ({
      title: d.title ?? "untitled",
      snippet: [
        (d.author_name ?? []).slice(0, 3).join(", "),
        d.first_publish_year ? `first published ${d.first_publish_year}` : "",
        (d.subject ?? []).slice(0, 8).join(" · "),
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 400),
      url: d.key ? `https://openlibrary.org${d.key}` : undefined,
      source: "openlibrary" as const,
      confidence: 0.6,
    }));
  } catch (err) {
    console.warn("[research] open library unavailable:", (err as any)?.message ?? err);
    return [];
  }
}

/**
 * Project Gutenberg via gutendex: for public-domain works, fetch the FULL
 * primary text and carry a real excerpt — not pattern-matching, the book.
 * Only the top relevant hit gets its text pulled (they're megabyte-scale).
 */
export async function gutenbergSearch(subject: string): Promise<ResearchResult[]> {
  try {
    const q = searchable(subject);
    const json = await (await fetchWithTimeout(`https://gutendex.com/books?search=${encodeURIComponent(q)}`)).json();
    const hit = (json?.results ?? [])[0];
    if (!hit) return [];
    const meta: ResearchResult = {
      title: `${hit.title}${hit.authors?.[0]?.name ? ` — ${hit.authors[0].name}` : ""}`,
      snippet: "(public-domain primary text on Project Gutenberg)",
      url: `https://www.gutenberg.org/ebooks/${hit.id}`,
      source: "gutenberg",
      confidence: 0.95,
    };
    // Pull the plain text and excerpt the opening — past the license header.
    const txtUrl = Object.entries(hit.formats ?? {}).find(([k]) => String(k).startsWith("text/plain"))?.[1] as
      | string
      | undefined;
    if (txtUrl) {
      try {
        const raw = await (await fetchWithTimeout(txtUrl)).text();
        const bodyStart = raw.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
        const body = (bodyStart >= 0 ? raw.slice(raw.indexOf("***", bodyStart + 3) + 3) : raw)
          .replace(/\r/g, "")
          .trim();
        if (body.length > 200) meta.snippet = `PRIMARY TEXT (opening): ${body.slice(0, 1800)}`;
      } catch {
        // metadata alone is still a real, relevant source
      }
    }
    return [meta];
  } catch (err) {
    console.warn("[research] gutenberg unavailable:", (err as any)?.message ?? err);
    return [];
  }
}

/** The book sweep — all three in parallel, relevance-gated against the subject. */
export async function bookSourcesSearch(subject: string): Promise<ResearchResult[]> {
  const [wiki, ol, pg] = await Promise.all([
    wikipediaSearch(subject),
    openLibrarySearch(subject),
    gutenbergSearch(subject),
  ]);
  // Works want a strict gate: we're after THE book, not its general topic.
  return filterRelevant(subject, [...pg, ...wiki, ...ol], 0.5);
}
