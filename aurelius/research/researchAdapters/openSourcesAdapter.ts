// aurelius/research/researchAdapters/openSourcesAdapter.ts
//
// OPEN RESEARCH SOURCES (OG doc Part XVII) — the free tier that needs no
// keys, no accounts, no budget: ArXiv, PubMed (NCBI eutils), Semantic
// Scholar. Zero dependencies — raw fetch + light parsing. Each source
// fails independently and silently returns []; the sweep never breaks
// because one archive is down.

import type { ResearchResult } from "../researchTypes.ts";

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

function stripXml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

/** ArXiv Atom API — preprints across physics/CS/q-bio/stat. */
export async function arxivSearch(query: string, limit = 4): Promise<ResearchResult[]> {
  try {
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=relevance`;
    const xml = await (await fetchWithTimeout(url)).text();
    const entries = xml.split("<entry>").slice(1);
    return entries.map((e) => ({
      title: stripXml(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "untitled"),
      snippet: stripXml(e.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").slice(0, 400),
      url: e.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim(),
      source: "arxiv" as const,
      confidence: 0.75,
    }));
  } catch (err) {
    console.warn("[research] arxiv unavailable:", (err as any)?.message ?? err);
    return [];
  }
}

/** PubMed via NCBI eutils — esearch ids → esummary titles. No key needed. */
export async function pubmedSearch(query: string, limit = 4): Promise<ResearchResult[]> {
  try {
    const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
    const search = await (
      await fetchWithTimeout(`${base}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${limit}&sort=relevance`)
    ).json();
    const ids: string[] = search?.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];
    const summary = await (
      await fetchWithTimeout(`${base}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`)
    ).json();
    return ids
      .map((id) => summary?.result?.[id])
      .filter(Boolean)
      .map((r: any) => ({
        title: r.title ?? "untitled",
        snippet: [r.fulljournalname, r.pubdate, (r.authors ?? []).slice(0, 3).map((a: any) => a.name).join(", ")]
          .filter(Boolean)
          .join(" · "),
        url: `https://pubmed.ncbi.nlm.nih.gov/${r.uid}/`,
        source: "pubmed" as const,
        confidence: 0.85,
      }));
  } catch (err) {
    console.warn("[research] pubmed unavailable:", (err as any)?.message ?? err);
    return [];
  }
}

/** Semantic Scholar Graph API — free tier, no key (rate-limited; be polite). */
export async function semanticScholarSearch(query: string, limit = 4): Promise<ResearchResult[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,abstract,url,year,citationCount`;
    const json = await (await fetchWithTimeout(url)).json();
    return (json?.data ?? []).map((p: any) => ({
      title: p.title ?? "untitled",
      snippet: `${p.abstract?.slice(0, 350) ?? "(no abstract)"} (${p.year ?? "?"}, ${p.citationCount ?? 0} citations)`,
      url: p.url,
      source: "semanticscholar" as const,
      confidence: 0.8,
    }));
  } catch (err) {
    console.warn("[research] semantic scholar unavailable:", (err as any)?.message ?? err);
    return [];
  }
}

/** OpenAlex — the broadest open academic index. No key, generous limits. */
export async function openAlexSearch(query: string, limit = 4): Promise<ResearchResult[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&select=title,publication_year,cited_by_count,primary_location,abstract_inverted_index`;
    const json = await (await fetchWithTimeout(url)).json();
    return (json?.results ?? []).map((w: any) => {
      // OpenAlex ships abstracts as an inverted index — rebuild the text.
      let abstract = "";
      if (w.abstract_inverted_index) {
        const words: string[] = [];
        for (const [word, positions] of Object.entries(w.abstract_inverted_index as Record<string, number[]>)) {
          for (const pos of positions) words[pos] = word;
        }
        abstract = words.join(" ").slice(0, 350);
      }
      return {
        title: w.title ?? "untitled",
        snippet: `${abstract || "(no abstract)"} (${w.publication_year ?? "?"}, ${w.cited_by_count ?? 0} citations)`,
        url: w.primary_location?.landing_page_url ?? undefined,
        source: "openalex" as const,
        confidence: 0.8,
      };
    });
  } catch (err) {
    console.warn("[research] openalex unavailable:", (err as any)?.message ?? err);
    return [];
  }
}

/** All four in parallel — the free academic sweep. */
export async function openSourcesSearch(query: string, perSource = 3): Promise<ResearchResult[]> {
  const [arxiv, pubmed, s2, oa] = await Promise.all([
    arxivSearch(query, perSource),
    pubmedSearch(query, perSource),
    semanticScholarSearch(query, perSource),
    openAlexSearch(query, perSource),
  ]);
  return [...pubmed, ...s2, ...oa, ...arxiv];
}
