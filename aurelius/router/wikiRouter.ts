// aurelius/router/wikiRouter.ts — the synthesis surface. Mounted at /api/wiki.

import { Router, type Request, type Response } from "express";
import { listWikiPages, getWikiPage, synthesizeWikiPage, synthesizeAllDomains } from "../wiki/engine.ts";

export const wikiRouter = Router();

wikiRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.json({ pages: await listWikiPages() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// Static routes BEFORE /:slug — Express matches in order.
wikiRouter.post("/vault/rebuild", async (_req: Request, res: Response) => {
  try {
    const { mirrorAll } = await import("../wiki/vaultMirror.ts");
    res.json(await mirrorAll());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

wikiRouter.get("/:slug", async (req: Request, res: Response) => {
  try {
    const page = await getWikiPage(String(req.params.slug));
    if (!page) return res.status(404).json({ error: "not found" });
    res.json({ page });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

wikiRouter.post("/:slug/rebuild", async (req: Request, res: Response) => {
  try {
    res.json(await synthesizeWikiPage(String(req.params.slug), "manual"));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

wikiRouter.post("/rebuild-all", async (_req: Request, res: Response) => {
  try {
    res.json({ results: await synthesizeAllDomains("manual") });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
