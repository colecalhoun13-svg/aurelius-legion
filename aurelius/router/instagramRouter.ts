// aurelius/router/instagramRouter.ts
//
// INSTAGRAM API — the OAuth handshake plus a status/metrics surface. /auth and
// /callback are the one-time connect flow (mirrors the calendar flow). All
// routes static (no /:param), so ordering hazards don't apply.

import { Router, type Request, type Response } from "express";
import {
  buildAuthUrl,
  handleOAuthCallback,
  isInstagramConfigured,
  isInstagramConnected,
  disconnectInstagram,
} from "../instagram/auth.ts";

export const instagramRouter = Router();

// GET /api/instagram/status — configured (app creds)? connected (authorized)?
instagramRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const configured = isInstagramConfigured();
    const connected = await isInstagramConnected();
    res.json({
      configured,
      connected,
      authUrl: configured && !connected ? "/api/instagram/auth" : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// GET /api/instagram/auth — the one link Cole clicks, once.
instagramRouter.get("/auth", (_req: Request, res: Response) => {
  const url = buildAuthUrl();
  if (!url) {
    return res
      .status(400)
      .send("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET are not set. Create a Meta app, add them to .env, and restart.");
  }
  res.redirect(url);
});

// GET /api/instagram/callback — Meta lands here with ?code=
instagramRouter.get("/callback", async (req: Request, res: Response) => {
  const code = String(req.query.code ?? "");
  const err = String(req.query.error_description ?? req.query.error ?? "");
  if (err) return res.status(400).send(`Instagram/Meta returned an error: ${err}`);
  if (!code) return res.status(400).send("Missing ?code from Meta.");

  const result = await handleOAuthCallback(code);
  if (!result.ok) return res.status(500).send(`Connection failed: ${result.error}`);

  res.send(`<!doctype html><html><body style="background:#0a0a0a;color:#d4af37;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
    <div style="text-align:center;border:1px solid rgba(212,175,55,.4);padding:48px 64px;border-radius:12px">
      <div style="font-size:28px;letter-spacing:.2em">AURELIUS</div>
      <div style="margin-top:16px;color:#e5e5e5">Instagram connected${result.username ? ` — @${result.username}` : ""}.</div>
      <div style="margin-top:8px;color:#888;font-size:14px">Metrics are live now; publishing still stops for your one-tap confirm. You can close this tab.</div>
    </div></body></html>`);
});

// POST /api/instagram/disconnect — burn the stored credentials.
instagramRouter.post("/disconnect", async (_req: Request, res: Response) => {
  await disconnectInstagram();
  res.json({ ok: true });
});
