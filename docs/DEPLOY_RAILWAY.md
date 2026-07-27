# Deploy — Railway (the always-on soak)

The near-term answer to "the briefing only arrives when Cole shows up": run the
**backend** on a $5/mo Railway service so the scheduled spine (07:00 briefing,
calendar sync, the Sunday learning cycles, nightly backups) fires whether or not
a codespace is awake. The **Mac Mini + UGREEN stays the sovereign end-state**
(`DEPLOY_MAC_MINI.md`); this is the soak that proves "runs for days" first —
and everything here transfers: same env, same process, same backup script
(pointed at the NAS instead of a volume).

> **HARD PRECONDITION (council ruling, non-negotiable):** `AURELIUS_API_KEY`
> must be set on the service before the first deploy. An always-on backend
> without the lock is an open grant-writer on the public internet.

## What runs where

| Piece | Where | Why |
|---|---|---|
| Backend (Express + spine + Telegram) | **Railway service** (this doc) | must be always-on |
| Postgres + pgvector | **Neon** (already there) | nothing moves |
| Frontend (Next.js PWA) | stays wherever it is (Codespace now; Railway 2nd service or Vercel later) | doesn't need to be always-on — Telegram is the push surface |
| Backups | Railway **volume** mounted at `/data/backups` | nightly pg_dump lands here |

Telegram needs **no webhook** — the bot long-polls outbound from inside the
process, so it works from any host with no inbound config.

## Steps (~30 minutes, one-time)

1. **railway.com → New Project → Deploy from GitHub repo** → pick
   `aurelius-legion`. When asked for a root directory, set **`aurelius/`**
   (the Dockerfile there is the build recipe — Railway auto-detects it).
2. **Variables** (service → Variables tab). Copy your working values from the
   codespace `.env` / Codespaces secrets:
   - `DATABASE_URL` — the **Neon** URL (never the local sandbox one)
   - `AURELIUS_API_KEY` — a long random string; generate with
     `openssl rand -hex 32`. **Set the same value in the frontend's env** so
     the chat proxy can talk to the backend.
   - `ANTHROPIC_API_KEY` (+ any other engine keys you use)
   - `EMBEDDINGS_PROVIDER` + its key (switch off `mock` — this is the moment)
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `AURELIUS_TZ` (e.g. `America/Chicago` — cron times follow it)
   - `AURELIUS_BACKUP_DIR=/data/backups`
   - optional: `FRED_API_KEY`, `TAVILY_API_KEY`, `FRONTEND_ORIGIN`
3. **Volume**: service → Settings → Volumes → mount at **`/data`** (1 GB is
   plenty). This is where nightly dumps live; without it they vanish on
   redeploy.
4. **Networking**: Settings → Networking → **Generate Domain** ONLY if the
   frontend/phone must reach this backend directly (OAuth connects, chat when
   the frontend isn't sharing a codespace). With the API key set this is safe;
   without a need, skip it — private is private.
5. **Google OAuth redirect**: if you generated a domain and want to (re)connect
   Google from it, add `https://<your-domain>/api/calendar/callback` to the
   OAuth client's authorized redirects in Google Cloud Console. Existing tokens
   keep working — they refresh from any host; you only need this for FUTURE
   re-connects.
6. **Deploy** fires on push to `main` from then on. Watch the boot log for:
   - `[auth]` — must NOT say DORMANT (the key is set)
   - `[backup]` — the staleness warning fires the first boot, then never again
   - the ENV CHECK block — every key you set shows `true`

## The first-week soak (this is the point)

- Day 1: 07:00 briefing arrives on Telegram with the codespace **closed**.
- Any day: `Aurelius → Traces` shows scheduled runs firing on time.
- Sunday: the full learning loop (persona 17:00 → planning 18:00 → freshness
  19:00 → gaps 19:30 → scoreboard 20:00 → decision curriculum 21:00 →
  curriculum ingest 22:00) runs unattended.
- Any morning: a fresh dump sits in `/data/backups` (Railway → service →
  Volume browser, or check the boot log's backup line).

Two clean weeks = the "runs for days" DoD line is proven, and the Mini
migration becomes: run the same env on the Mini, point
`AURELIUS_BACKUP_DIR` at the UGREEN mount, flip DNS/Tailscale, delete the
Railway service.
