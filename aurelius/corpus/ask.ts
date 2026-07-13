// aurelius/corpus/ask.ts
//
// /ask — recall-grounded answering. The question is embedded, the closest
// knowledge/memories/documents/reasoning surface, and the LLM answers FROM
// them, citing sources. If nothing relevant surfaces, it says so — the
// hard rule against fabrication applies doubly to the second brain.

import { runLLM } from "../llm/runLLM.ts";
import { semanticRecall } from "../retrieval/retrieve.ts";
import { prisma } from "../core/db/prisma.ts";
import { extractDirectives } from "../llm/directiveParser.ts";

export type AskResult = {
  answer: string;
  sources: { sourceType: string; sourceId: string; title: string; similarity: number }[];
  engine: string;
  recallCount: number;
};

export async function ask(question: string): Promise<AskResult> {
  const hits = await semanticRecall({ query: question, limit: 10 });

  // Resolve human-readable titles for corpus hits
  const corpusIds = hits.filter((h) => h.sourceType === "corpus_doc").map((h) => h.sourceId);
  const docs = corpusIds.length
    ? await prisma.corpusDocument.findMany({
        where: { id: { in: corpusIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(docs.map((d) => [d.id, d.title]));

  const sources = hits.map((h) => ({
    sourceType: h.sourceType,
    sourceId: h.sourceId,
    title:
      h.sourceType === "corpus_doc"
        ? titleById.get(h.sourceId) ?? "document"
        : h.chunkText.slice(0, 60),
    similarity: Math.round(h.similarity * 100) / 100,
  }));

  const recallBlock =
    hits.length > 0
      ? hits
          .map((h, i) => `[${i + 1} · ${h.sourceType} · ${(h.similarity * 100).toFixed(0)}%] ${h.chunkText}`)
          .join("\n\n")
      : "(nothing relevant found in the second brain)";

  const prompt = `
Cole is asking his second brain a question. Answer FROM the recalled material
below. Cite which numbered sources you drew on. If the recall doesn't contain
the answer, say so plainly — never invent. Be tactical and brief.

═══ RECALLED FROM THE SECOND BRAIN ═══
${recallBlock}

═══ COLE'S QUESTION ═══
${question}
`.trim();

  const response = await runLLM({
    taskType: "chat",
    operators: { primary: "strategy", secondaries: [] },
    input: prompt,
  });

  // buildSystemPrompt injects the tool catalog into EVERY call, so the model can
  // emit a stray [TOOL:]/[SAVE:] directive here too. This path doesn't execute
  // tools — it just answers — so strip any directives rather than print raw
  // "[TOOL: ...]" text to Cole (visible on Telegram /ask and photo captions).
  const answer = extractDirectives(response.text ?? "").cleanedText || response.text;

  return {
    answer,
    sources,
    engine: `${response.engine}/${response.model}`,
    recallCount: hits.length,
  };
}
