# Aurelius — Setup & Launch Guide

Two parts:
- **Part 1 — What Aurelius needs from you**, each a copy-paste step-by-step. Do these in the codespace as you have time.
- **Part 2 — The road to the Mac Mini + UGREEN**, the honest launch-readiness list: what's done, what's left, who owns each piece, and the deploy-day sequence.

Everything here is grounded in the actual code. Nothing speculative.

---

# PART 1 — What Aurelius needs from you

Ordered by impact. #1 is the single biggest unlock; the rest you can do in any order.

## 1. Fund the Anthropic API key (biggest unlock)

**Why:** every scheduled ritual (morning briefing, nightly debrief, weekly planning), mission synthesis, goal breakdown, and the semantic answer cache all run on the LLM. Right now the key is *present* but *unfunded*, so those come back empty or generic. Funding it turns numbers-into-voice and starts the "gets smarter" cache filling.

**Steps:**
1. Go to **console.anthropic.com** → sign in.
2. Left menu → **Billing** (or **Plans & Billing**).
3. **Add credits** — $20–30 goes a long way at Claude Sonnet 5's intro pricing (the default engine).
4. No restart needed — the next LLM call just works. Test it: send Aurelius a chat message and check you get a real, useful answer (not empty).

**Optional — the other 5 providers:** OpenAI, Groq, Gemini, DeepSeek, xAI keys are already set. Fund whichever you want the router to use for their specialties (Groq = fast, Gemini = images, etc.). Anthropic alone covers the core; the rest are nice-to-have. Groq has a free tier that already powers your voice notes.

---

## 2. Connect Gmail (read + draft only — it can never send)

**Why:** Aurelius scans your inbox for what actually needs you and drafts replies into your Gmail drafts for your review. The OAuth grant has **no send permission** — this is enforced by Google, not just policy. It physically cannot email anyone.

