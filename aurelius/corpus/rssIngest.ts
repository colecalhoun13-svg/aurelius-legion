// aurelius/corpus/rssIngest.ts
//
// RSS STANDING FEEDS → SECOND BRAIN. Keyless. Feeds live in Living
// Knowledge (research.rss_feeds on the global operator: array of
// {url, domain} or plain url strings) — steerable by conversation, like
// every sweep. Daily poll: new items since last seen become ONE digest
// document per feed per day (no item spam), flowing through the
// four-write pipeline. No feeds configured = silently dormant.

import { prisma } from "../core/db/prisma.ts";
import { ingestDocument } from "./ingest.ts";

type Feed = { url: string; domain: string };

async function getFeeds(): Promise<Feed[]> {
  try {
    const { getKnowledge, resolveOperatorId } = await import("../knowledge/store.ts");
    const opId = await resolveOperatorId("global");
    if (!opId) return [];
    const entry = await getKnowledge(opId, "research", "rss_feeds");
    if (!Array.isArray(entry?.value)) return [];
    return entry.value
      .map((f: any) =>
        typeof f === "string"
          ? { url: f, domain: "reading" }
          : f?.url
            ? { url: String(f.url), domain: String(f.domain ?? "reading") }
            : null
      )
      .filter(Boolean) as Feed[];
  } catch {
    return [];
  }
}

function items(xml: string): Array<{ title: string; link: string; desc: string }> {
  const out: Array<{ title: string; link: string; desc: string }> = [];
  const strip = (s: string) =>
    s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  for (const raw of xml.split(/<item[\s>]/).slice(1)) {
    out.push({
      title: strip(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "untitled"),
      link: strip(raw.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? ""),
      desc: strip(raw.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? "").slice(0, 400),
    });
    if (out.length >= 10) break;
  }
  return out;
}

export async function pollRssOnce() {
  const feeds = await getFeeds();
  if (feeds.length === 0) return { dormant: true as const };

  const dstr = new Date().toISOString().slice(0, 10);
  let ingested = 0;
  for (const feed of feeds) {
    try {
      const xml = await (await fetch(feed.url, { headers: { "User-Agent": "AureliusOS/1.0" } })).text();
      const list = items(xml);
      if (list.length === 0) continue;
      const title = `Feed digest ${dstr}: ${new URL(feed.url).hostname}`;
      const dup = await prisma.corpusDocument.findFirst({ where: { title } });
      if (dup) continue; // one digest per feed per day
      await ingestDocument({
        title,
        content: list.map((i) => `## ${i.title}\n${i.desc}\n${i.link}`).join("\n\n"),
        sourceType: "url",
        sourceUrl: feed.url,
        domain: feed.domain,
        triggeredBy: "schedule",
      });
      ingested++;
    } catch (err) {
      console.warn(`[rss] ${feed.url} failed (non-fatal):`, (err as any)?.message ?? err);
    }
  }
  if (ingested > 0) console.log(`[rss] ${ingested} feed digests ingested`);
  return { dormant: false as const, ingested };
}
