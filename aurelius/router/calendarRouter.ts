// aurelius/router/calendarRouter.ts
//
// CALENDAR API — the OAuth handshake plus the engine's surface.
// /auth and /callback are the one-time connect flow; everything else
// reads/writes through the engine. All routes are static (no /:param),
// so ordering hazards don't apply here.

import { Router, type Request, type Response } from "express";
import {
  buildAuthUrl,
  handleOAuthCallback,
  isCalendarConfigured,
  isCalendarConnected,
  disconnectCalendar,
} from "../calendar/googleAuth.ts";
import {
  syncCalendar,
  createCalendarEvent,
  listEventsRange,
  findAvailability,
} from "../calendar/engine.ts";
import { prisma } from "../core/db/prisma.ts";

export const calendarRouter = Router();

// GET /api/calendar/status — configured? connected? how fresh?
calendarRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const configured = isCalendarConfigured();
    const connected = configured && (await isCalendarConnected());
    const [count, latest] = connected
      ? await Promise.all([
          prisma.calendarEvent.count({
            where: { startAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400_000) } },
          }),
          prisma.calendarEvent.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
        ])
      : [0, null];
    res.json({
      configured,
      connected,
      eventsNext7Days: count,
      lastSyncAt: latest?.syncedAt ?? null,
      authUrl: configured && !connected ? "/api/calendar/auth" : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// GET /api/calendar/auth — the one link Cole clicks, once.
calendarRouter.get("/auth", (_req: Request, res: Response) => {
  const url = buildAuthUrl();
  if (!url) {
    return res
      .status(400)
      .send("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set. Add them and restart.");
  }
  res.redirect(url);
});

// GET /api/calendar/callback — Google lands here with ?code=
calendarRouter.get("/callback", async (req: Request, res: Response) => {
  const code = String(req.query.code ?? "");
  const gerror = String(req.query.error ?? "");
  if (gerror) return res.status(400).send(`Google returned an error: ${gerror}`);
  if (!code) return res.status(400).send("Missing ?code from Google.");

  const result = await handleOAuthCallback(code);
  if (!result.ok) return res.status(500).send(`Connection failed: ${result.error}`);

  // First sync runs in the background; the page doesn't wait on Google.
  syncCalendar()
    .then(async (r) => {
      if (r.ok) {
        await prisma.bridgeSignal.create({
          data: {
            kind: "background_result",
            domain: "personal",
            sourceType: "system",
            severity: "notice",
            title: "Google Calendar connected",
            body: `First sync complete — ${r.upserted} events mirrored. Sync runs every 15 minutes from here.`,
          },
        });
      }
    })
    .catch((err) => console.warn("[calendar] first sync failed:", err?.message ?? err));

  res.send(`<!doctype html><html><body style="background:#0a0a0a;color:#d4af37;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
    <div style="text-align:center;border:1px solid rgba(212,175,55,.4);padding:48px 64px;border-radius:12px">
      <div style="font-size:28px;letter-spacing:.2em">AURELIUS</div>
      <div style="margin-top:16px;color:#e5e5e5">Google Calendar connected.</div>
      <div style="margin-top:8px;color:#888;font-size:14px">First sync is running — events appear on the Calendar page shortly. You can close this tab.</div>
    </div></body></html>`);
});

// POST /api/calendar/sync — manual pull, on demand.
calendarRouter.post("/sync", async (_req: Request, res: Response) => {
  try {
    const r = await syncCalendar();
    if (!r.ok) return res.status(409).json({ error: "not connected — open /api/calendar/auth" });
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// GET /api/calendar/events?from=ISO&to=ISO (or ?days=7)
calendarRouter.get("/events", async (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days ?? 7);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to
      ? new Date(String(req.query.to))
      : new Date(from.getTime() + days * 86400_000);
    res.json({ events: await listEventsRange(from, to) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/calendar/events — create on Google, mirror locally.
calendarRouter.post("/events", async (req: Request, res: Response) => {
  try {
    const { title, start, end, durationMinutes, description, location, domain } = req.body ?? {};
    if (!title || !start) return res.status(400).json({ error: "title and start (ISO) required" });
    const startAt = new Date(start);
    const endAt = end ? new Date(end) : new Date(startAt.getTime() + (Number(durationMinutes) || 60) * 60000);
    const event = await createCalendarEvent({ title, startAt, endAt, description, location, domain });
    res.json({ event });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// GET /api/calendar/availability?days=7&min=60
calendarRouter.get("/availability", async (req: Request, res: Response) => {
  try {
    const days = await findAvailability({
      days: Number(req.query.days ?? 7),
      minMinutes: Number(req.query.min ?? 60),
    });
    res.json({ days });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/calendar/disconnect — burn the stored tokens.
calendarRouter.post("/disconnect", async (_req: Request, res: Response) => {
  await disconnectCalendar();
  res.json({ ok: true });
});