**Steps:**
1. Make sure the backend is running (`cd aurelius && npx tsx index.ts`) and you've done a `git pull` so Gmail is in the code (boot log shows `registered tool: gmail`).
2. In the codespace **PORTS** tab, copy your forwarded address for port **3001** (looks like `https://something-3001.app.github.dev`).
3. Open in a browser: `https://YOUR-3001-ADDRESS.app.github.dev/api/gmail/auth`
4. Pick your Google account.
5. "Google hasn't verified this app" → **Advanced** → **Go to Aurelius (unsafe)** → **Continue**. (It's your own app; you already published the consent screen for calendar, so this should be smooth.)
6. It'll bounce to a broken `localhost` page — **swap the front of the URL**: replace `http://localhost:3001` with your forwarded `https://...-3001.app.github.dev` address, keep everything from `/api/gmail/callback?...` onward, hit Enter.
7. Black-and-gold **"Gmail connected — read + draft only"** page = done.

**Verify:** the Tools page now shows Gmail as **live**. Or in chat, ask Aurelius "what's in my inbox that needs me?"

---

## 3. Get a free FRED key (economic data for the wealth engine)

**Why:** your 06:30 market pulse gets real macro ground truth — fed funds rate, 10-yr Treasury, yield curve, CPI, unemployment, mortgage rates. Free, ~2 minutes.

**Steps:**
1. Go to **fred.stlouisfed.org** → create a free account (or sign in).
2. Top-right → **My Account** → **API Keys** → **Request API Key**.
3. Fill the short form (any description like "personal dashboard") → you get a 32-character key instantly.
4. Add it to your environment. Easiest in Codespaces: **github.com/settings/codespaces** → **New secret** → name `FRED_API_KEY`, value = your key → save.
5. **Stop and restart the codespace** (secrets only inject at boot — github.com/codespaces → this codespace → ⋯ → Stop, then reopen).
6. Restart the backend. FRED is now folded into the market pulse and available as a tool.

**Verify:** Tools page shows FRED **live**, or ask Aurelius "give me the macro snapshot."

---

## 4. Point Aurelius at your reading feeds (RSS)

**Why:** every morning at 06:00, Aurelius pulls your standing feeds and files a digest into the second brain. This is *steerable by conversation* — no config file.

**Steps (once the Anthropic key is funded so chat works):**
1. In chat, tell Aurelius something like: *"Add these to my standing RSS feeds: [paste 2–5 feed URLs]. Domain them under 'reading' unless I say otherwise."*
2. Aurelius files a Living Knowledge proposal for `research.rss_feeds`.
3. Open the **Bridge** page → **Confirm** the proposal.
4. Next 06:00 sweep (or ask it to run one now) starts ingesting.

Good feeds to start: a couple of training/sports-science blogs, one or two markets/macro sources, whatever you actually read. RSS URLs usually end in `/feed` or `/rss`.

---

## 5. (If you coach) Wire the training engine to your Google Sheets

**Why:** the training engine reads athlete sessions and writes feedback + PRs back — but it needs a Google service account to authenticate to your Sheets. Skip this if you're not using the coaching side right now.

**Steps:**
1. **console.cloud.google.com** → your Aurelius project → **APIs & Services** → **Enable APIs** → enable **Google Sheets API** (and **Google Drive API**).
2. **APIs & Services** → **Credentials** → **Create credentials** → **Service account** → name it (e.g. "aurelius-sheets") → Done.
3. Click the new service account → **Keys** → **Add key** → **Create new key** → **JSON** → downloads a `.json` file.
4. Put that file somewhere in the project (e.g. `aurelius/secrets/sheets-sa.json`) — **it's gitignored, never commit it.**
5. Set `GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH=./secrets/sheets-sa.json` in your `.env` (or as a Codespaces secret).
6. **Share each athlete's Sheet** with the service account's email (found inside the JSON, looks like `aurelius-sheets@project.iam.gserviceaccount.com`) — give it Editor access.
7. Restart the backend. Register each athlete once via the app / API.

**Verify:** ask Aurelius to read a session, or check the Tools page shows Google Sheets **live**.

---

## 6. Seed your real goals (not a credential — an input)

**Why:** the weekly planning session, initiative pulse, and candidate generation all key off your active goals. Empty goals = generic planning.

**Steps:**
1. Frontend → **Goals** page.
2. Add your real ones — big (quarter/year horizon) and small (this week/month). Give each a measure where you can ("hit X", "ship Y by Z").
3. That's it — the Sunday planning session and the 08:00 initiative pulse start using them immediately.

---

## Ongoing maintenance note — Codespaces secrets vs .env

While you're still on the codespace (before the Mini): **Codespaces secrets override `.env`.** If a secret and `.env` disagree, the secret wins, and a changed secret only takes effect after a full **codespace stop/restart** (not just a server restart). The boot log line `injected env (N) from .env` tells you how many vars actually came from `.env` — a `0` means every value is coming from secrets. This whole headache disappears on the Mini, where `.env` is the only source.

---

# PART 2 — The road to the Mac Mini + UGREEN

The locked topology: **Mac Mini** runs everything (backend, reasoning, rituals, schedulers, frontend); **UGREEN NASync** holds the Postgres data, backups, and the Obsidian vault; **Tailscale** makes it reachable from your phone/laptop anywhere; **Neon** becomes warm failover, not primary.

The full runbook is `docs/DEPLOY_MAC_MINI.md`. This section is the **readiness ledger** — what's done, what's left, and who owns each piece.

## A. What YOU need to have in hand before deploy day

| # | Item | Notes |
|---|------|-------|
| 1 | **Mac Mini**, set up, on your network | Any recent one; more RAM helps local inference later |
| 2 | **UGREEN NASync**, on the same LAN | Create an SMB share named `aurelius` + a backups folder |
| 3 | **Tailscale account** (free) | Install on the Mini + your phone/laptop |
| 4 | **All API keys funded** | At minimum Anthropic; the `.env` you'll assemble |
| 5 | **Google OAuth consent screen published** | You did this — kills the weekly re-auth |
| 6 | **The `.env` file** | We'll assemble it together — every key + local DB URL + VAULT_DIR |

## B. What's already built and ready (no work needed)

- ✅ Full backend + frontend, verified (33-check smoke suite, prod build green)
- ✅ The deploy runbook (`docs/DEPLOY_MAC_MINI.md`) — step-by-step §1–9
- ✅ Calendar, Gmail, planning, research, Telegram + voice, scoreboard, learning loops
- ✅ Dormant-until-config integrations that *auto-wake* on the Mini: Paperless poller (every 10 min), RSS, calendar sync
- ✅ launchd keep-alive spec, backup spec, Neon-failover spec (all in the runbook)
- ✅ Migrations (14) — replay onto the Mini's Postgres cleanly

## C. What still needs to happen (the honest gap list)

**Owned by Aurelius (me) — code/config work, mostly at deploy time:**

| Item | Effort | When |
|------|--------|------|
| **Merge PR #4 to main** | 2 min (you click) | Now — everything recent is on it |
| **Embeddings provider swap** (mock → gemini, or local Ollama) | small config + verify | Deploy day — real embeddings need a real provider |
| **Paperless live wiring** | ~0, it's built | Auto-wakes when `PAPERLESS_URL`/`TOKEN` land |
| **whisper.cpp local voice** (replace Groq) | small adapter | Deploy day — fully private voice |
| **Ollama local inference/embeddings** | config swap | Deploy day — sovereignty + free background work |
| **Hammerspoon adapter** (macOS "hands", gated) | ~1 build session | Deploy day — behind the escalation matrix |
| **Caddy reverse proxy** (auto-HTTPS on the tailnet) | runbook §9 | Deploy day |
| **engineRouter consolidation** (clean up legacy path) | small | Optional polish, not blocking |

**Owned by you — the physical/account steps:**

| Item | Effort |
|------|--------|
| Mount the NAS on the Mini (SMB) | 5 min |
| Install Homebrew, Postgres 16 + pgvector, Node, Tailscale | runbook §2, ~20 min |
| Assemble the production `.env` (with me) | 15 min |
| Install the local stack (Syncthing, Paperless, Ollama, whisper.cpp, Caddy, Restic) | runbook §9, staged |

**Owned by reality — can't be rushed:**

| Item | Notes |
|------|-------|
| **Multi-day soak** | The one untested claim: "runs for days, survives restart." Only real time on the Mini proves it. This is *the* reason we deploy and then watch, rather than declaring done. |

## D. Deploy-day sequence (condensed — full detail in DEPLOY_MAC_MINI.md)

1. **Mount the NAS** on the Mini (`smb://<ugreen-ip>/aurelius`).
2. **Install Postgres 16 + pgvector** (Homebrew), point the data dir at the NAS (or keep local + nightly `pg_dump` to NAS).
3. **Clone the repo**, `cd aurelius && npm install`.
4. **Drop in the production `.env`** — keys + `DATABASE_URL=postgresql://cole@localhost:5432/aurelius` + `EMBEDDINGS_PROVIDER=gemini` (or `ollama`) + `VAULT_DIR=~/nas-aurelius/vault` + Telegram + Gmail/calendar OAuth (Google client id/secret).
5. `npx prisma migrate deploy && npx tsx prisma/seed.ts`
6. `npx tsx scripts/backfillEmbeddings.ts` (fresh DB only).
7. `cd ../frontend && npm install && npx next build`.
8. **launchd LaunchAgents** (runbook §4) — backend :3001 + frontend :3000, `KeepAlive=true`, logs to the NAS.
9. **Re-do the OAuth clicks once** on the Mini (calendar + Gmail) — now they point at real `localhost`, so no more URL-swapping ever.
10. **Tailscale** on the Mini → install the PWA on your phone from `http://<mini-tailname>:3000` → Add to Home Screen.
11. **Backups** (runbook §5) — nightly `pg_dump | restic` to the NAS, keep 30 days, monthly restore-test.
12. **Point Obsidian** (desktop + mobile) at the NAS vault share.

## E. Post-launch — the watch

Deploying isn't the finish line; it's the start of the soak. First week on the Mini:
- Watch the boot log survives a Mini reboot (launchd relaunches; catch-up fires missed rituals).
- Confirm the Sunday full loop runs unattended (weekend sweep → persona observer → planning → scoreboard).
- Check the scoreboard's `llmDependenceRate` starts falling as the cache fills.
- Anything that misbehaves → it's traced; we read the cockpit and fix it.

Then, and only then, do we call the DoD line "runs for days without crashing" **proven** rather than **claimed**.

---

## The shortest path to "living on the Mini"

If you want the tightest critical path, it's just this:
1. **Now:** fund Anthropic, merge PR #4, seed your goals, connect Gmail + FRED. Live in it a week on the codespace.
2. **When the hardware's in hand:** we do a deploy session together — I walk you through §D line by line, we assemble the `.env`, and Aurelius moves home.
3. **First week on the Mini:** the soak. We watch, we fix, we prove it.

Everything else (whisper-local, Ollama, Hammerspoon, the business engines) layers on *after* it's living there — none of it blocks the move.
