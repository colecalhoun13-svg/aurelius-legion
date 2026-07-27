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

## What runs where — TWO services, one project

| Piece | Where | Why |
|---|---|---|
| Backend (Express + spine + Telegram) | **Railway service 1** (`aurelius/Dockerfile`) | must be always-on |
| Frontend (the app — Next.js PWA) | **Railway service 2** (`Dockerfile.frontend` at repo root) | gives the app a PERMANENT URL — open it from your phone anytime, no codespace |
| Postgres + pgvector | **Neon** (already there) | nothing moves |
| Backups | Railway **volume** on service 1, mounted at `/data/backups` | nightly pg_dump lands here |

**Where you find the app after deploying:** the frontend service's generated
domain — `https://<something>.up.railway.app`. Open it on your phone → share
menu → **Add to Home Screen** → the crest icon on your phone is now the app's
permanent home, codespace or no codespace.

Telegram needs **no webhook** — the bot long-polls outbound from inside the
process, so it works from any host with no inbound config.

## Service 1 — the backend (~20 minutes, one-time)

1. **railway.com → New Project → Deploy from GitHub repo** → pick
   `aurelius-legion`. In the service's **Settings → Root Directory**, set
   **`aurelius`** (its Dockerfile is the build recipe — Railway auto-detects it).
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
4. **Networking**: Settings → Networking → **Generate Domain** — with the
   two-service setup you WANT this one public too: the phone's Connect links
   (Google/Gmail/Instagram OAuth) go straight to the backend. The API key
   makes this safe; OAuth callbacks are the only open routes.
5. **Google OAuth redirect**: add
   `https://<backend-domain>/api/calendar/callback` (and the gmail/instagram
   equivalents you use) to the OAuth client's authorized redirects in Google
   Cloud Console. Existing tokens keep working — they refresh from any host;
   this matters only for FUTURE re-connects.
6. **Deploy** fires on push to `main` from then on. Watch the boot log for:
   - `[auth]` — must NOT say DORMANT (the key is set)
   - `[backup]` — the staleness warning fires the first boot, then never again
   - the ENV CHECK block — every key you set shows `true`

## Service 2 — the app itself (~10 minutes)

1. Same project → **New Service → GitHub repo** → `aurelius-legion` again.
2. **Settings → Build**: leave Root Directory at the repo root and set
   **Dockerfile Path = `Dockerfile.frontend`** (it builds BOTH trees — the
   frontend's API routes import backend modules directly, so `frontend/`
   alone can't build).
3. **Variables** (frontend service):
   - `DATABASE_URL` — same Neon URL (the app's API routes read the DB directly)
   - `AURELIUS_API_KEY` — same value as the backend (unlocks the chat proxy)
   - `BACKEND_ORIGIN` — the backend's **private** URL from Railway's service
     panel (e.g. `http://aurelius-backend.railway.internal:3001`) so chat
     rides the internal network
   - `NEXT_PUBLIC_BACKEND_URL` — the backend's **public** domain from step 4
     above (baked into the build — it's where the phone's Connect buttons point)
   - engine/embeddings keys the API routes use: `ANTHROPIC_API_KEY`,
     `EMBEDDINGS_PROVIDER` + its key
4. **Settings → Networking → Generate Domain.** That domain is THE APP:
   `https://<something>.up.railway.app`. Open it on your phone → share menu →
   **Add to Home Screen** → the crest on your home screen now opens Aurelius
   from anywhere, forever, codespace closed.
5. Redeploys of both services fire automatically on every push to `main`.

*(Build recipe verified against the identical native sequence — two `npm ci`,
`prisma generate`, prod `next build`, all green; the first Railway build log
is the live confirmation.)*

## The first-week soak (this is the point)

- Day 1: 07:00 briefing arrives on Telegram with the codespace **closed**.
- Any day: `Aurelius → Traces` shows scheduled runs firing on time.
- Sunday: the full learning loop (persona 17:00 → planning 18:00 → freshness
  19:00 → gaps 19:30 → scoreboard 20:00 → decision curriculum 21:00 →
  curriculum ingest 22:00) runs unattended.
- Any morning: a fresh dump sits in `/data/backups` (Railway → service →
  Volume browser, or check the boot log's backup line).

- Any moment: the app answers at its permanent domain from your phone with
  the codespace closed — that's the "where do I find it" answer, forever.

Two clean weeks = the "runs for days" DoD line is proven, and the Mini
migration becomes: run the same env on the Mini, point
`AURELIUS_BACKUP_DIR` at the UGREEN mount, flip DNS/Tailscale, delete both
Railway services.
