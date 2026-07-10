// aurelius/wiki/engine.ts
//
// THE WIKI — Aurelius's own synthesis (the LLM-wiki pattern).
//
// The corpus stores what came in; the wiki is what Aurelius UNDERSTANDS.
// One living markdown page per domain, rewritten from everything absorbed:
// corpus documents, recent memories, confirmed Living Knowledge. Every
// revision is kept, every page embeds into semantic recall — synthesis
// compounds, tomorrow's answers stand on today's write-ups.
//
// Deterministic fallback: with no LLM engine, the page is a structured
// digest (document summaries + memory highlights). Useful, never fake.
// Hard rule carried: the wiki cites only what exists — never invents.

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { embedSourceSafe } from "../retrieval/embedPipeline.ts";

function engineUnavailable(text: string): boolean {
  return /engine is not configured|Missing .*_API_KEY/i.test(text);
}

async function gatherDomainMaterial(domain: string) {
  const [docs, memories, knowledge] = await Promise.all([
    prisma.corpusDocument.findMany({
      where: { domain },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, summary: true, sourceType: true, createdAt: true },
    }),
    prisma.memory.findMany({
      where: { category: { in: ["facts", "research"] } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { value: true, category: true, createdAt: true },
    }),
    prisma.knowledgeEntry.findMany({
      where: { active: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { scope: true, key: true, value: true },
    }),
  ]);
  return { docs, memories, knowledge };
}

function deterministicPage(domain: string, m: Awaited<ReturnType<typeof gatherDomainMaterial>>) {
  const lines = [
    `# ${domain} — synthesis`,
    "",
    "_Digest edition — assembled without an LLM pass. A voiced synthesis replaces this on the next run with an engine available._",
    "",
    "## Documents absorbed",
    ...(m.docs.length
      ? m.docs.map((d) => `- **${d.title}** (${d.sourceType}) — ${d.summary ?? "no summary"}`)
      : ["- (none yet)"]),
    "",
    "## Recent signal",
    ...(m.memories.length
      ? m.memories.slice(0, 10).map((x) => `- ${x.value.slice(0, 160)}`)
      : ["- (none yet)"]),
  ];
  return lines.join("\n");
}

/**
 * Rewrite the domain's wiki page from current material.
 * Non-destructive: prior content becomes a WikiRevision.
 */
export async function synthesizeWikiPage(domain: string, reason = "manual") {
  const material = await gatherDomainMaterial(domain);
  const existing = await prisma.wikiPage.findUnique({ where: { slug: domain } });

  // A domain with no material and no standing page has nothing to say.
  // Living documents (standing pages) synthesize even before their first
  // corpus doc — from memories and confirmed knowledge.
  if (material.docs.length === 0 && !existing) {
    return { skipped: true as const, reason: "no corpus documents in domain" };
  }

  const docsBlock = material.docs
    .map((d) => `- "${d.title}" — ${d.summary ?? "(no summary)"}`)
    .join("\n");
  const memBlock = material.memories.map((x) => `- ${x.value.slice(0, 200)}`).join("\n");
  const knBlock = material.knowledge
    .map((k) => `- ${k.scope}.${k.key} = ${JSON.stringify(k.value).slice(0, 120)}`)
    .join("\n");

  let content: string | null = null;
  try {
    const response = await runLLM({
      taskType: "chat",
      operators: { primary: "strategy", secondaries: [] },
      input: `
Rewrite the living wiki page for the "${domain}" domain of Cole's second brain.
This is YOUR synthesis — what you actually understand from the material, not a
list. Markdown. Structure: a 2-3 sentence "State of play" up top, then themed
sections that connect the material, then "Open questions" (what's thin or
contradictory), then "Sources" listing document titles used. Ground every
claim in the material below — never invent. Under 700 words.
${existing ? `\nCurrent page for continuity (improve, don't repeat verbatim):\n${existing.content.slice(0, 2500)}\n` : ""}
═══ DOCUMENTS ═══
${docsBlock}

═══ RECENT MEMORY ═══
${memBlock || "(none)"}

═══ CONFIRMED LIVING KNOWLEDGE ═══
${knBlock || "(none)"}
`.trim(),
    });
    if (!engineUnavailable(response.text)) content = response.text;
  } catch (err) {
    console.warn("[wiki] LLM synthesis failed, using digest:", err);
  }
  if (!content) content = deterministicPage(domain, material);

  const sourceRefs = {
    corpusDocIds: material.docs.map((d) => d.id),
    memoryCount: material.memories.length,
    knowledgeCount: material.knowledge.length,
  };

  const page = existing
    ? await prisma.wikiPage.update({
        where: { id: existing.id },
        data: { content, sourceRefs, revision: existing.revision + 1 },
      })
    : await prisma.wikiPage.create({
        data: { slug: domain, title: `${domain} — synthesis`, domain, content, sourceRefs },
      });

  await prisma.wikiRevision.create({
    data: { pageId: page.id, revision: page.revision, content, reason },
  });

  // The synthesis itself joins recall — understanding compounds.
  embedSourceSafe({
    sourceType: "wiki_page",
    sourceId: page.id,
    text: `${page.title}\n\n${content}`,
    operatorId: null,
    domain,
  });

  await prisma.bridgeSignal.create({
    data: {
      kind: "background_result",
      domain,
      sourceType: "wiki",
      sourceId: page.id,
      severity: "info",
      title: `Wiki rewritten: ${domain} (rev ${page.revision})`,
      body: content.slice(0, 600),
    },
  });

  // Mirror to the vault (Obsidian-compatible markdown) — fire-and-forget.
  import("./vaultMirror.ts")
    .then(async (m) => { await m.mirrorWikiPage(page); await m.mirrorIndex(); })
    .catch((err) => console.warn("[wiki] vault mirror failed (non-fatal):", err));

  console.log(`[wiki] ${domain} rev ${page.revision} (${reason})`);
  return { skipped: false as const, page };
}

/** Refresh every domain with corpus material + the five living documents. */
export async function synthesizeAllDomains(reason = "schedule") {
  const corpusDomains = await prisma.corpusDocument.groupBy({ by: ["domain"] });
  const { LIVING_DOCS } = await import("./livingDocs.ts");
  const all = new Set<string>([...corpusDomains.map((d) => d.domain), ...Object.keys(LIVING_DOCS)]);
  const results = [];
  for (const domain of all) {
    const d = { domain };
    try {
      results.push({ domain: d.domain, ...(await synthesizeWikiPage(d.domain, reason)) });
    } catch (err: any) {
      results.push({ domain: d.domain, skipped: true, reason: err?.message ?? String(err) });
    }
  }
  return results;
}

export async function listWikiPages() {
  return prisma.wikiPage.findMany({
    orderBy: { updatedAt: "desc" },
    select: { slug: true, title: true, domain: true, revision: true, updatedAt: true },
  });
}

export async function getWikiPage(slug: string) {
  return prisma.wikiPage.findUnique({
    where: { slug },
    include: {
      revisions: { orderBy: { revision: "desc" }, take: 5, select: { revision: true, reason: true, createdAt: true } },
    },
  });
}
