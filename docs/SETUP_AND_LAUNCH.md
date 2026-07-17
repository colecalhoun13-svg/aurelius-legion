# Aurelius — Setup & Launch Guide

Everything here is grounded in the actual code (exact env var names, real auth
routes). Nothing speculative.

- **Part 0 — Launch codes** (start it running).
- **Part 1 — What Aurelius needs from you**, each a copy-paste step. Do #1 first;
  the rest in any order.
- **Part 2 — What you can now *say*** (the chat control surface).
- **Part 3 — The road to the Mac Mini + UGREEN** (deploy readiness).

Aurelius is **dormant-until-configured**: every integration boots off, logs one
line, and wakes the moment its key/token lands. Nothing here is required to *run* —
it's required to light each capability up.

---

# PART 0 — Launch codes

Two processes. Backend (Express, port 3001) + frontend (Next.js, port 3000).

```bash
# 1) Backend — from the repo root
cd aurelius && npm install        # first time only
npm run dev                       # = tsx watch index.ts  → http://localhost:3001

# 2) Frontend — in a second terminal, from the repo root
cd frontend && npm install        # first time only
npm run dev                       # → http://localhost:3000
```

Local sandbox DB (already provisioned in the codespace):
`DATABASE_URL=postgresql://aurelius:aurelius@127.0.0.1:5432/aurelius` with
`EMBEDDINGS_PROVIDER=mock`. If Postgres died on a container restart:
`sudo service postgresql start`.

The boot log prints an `ENV CHECK` block (which keys are present) — your fastest
"did my key land?" check.

---

# PART 1 — What Aurelius needs from you

## 1. Fund the Anthropic API key (the biggest unlock)

Every ritual (morning briefing, nightly debrief, weekly planning), mission
synthesis, goal breakdown, and the reuse cache runs on the LLM. The key can be
*present but unfunded* — then answers come back empty/generic.

1. **console.anthropic.com** → sign in → **Billing** → **Add credits** ($20–30
   goes far at Claude Sonnet 5 pricing, the default engine).
2. No restart needed. Test: send Aurelius a chat message, confirm a real answer.

**Optional fallbacks** (`OPENAI_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`,
`DEEPSEEK_API_KEY`, `XAI_API_KEY`): the router fails over across them in order.
Anthropic alone covers the core. Groq's free tier already powers voice notes;
Gemini powers vision, web-search grounding, and (below) memory.

## 2. Turn on real memory (Gemini embeddings)

Recall runs on `mock` embeddings in the sandbox — not semantic. To make "like we
discussed" actually work:

1. Get a **GEMINI_API_KEY** (aistudio.google.com → API key, free tier is fine).
2. Set in `.env` (or Codespaces secret): `GEMINI_API_KEY=...` and
   `EMBEDDINGS_PROVIDER=gemini`.
3. Re-embed everything already stored:
   ```bash
   cd aurelius && npx tsx scripts/backfillEmbeddings.ts
   ```
4. Restart the backend. **Tools page → Memory / recall** should read *live*.

## 3. Google OAuth — one project, then Calendar + Gmail

Calendar and Gmail share one Google Cloud project + one OAuth client. Do this
once; **publishing the consent screen** is what stops the weekly token death.

