// aurelius/router/gmailRouter.ts — the Gmail OAuth handshake + read surface.
// /auth and /callback are the one-time connect (draft-only grant).
// Mounted at /api/gmail. All routes static.

import { Router, type Request, type Response } from "express";
import { gmailAuth, listInbox } from "../gmail/engine.ts";

export const gmailRouter = Router();

gmailRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const configured = gmailAuth.isConfigured();
    const connected = configured && (await gmailAuth.isConnected());
    res.json({ configured, connected, authUrl: configured && !connected ? "/api/gmail/auth" : null });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

gmailRouter.get("/auth", (_req: Request, res: Response) => {
  const url = gmailAuth.buildAuthUrl();
  if (!url) return res.status(400).send("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set. Add them and restart.");
  res.redirect(url);
});

gmailRouter.get("/callback", async (req: Request, res: Response) => {
  const code = String(req.query.code ?? "");
  const gerror = String(req.query.error ?? "");
  if (gerror) return res.status(400).send(`Google returned an error: ${gerror}`);
  if (!code) return res.status(400).send("Missing ?code from Google.");
  const result = await gmailAuth.handleCallback(code);
  if (!result.ok) return res.status(500).send(`Connection failed: ${result.error}`);
  res.send(`<!doctype html><html><body style="background:#0a0a0a;color:#d4af37;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
    <div style="text-align:center;border:1px solid rgba(212,175,55,.4);padding:48px 64px;border-radius:12px">
      <div style="font-size:28px;letter-spacing:.2em">AURELIUS</div>
      <div style="margin-top:16px;color:#e5e5e5">Gmail connected — read + draft only.</div>
      <div style="margin-top:8px;color:#888;font-size:14px">Aurelius can read your inbox and draft replies. It cannot send. You can close this tab.</div>
    </div></body></html>`);
});

gmailRouter.get("/inbox", async (req: Request, res: Response) => {
  try {
    if (!(await gmailAuth.isConnected())) {
      return res.status(409).json({ error: "not connected — open /api/gmail/auth" });
    }
    const items = await listInbox({ max: Number(req.query.max) || 10, query: req.query.q ? String(req.query.q) : undefined });
    res.json({ messages: items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

gmailRouter.post("/disconnect", async (_req: Request, res: Response) => {
  await gmailAuth.disconnect();
  res.json({ ok: true });
});
