// aurelius/corpus/paperlessPoller.ts
//
// PAPERLESS-NGX → SECOND BRAIN. Dormant until PAPERLESS_URL +
// PAPERLESS_TOKEN land in .env (the Mini deploy step). Then: every 10
// minutes, new OCR'd documents in Paperless flow through the four-write
// ingestion pipeline — vector index, memory, awareness registry, Bridge
// signal — and the domain's wiki page refreshes. Scan a paper, and the
// brain knows it.
//
// Cursor: the last-seen Paperless document id persists in Living
// Knowledge (system.paperless_cursor on the global operator) so restarts
// never re-ingest.

import { prisma } from "../core/db/prisma.ts";
import { ingestDocument } from "./ingest.ts";

function config(): { url: string; token: string } | null {
  const url = process.env.PAPERLESS_URL?.trim().replace(/\/$/, "");
  const token = process.env.PAPERLESS_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

async function getCursor(): Promise<number> {
  const row = await prisma.knowledgeEntry.findFirst({
    where: { scope: "system", key: "paperless_cursor", active: true },
  });
  return typeof row?.value === "number" ? row.value : 0;
}

async function setCursor(id: number) {
  const { resolveOperatorId, setKnowledge } = await import("../knowledge/store.ts");
  const opId = await resolveOperatorId("global");
  if (!opId) return;
  await setKnowledge({
    operatorId: opId,
    scope: "system",
    key: "paperless_cursor",
    value: id,
    sourceType: "system" as any,
    sourceId: "paperless_poller",
    rationale: "ingestion cursor",
    updatedBy: "aurelius",
  });
}

// A doc that fails to ingest holds the cursor so the batch retries it next poll.
// But a genuinely poison doc (bad encoding, an embedding key that 401s on it
// forever) would then block the ENTIRE queue permanently. Count attempts per
// doc id; after MAX_DOC_ATTEMPTS, log loudly, advance past it, and keep going.
const docAttempts = new Map<number, number>();
const MAX_DOC_ATTEMPTS = 3;

export async function pollPaperlessOnce() {
  const cfg = config();
  if (!cfg) return { dormant: true as const };

  const cursor = await getCursor();
  const res = await fetch(
    `${cfg.url}/api/documents/?ordering=id&id__gt=${cursor}&page_size=10`,
    { headers: { Authorization: `Token ${cfg.token}` } }
  );
  if (!res.ok) throw new Error(`paperless list failed: ${res.status}`);
  const json = await res.json();
  const docs: any[] = json?.results ?? [];
  if (docs.length === 0) return { dormant: false as const, ingested: 0 };

  let ingested = 0;
  for (const d of docs) {
    try {
      const content = (d.content ?? "").trim();
      if (content.length < 100) {
        await setCursor(d.id); // skip empties but advance
        continue;
      }
      await ingestDocument({
        title: d.title ?? `Paperless document ${d.id}`,
        content: content.slice(0, 60000),
        sourceType: "upload",
        sourceUrl: `${cfg.url}/documents/${d.id}/`,
        domain: "documents",
        triggeredBy: "schedule",
      });
      ingested++;
      docAttempts.delete(d.id);
      await setCursor(d.id);
    } catch (err) {
      const attempts = (docAttempts.get(d.id) ?? 0) + 1;
      docAttempts.set(d.id, attempts);
      if (attempts >= MAX_DOC_ATTEMPTS) {
        console.error(
          `[paperless] doc ${d.id} failed ${attempts}× — skipping past it so it can't block the queue:`,
          (err as any)?.message ?? err
        );
        docAttempts.delete(d.id);
        await setCursor(d.id); // advance past the poison doc
        continue;
      }
      console.warn(`[paperless] ingest failed for doc ${d.id} (attempt ${attempts}/${MAX_DOC_ATTEMPTS}, cursor holds):`, err);
      break; // stop the batch; retry from cursor next poll
    }
  }
  if (ingested > 0) console.log(`[paperless] ingested ${ingested} documents`);
  return { dormant: false as const, ingested };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPaperlessPoller() {
  if (!config()) {
    console.log("[paperless] no PAPERLESS_URL/TOKEN — poller dormant");
    return;
  }
  if (timer) return;
  console.log("[paperless] poller live (every 10 min)");
  timer = setInterval(() => {
    pollPaperlessOnce().catch((err) => console.warn("[paperless] poll failed:", err));
  }, 10 * 60 * 1000);
  pollPaperlessOnce().catch(() => {});
}