**A. Create the project + client (~10 min):**
1. **console.cloud.google.com** → create a project (e.g. "Aurelius").
2. **APIs & Services → Enable APIs** → enable **Google Calendar API** and
   **Gmail API** (and **Google Drive API** if you'll use Sheets, §7).
3. **APIs & Services → OAuth consent screen** → **External** → fill app name +
   your email → add yourself under **Test users** → **PUBLISH APP** (moves it to
   "In production"; without this, tokens expire ~weekly).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   **Web application**. Add **Authorized redirect URIs**:
   - `http://localhost:3001/api/calendar/callback`
   - `http://localhost:3001/api/gmail/callback`
   (On the Mini these are the real localhost. In Codespaces you'll URL-swap once —
   step C.)
5. Copy the **Client ID** and **Client secret** into `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   # optional explicit overrides (defaults derive from localhost:3001):
   # GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar/callback
   # GOOGLE_GMAIL_REDIRECT_URI=http://localhost:3001/api/gmail/callback
   ```
6. Restart the backend.

**B. Connect Calendar:** open `http://localhost:3001/api/calendar/auth` (or the
codespace's forwarded `:3001` address) → pick your account → approve. Read/write
events + availability scanning go live.

**C. Connect Gmail (read + draft only — no send scope exists, enforced by
Google):** open `http://localhost:3001/api/gmail/auth` → approve.
- In **Codespaces**, the callback bounces to a broken `localhost` page — swap the
  front of the URL to your forwarded `https://…-3001.app.github.dev` address, keep
  everything from `/api/gmail/callback?…` on, hit Enter. On the Mini this never
  happens.
- **Verify:** Tools page shows Calendar + Gmail *live*; ask "what's on my
  calendar?" / "what's in my inbox that needs me?"

## 4. Telegram — Aurelius in your pocket

1. In Telegram, message **@BotFather** → `/newbot` → name it → copy the **API
   token** (`digits:~35chars`).
2. Message your new bot anything, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser → find
   `"chat":{"id":<number>}` — that's your chat id.
3. `.env`: `TELEGRAM_BOT_TOKEN=...` and `TELEGRAM_CHAT_ID=<number>`.
4. Restart. It boots live; briefings/debriefs push to you, and you can chat,
   send photos/voice, and run `/status /cal /grants /plan /protect /triage`.

## 5. Voice notes (Whisper via Groq)

Set `GROQ_API_KEY=...` (free tier at console.groq.com). Telegram voice notes →
transcribed → same path as typed. (Local whisper.cpp replaces this at deploy.)

## 6. FRED — economic data for the wealth engine

1. **fred.stlouisfed.org** → account → **My Account → API Keys → Request** → copy
   the 32-char key.
2. `.env`: `FRED_API_KEY=...` → restart. Folds into the 06:30 market pulse.

## 7. (Optional) Heavier web search — Tavily

Web search already works keyless via Gemini grounding (needs `GEMINI_API_KEY`).
For deeper, agent-grade research add `TAVILY_API_KEY=...` (free ~500/mo at
tavily.com) — the web tool prefers it automatically.

## 8. (If you coach) Google Sheets — the training engine

1. In the same GCP project: **Credentials → Create credentials → Service
   account** → create → **Keys → Add key → JSON** (downloads a file).
2. Put it in the project (e.g. `aurelius/secrets/sheets-sa.json`) — **gitignored,
   never commit**.
3. `.env`: `GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH=./secrets/sheets-sa.json`.
4. **Share each athlete's Sheet** with the service-account email
   (`…@project.iam.gserviceaccount.com`) as Editor. Restart.

## 9. Instagram — connect once, then metrics + publishing

Drafting works today (keyless, `content.draft_post`). To read your **metrics /
algorithm** and to **publish** (outward — always your one-tap Bridge confirm),
connect your account **once**. The only manual step Meta forces is creating a
developer app; after that it's a single click.

**Your side (~10 min, one time):**

1. Your Instagram must be a **Business or Creator** account (IG app → Settings →
   Account type), and **linked to a Facebook Page** (IG → Settings → linked
   accounts, or from the Page's settings). No Page = no API, that's Meta's rule.
2. Go to **developers.facebook.com** → **My Apps** → **Create App** → type
   **Business**. Name it anything (e.g. "Aurelius").
3. In the app: **Add Product → Instagram** (Instagram Graph API). Under
   **App settings → Basic**, copy the **App ID** and **App Secret**.
4. Under the Instagram/Facebook Login product → **Settings → Valid OAuth Redirect
   URIs**, add exactly:
   `http://localhost:3001/api/instagram/callback`
   (on the Mac Mini, also add your Tailscale HTTPS callback.)
5. Put both values in `.env` and restart:
   ```
   INSTAGRAM_APP_ID=...
   INSTAGRAM_APP_SECRET=...
   ```
   The app stays in **Development mode** — that's fine, it works fully for *your
   own* account (you're the admin). App Review is only needed to let *other*
   people connect, which you don't need.

**Connect (one click):** open **`http://localhost:3001/api/instagram/auth`** →
approve on Meta's screen → done. Aurelius auto-resolves your business account id
and stores a long-lived token (auto-refreshed before it expires). Check state at
`/api/instagram/status`; disconnect with `POST /api/instagram/disconnect`.

**What you get immediately after connecting:**
- *"how's my Instagram doing"* → followers, reach, profile views (30d), recent
  posts, top performer (`content.instagram_metrics`).
- *"read my algorithm" / "what should I post"* → a leverage read from **your own**
  numbers: best day, best time, best format, engagement-rate trend, and 3–4
  concrete moves (`content.instagram_strategy`).
- *"break down my last 6 posts"* → per-post reach/likes/comments/saves
  (`content.instagram_recent_posts`).
- Publishing works too — but stays outward, so every post is a Bridge confirm.

**One caveat on publishing:** IG requires a **public image URL** (Meta fetches
the bytes itself); image hosting lands with the Mac Mini deploy. Metrics and the
strategy read have no such dependency — they work the moment you connect.

*(Legacy path still supported: if you'd rather hand-copy a long-lived token,
`INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ID` in `.env` also work.)*

## 10. Point Aurelius at your reading feeds (RSS) — by conversation

Once chat works: *"Add these to my standing RSS feeds: [2–5 URLs], domain them
under 'reading'."* → Aurelius files a Living Knowledge proposal → **Bridge →
Confirm**. The 06:00 sweep ingests from then on. (Feed URLs usually end `/feed`
or `/rss`.)

## 11. Seed your real goals + grant your first keyhole

- **Goals** page → add your real big (quarter/year) and small (week) goals with a
  measure. The Sunday planning session + 08:00 initiative pulse key off these.
- **Grant one keyhole** to let Aurelius start *acting* (inward, reversible): in
  chat say *"grant schedule protection"* → tap **Confirm** on the Bridge. Now it
  defends your deep-work time on its own (and, if you grant `research.ingest`, it
  runs its own proposed research missions). Revoke anytime: *"revoke schedule
  protection."*

## Ongoing note — Codespaces secrets vs .env

**Codespaces secrets override `.env`**, and a changed secret only takes effect
after a full **codespace stop/restart** (not just a server restart). Boot log
`injected env (N) from .env` shows how many came from `.env`. This disappears on
the Mini, where `.env` is the only source.

---

# PART 2 — What you can now say (chat control surface)

Everything below works in the web chat and Telegram — no dashboard needed.

**Your day**
- "What's on today?" · "Plan my day" · "Today's focus is shipping the program page"
- "Add a task: send the intake form, due Friday" · "Mark the intake form done"
- "Add a quarter goal: sign 10 athletes" · "What are my goals?"

**Rituals / schedule**
- "Move my morning brief to 6:30" · "What's my schedule?"
- "Pause RSS" · "Resume the nightly debrief"

**Autonomy (keyholes)**
- "What can you do on your own?" · "Grant schedule protection" (→ one-tap confirm)
  · "Revoke inbox triage"

**Content (outward)**
- "Draft an IG post about my squat PR" · "Publish that" (→ stops for your confirm)

**Second brain / research**
- Drop photos/videos into chat (it sees + remembers) · "Search the web for …"
- "What do I know about …?" (recall) · launch/confirm research missions

The rule that never bends (NORTH_STAR §2.5): Aurelius **finalizes inward** work
inside a granted keyhole (reversible, traced, lands on the Bridge), and **gates
every outward action** (publish/send/spend) for your confirm. It can never grant
itself autonomy.

---

# PART 3 — The road to the Mac Mini + UGREEN

Topology: **Mac Mini** runs everything (backend, reasoning, rituals, schedulers,
frontend); **UGREEN NASync** holds Postgres data, backups, and the Obsidian
vault; **Tailscale** makes it reachable anywhere; **Neon** becomes warm failover.
Full runbook: `docs/DEPLOY_MAC_MINI.md`.

## A. Have in hand before deploy day
| # | Item | Notes |
|---|------|-------|
| 1 | **Mac Mini** on your network | M4 / 24GB recommended for local inference later |
| 2 | **UGREEN NASync** on the same LAN | SMB share `aurelius` + a backups folder |
| 3 | **Tailscale** (free) | On the Mini + phone/laptop |
| 4 | **API keys funded** | At minimum Anthropic; the `.env` you'll assemble |
| 5 | **Google OAuth consent published** | Part 1 §3 — kills weekly re-auth |
| 6 | **The `.env`** | Assemble together — keys + local DB URL + `VAULT_DIR` |

## B. Already built (no work needed)
- Full backend + frontend, verified (self-cleaning smoke suite, prod build green).
- The acting layer (§2.5): grants, executor, confirm loop, and finalizers for
  schedule-protection, inbox-triage draft, **research ingest**, and **content
  publish** (outward, gated).
- The full chat control surface (Part 2), schedule registry (re-time/pause),
  calendar, Gmail, planning, research, Telegram + voice, scoreboard, learning
  loops, wiki/freshness/corrections/persona.
- Dormant-until-config integrations that auto-wake on the Mini: Paperless poller
  (10 min), RSS, calendar sync.
- launchd keep-alive, backup, Neon-failover specs (in the runbook).

## C. Deploy-day sequence (condensed — detail in DEPLOY_MAC_MINI.md)
1. Mount the NAS (`smb://<ugreen-ip>/aurelius`).
2. Install **Postgres 16 + pgvector** (Homebrew); data dir on the NAS or local +
   nightly `pg_dump` to NAS.
3. `git clone` → `cd aurelius && npm install`.
4. Production `.env`: keys + `DATABASE_URL=postgresql://cole@localhost:5432/aurelius`
   + `EMBEDDINGS_PROVIDER=gemini` (or `ollama`) + `VAULT_DIR=~/nas-aurelius/vault`
   + Telegram + Google client id/secret (+ Instagram/Meta if publishing).
5. `npx prisma migrate deploy && npx tsx prisma/seed.ts`
6. `npx tsx scripts/backfillEmbeddings.ts` (fresh DB only).
7. `cd ../frontend && npm install && npx next build`.
8. **launchd LaunchAgents** — backend :3001 + frontend :3000, `KeepAlive=true`,
   logs to the NAS.
9. Re-do the OAuth clicks once on the Mini (now real localhost — no URL-swap ever).
10. **Tailscale** → install the PWA on your phone from `http://<mini>:3000`.
11. **Backups** — nightly `pg_dump | restic` to the NAS, 30-day keep, monthly
    restore test.
12. Point Obsidian (desktop + mobile) at the NAS vault share.

## D. Post-launch — the watch
Deploying starts the soak (the one DoD line real time must prove: "runs for days,
survives restart"). First week: confirm launchd relaunches after a reboot and
catch-up fires missed rituals; the Sunday full loop runs unattended; the
scoreboard's `llmDependenceRate` falls as the cache fills. Anything odd is
traced — read the cockpit and fix.

## E. Layers on *after* the move (none block it)
Local whisper.cpp (private voice), Ollama (local inference/embeddings),
Hammerspoon (gated macOS "hands"), Caddy (auto-HTTPS on the tailnet), public
image hosting for IG, and — when you're ready with real business data — the
Business Engine (parked by design).
