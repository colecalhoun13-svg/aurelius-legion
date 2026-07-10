// aurelius/router/corpusRouter.ts — second-brain surface. Mounted at /api/corpus.

import { Router, type Request, type Response } from "express";
import { ingestDocument, ingestUrl, listCorpus } from "../corpus/ingest.ts";
import { ask } from "../corpus/ask.ts";

export const corpusRouter = Router();

corpusRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.json(await listCorpus());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

corpusRouter.post("/ingest", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    if (b.url && typeof b.url === "string") {
      return res.json(await ingestUrl(b.url, { domain: b.domain, operatorName: b.operatorName }));
    }
    if (!b.title || !b.content) {
      return res.status(400).json({ error: "title + content (or url) required" });
    }
    res.json(await ingestDocument(b));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

corpusRouter.post("/ask", async (req: Request, res: Response) => {
  try {
    if (!req.body?.question) return res.status(400).json({ error: "question required" });
    res.json(await ask(req.body.question));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
