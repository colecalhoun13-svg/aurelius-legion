// aurelius/corpus/ingest.ts
//
// SECOND BRAIN — auto-aware ingestion.
//
// Ingesting a document is FOUR writes, not one. That's the difference
// between a search index and a mind:
//   1. embed      — chunked into the vector index (searchable)
//   2. remember   — a summary memory ("Ingested: …") enters normal recall
//   3. register   — CorpusDocument row; the inventory injects into every
//                   prompt so Aurelius KNOWS what it knows, unprompted
//   4. surface    — a BridgeSignal so Cole sees the brain grew
//
// Plus an IngestionRun row for the scoreboard.

import { prisma } from "../core/db/prisma.ts";
import { embedSource } from "../retrieval/embedPipeline.ts";
import { saveMemory } from "../memory/memoryService.ts";

export type IngestInput = {
  title: string;
  content: string;
  sourceType?: "upload" | "url" | "note" | "research";
  sourceUrl?: string;
  domain?: string;
  operatorName?: string; // resolved to id if provided
  triggeredBy?: string;  // "cole" | "schedule" | "self_directed"
};

// Deterministic v1 synopsis: first ~2 sentences, capped. The LLM-written
// summary (and wiki page update) arrives with the ritual/wiki block.
function synopsize(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  return (sentences || clean).slice(0, 300);
}

export async function ingestDocument(input: IngestInput) {
  const run = await prisma.ingestionRun.create({
    data: {
      runType: "corpus_upload",
      operatorName: input.operatorName ?? null,
      triggeredBy: input.triggeredBy ?? "cole",
      sourcesQueried: [input.sourceUrl ?? input.title],
    },
  });

  try {
    let operatorId: string | null = null;
    if (input.operatorName) {
      const op = await prisma.operator.findUnique({ where: { name: input.operatorName } });
      operatorId = op?.id ?? null;
    }

    const summary = synopsize(input.content);

    // 3. register
    const doc = await prisma.corpusDocument.create({
      data: {
        title: input.title,
        sourceType: input.sourceType ?? "note",
        sourceUrl: input.sourceUrl ?? null,
        domain: input.domain ?? "personal",
        operatorId,
        summary,
        contentText: input.content,
      },
    });

    // 1. embed (await — ingestion should report real success)
    const chunkCount = await embedSource({
      sourceType: "corpus_doc",
      sourceId: doc.id,
      text: `${input.title}\n\n${input.content}`,
      operatorId,
      domain: doc.domain,
    });
    await prisma.corpusDocument.update({ where: { id: doc.id }, data: { chunkCount } });

    // 2. remember
    await saveMemory({
      operator: input.operatorName ?? "strategy",
      category: "facts",
      value: `Ingested "${input.title}" — ${summary}`,
      metadata: { kind: "corpus_ingestion", corpusDocId: doc.id, domain: doc.domain },
    });

    // 4. surface
    await prisma.bridgeSignal.create({
      data: {
        kind: "background_result",
        domain: doc.domain,
        sourceType: "research_ingestion",
        sourceId: doc.id,
        severity: "info",
        title: `Ingested: ${input.title}`,
        body: `${summary}\n\n${chunkCount} chunks indexed · now part of recall.`,
      },
    });

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "completed", finishedAt: new Date(), findingsCount: chunkCount },
    });

    return { doc, chunkCount };
  } catch (err: any) {
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), errors: [String(err?.message ?? err)] },
    });
    throw err;
  }
}

/** Naive URL → text. Real extraction (readability) comes later. */
export async function ingestUrl(url: string, opts: Partial<IngestInput> = {}) {
  const res = await fetch(url, { headers: { "User-Agent": "AureliusOS/1.0" } });
  if (!res.ok) throw new Error(`fetch failed (${res.status})`);
  const html = await res.text();
  const title =
    opts.title ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
    url;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60000);
  if (text.length < 200) throw new Error("page yielded too little text to ingest");
  return ingestDocument({ ...opts, title, content: text, sourceType: "url", sourceUrl: url });
}

export async function listCorpus(limit = 50) {
  return prisma.corpusDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, title: true, sourceType: true, sourceUrl: true,
      domain: true, summary: true, chunkCount: true, createdAt: true,
    },
  });
}

/**
 * The awareness block — injected into every prompt so Aurelius knows
 * what's in its own library without being asked.
 */
export async function getCorpusAwareness(): Promise<string> {
  const [total, byDomain, recent] = await Promise.all([
    prisma.corpusDocument.count(),
    prisma.corpusDocument.groupBy({ by: ["domain"], _count: { id: true } }),
    prisma.corpusDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true, domain: true, createdAt: true },
    }),
  ]);

  if (total === 0) return "";

  const lines = [
    "═══ YOUR LIBRARY (documents you have ingested — you KNOW these exist) ═══",
    `${total} documents: ${byDomain.map((d) => `${d.domain} ${d._count.id}`).join(" · ")}`,
    "Most recent:",
    ...recent.map((r) => `  — "${r.title}" (${r.domain}, ${r.createdAt.toISOString().slice(0, 10)})`),
    "Reference these naturally when relevant. Their contents surface via semantic recall.",
  ];
  return lines.join("\n");
}
