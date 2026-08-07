# Aurelius — Full Deployment Plan (Mac Mini + UGREEN NASync)

Local-first, sovereign, always-on (NORTH_STAR §3). Written to be followed
top-to-bottom by someone who is NOT a sysadmin. Copy-paste the commands; each
step says what you should see. Budget ~a weekend for the whole thing; most of it
is unattended installs.

**The topology, in one line:** the **Mac Mini** is the brain (runs everything and
holds the database on its fast internal SSD); the **UGREEN NASync** is the vault +
backup drive (holds your documents and nightly database backups); **Tailscale**
lets you reach Aurelius from your phone anywhere; **Neon** (cloud) stays as a cold
backup only.

> **One correction to the old plan:** do NOT run Postgres directly off the NAS
> over the network — it's slower and can corrupt under file-locking. The database
> lives on the **Mini's SSD**; the NAS is its **backup target and document store**.
> This doc does it the safe way.

---

## PART 0 — What to buy (the shopping list)

Total ballpark: **~$2,000–2,400** depending on options. Here's the exact kit and
why each spec matters.

### The Mac Mini — the brain
Get the **current Apple Mac Mini (M4 as of this writing, or newer)** with:

| Spec | Buy | Why |
|---|---|---|
| **Chip** | **M4 (base)** is plenty. M4 Pro only if you later want to run big local AI models. | Aurelius's heavy thinking uses cloud models; the Mini runs the OS, database, and small local embedding models. |
| **Memory (RAM)** | **24GB** (sweet spot). 16GB works; **32GB** if you want to run local LLMs later. | Postgres + backend + frontend + local embeddings all share this. 24GB gives comfortable headroom; this is the spec that matters most and can't be upgraded later. |
| **Storage (SSD)** | **512GB** (recommended). 256GB is tight; 1TB if you'll keep lots of local AI models/media. | macOS + Aurelius + database + local model files. The DB itself is small; the models and headroom aren't. |

**Recommended config: M4 / 24GB / 512GB — roughly $999.** Order RAM high; it's the
one thing you can never add later.

### The UGREEN NASync — the vault + backups
Get a **UGREEN NASync** (their NAS line). Two good choices:

- **Budget: NASync DXP2800 (2-bay)** — ~$400. Enough for backups + your document
  vault. Two drive slots.
- **Recommended: NASync DXP4800 Plus (4-bay)** — ~$700. Faster, 4 slots (room to
  grow into athlete video / media later), has M.2 SSD-cache slots. **Get this one
  if the budget allows** — you won't outgrow it.

### The hard drives — buy these WITH the NAS
Do **not** use cheap desktop drives. Use **NAS-rated drives** (they're built for
24/7 and won't silently drop data):

- **Seagate IronWolf** or **WD Red Plus** — either is right. Avoid anything labeled
  "SMR"; these are CMR, which is what you want.
- **Buy TWO identical drives and mirror them (RAID 1).** One drive can die and you
  lose nothing. Two 8TB drives in RAID 1 = 8TB usable, fully mirrored.
- **Recommended: 2 × 8TB WD Red Plus (or IronWolf) — ~$180 each, ~$360 total.**
  Generous for years. Budget option: 2 × 4TB (~$110 each) = 4TB usable.

> If you got the 4-bay DXP4800 Plus, start with 2 drives in RAID 1 now; add 2 more
> later when you want more space. No rush.

### Nice-to-haves (skip for launch, add later)
- An **M.2 NVMe SSD** for the NAS's cache slot (DXP4800 Plus) — speeds up the NAS,
  not required.
- A small **UPS battery backup** (~$60) — keeps the Mini + NAS alive through a
  power blip so nothing corrupts. Genuinely worth it for an always-on box.

---

## PART 1 — Do this NOW, before the hardware arrives (~30 min, your laptop)

These four unlock everything and don't need the Mini. Do them today.

1. **Fund the Anthropic key.** console.anthropic.com → Billing → add payment →
   buy ~$20 credits. *This is the single biggest unlock — the brain goes from
   silent to thinking.*
2. **Publish the Google OAuth consent screen.** console.cloud.google.com → APIs &
   Services → OAuth consent screen → **Publish app** (Testing → In production).
   *This kills the every-7-days login death. One click, no Google review needed
   for personal use.*
3. **Get the Telegram bot token + your chat ID.** In Telegram, message
   **@BotFather** → `/newbot` → follow prompts → copy the **API token**. Then
   message your new bot once; when Aurelius runs it'll echo your **chat id** (or
   message @userinfobot to get it). Save both.
4. **Get a free FRED key** (optional, macro data). fred.stlouisfed.org → My
   Account → API Keys.

Keep these four values somewhere safe — they go in the `.env` in Part 4.

---

## PART 2 — Mac Mini first-boot setup (~30 min, mostly waiting)

1. **Set up macOS** normally. Turn OFF sleep (this box must stay awake):
   System Settings → **Energy** → "Prevent automatic sleeping when the display is
   off" **ON**, and set "Start up automatically after a power failure" **ON**.
2. **Open Terminal** (Cmd+Space → "Terminal") and install **Homebrew** (the
   thing that installs everything else):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Follow the final "Next steps" it prints (two `echo`/`eval` lines) to finish.
3. **Install the stack:**
   ```bash
   brew install node@22 postgresql@16 pgvector git
   brew services start postgresql@16      # Postgres now runs on boot, forever
   ```
   Verify: `psql postgres -c 'select version();'` should print a Postgres 16 line.

---

## PART 3 — NAS setup (~30 min, mostly the NAS doing its thing)

1. **Put the two drives in the NAS**, power it on, connect it to your router by
   ethernet. Find it on your network (UGREEN's app or `http://<nas-ip>`).
2. **In the UGREEN web UI:** create a **storage pool** with the two drives in
   **RAID 1 (mirror)**. It'll take a while to initialize — let it run.
3. **Create two shared folders:** `aurelius-vault` (your documents/notes) and
   `aurelius-backups` (database backups). Enable **SMB** on them.
4. **Mount them on the Mini:** Finder → Cmd+K →
   `smb://<nas-ip>/aurelius-vault` → connect, check "remember password." Repeat
   for backups. Then make them auto-mount at login: System Settings → General →
   Login Items → **＋** → add both mounted shares.
   ```bash
   # confirm they're mounted:
   ls /Volumes/aurelius-vault /Volumes/aurelius-backups
   ```

---

## PART 4 — Install Aurelius (~20 min)

```bash
cd ~
git clone https://github.com/colecalhoun13-svg/aurelius-legion
cd aurelius-legion/aurelius

# create the database on the Mini's SSD (fast + safe):
createdb aurelius
psql aurelius -c 'CREATE EXTENSION IF NOT EXISTS vector;'

npm install
```

Now create the `.env` file (`nano .env`, paste, fill in your values from Part 1):

```bash
# ── Database (local on the Mini SSD) ──
DATABASE_URL=postgresql://localhost:5432/aurelius

# ── The brain ──
# ANTHROPIC IS THE DEFAULT TIER: a handful of task types route elsewhere and
# EVERYTHING ELSE lands here. If this key is missing the system does not error —
# it quietly fails over to whichever other provider is set, and you get a
# substitute model's reasoning under Aurelius's name. On the Railway deploy that
# went unnoticed for a week. Set this one first, and confirm it with /doctor.
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=           # optional (first failover)
GROQ_API_KEY=             # optional (free tier — good for the fast lane + voice)
GEMINI_API_KEY=AIza...    # free — powers embeddings
DEEPSEEK_API_KEY=         # optional
XAI_API_KEY=              # optional

# Model overrides — only if your account can't reach the defaults
# (claude-sonnet-5 for chat, claude-opus-4-8 for /deep). /doctor names the
# models your key CAN reach when a probe 404s.
# ANTHROPIC_CHAT_MODEL=
# ANTHROPIC_OPUS_MODEL=

# ── Memory (real recall, free via Gemini) ──
EMBEDDINGS_PROVIDER=gemini
# Never leave this as "mock" outside a sandbox — recall silently becomes
# hash-based instead of semantic, and nothing reports an error.

# ── Live web (research Tier 2 + the web tool) ──
TAVILY_API_KEY=           # optional; without it, research falls back to Gemini
                          # grounding, and says so rather than pretending

# ── Phone bridge ──
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=your-numeric-id

# ── Macro data (optional) ──
FRED_API_KEY=

# ── Files ──
VAULT_DIR=/Volumes/aurelius-vault          # Obsidian vault mirror (NAS)
INGEST_WATCH_DIR=/Volumes/aurelius-vault/_inbox   # drop PDFs here → corpus
AURELIUS_BACKUP_DIR=/Volumes/aurelius-backups     # nightly dumps land here
# AURELIUS_BACKUP_KEEP=14                  # retention, in dumps

# ── The clock (every ritual hangs off this) ──
# Without it the 07:00 briefing fires on the container's UTC clock. macOS will
# usually give the process the right zone anyway, but set it explicitly — the
# doctor cross-checks this against the zone the process is ACTUALLY running in.
AURELIUS_TZ=America/Phoenix

# ── The lock ──
# With this set, every /api route demands an x-aurelius-key header. On a box
# that Tailscale makes reachable from your phone, this is not optional.
# Put the SAME value in the frontend's environment (see below).
AURELIUS_API_KEY=<generate one: openssl rand -hex 32>

# ── Google OAuth (from your Google Cloud project) ──
# The client must be a WEB application client — a Desktop client cannot
# register these redirect URIs.
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
# Loopback is CORRECT here and Google allows http on it. The OAuth browser is
# this same Mini, so the callback comes straight back. Register BOTH strings,
# character for character, in the Console's "Authorized redirect URIs".
GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar/callback
GOOGLE_GMAIL_REDIRECT_URI=http://localhost:3001/api/gmail/callback
```

The frontend needs two of these too. Create `frontend/.env.local`:

```bash
BACKEND_ORIGIN=http://127.0.0.1:3001
AURELIUS_API_KEY=<the same value as above>   # or every request gets a 401
```

Then set up the database and build the frontend:

```bash
npx prisma migrate deploy          # creates all tables
npx tsx prisma/seed.ts             # seeds starting knowledge (if present)

# Embed everything. PIN THE PROVIDER — if the .env is misread, an unpinned run
# writes mock hash vectors over real ones and recall degrades silently.
npx tsx scripts/backfillEmbeddings.ts --provider gemini

cd ../frontend && npm install && npx next build
```

**Verify before going further:**
```bash
cd ../aurelius
npx tsx scripts/smokeSuite.ts        # expect "285 passed, 0 failed" (or higher)
npx tsc -p tsconfig.json --noEmit    # expect silence
npx tsx scripts/doctor.ts            # live-probes every key and integration
```

The doctor is the one that matters. It doesn't ask whether a variable is *set*
— it makes the real call. A key that's set and rejected reports **BROKEN**, not
"configured", and every failure line carries its own fix. Expect Google to read
"never connected" until Part 5; everything else should be ✓ or "not configured"
by choice.

---

## PART 5 — Keep it alive forever (launchd) (~15 min)

Two small files make the backend + frontend restart on boot and if they ever
crash. Create `~/Library/LaunchAgents/com.aurelius.backend.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.aurelius.backend</string>
  <key>WorkingDirectory</key><string>/Users/cole/aurelius-legion/aurelius</string>
  <key>ProgramArguments</key>
    <array>
      <string>/opt/homebrew/bin/npx</string><string>tsx</string><string>index.ts</string>
    </array>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/Volumes/aurelius-backups/logs/backend.log</string>
  <key>StandardErrorPath</key><string>/Volumes/aurelius-backups/logs/backend.err</string>
</dict></plist>
```

And `~/Library/LaunchAgents/com.aurelius.frontend.plist` — same shape, but
`WorkingDirectory` = `.../frontend`, and `ProgramArguments` =
`npx next start -p 3000`. (Replace `cole` with your Mac username; confirm the npx
path with `which npx`.)

```bash
mkdir -p /Volumes/aurelius-backups/logs
launchctl load ~/Library/LaunchAgents/com.aurelius.backend.plist
launchctl load ~/Library/LaunchAgents/com.aurelius.frontend.plist
```

Both processes now start on boot and self-restart. All the scheduled rituals
(06:45 schedule-protection, 07:00 briefing, 21:30 debrief, etc.) live inside the
backend — nothing else to configure.

**Read the first ten lines of the log.** The backend prints one `[preflight]`
line per subsystem at boot — what it woke up with, before any traffic:

```bash
head -30 /Volumes/aurelius-backups/logs/backend.log
```

You want to see `llm: anthropic → ...`, `embeddings: gemini — semantic recall
live`, `api lock: armed`, `timezone: America/Phoenix`. Anything reading
`DEFAULT TIER IS DOWN`, `DISABLED`, or `OPEN` is telling you a variable didn't
land — fix it before going further, because none of those throw an error later.

**Then connect Google, once:** open `http://localhost:3001/api/calendar/auth` and
`http://localhost:3001/api/gmail/auth` in the Mini's browser, approve each. These
two routes are exempt from the API lock, so a plain browser tap works.

> **Publish the consent screen first** (Part 1, step 2). While it's in Testing,
> Google expires every refresh token after 7 days — so a connection made today
> dies next week and reads like "Google broke". Re-connecting without publishing
> buys another 7 days and nothing more.

Re-run `npx tsx scripts/doctor.ts` after connecting. Calendar and gmail should
both read "live — refresh token works".

---

## PART 6 — Reach it from your phone (~10 min)

1. Install **Tailscale** on the Mini (`brew install --cask tailscale`, sign in)
   and on your phone. Now the Mini has a private address reachable anywhere.
2. On your phone's browser, open `http://<mini-name>:3000` → **Add to Home
   Screen**. That's the full-screen Aurelius app (PWA).
3. (Optional) Point **Obsidian** (phone + desktop) at the `aurelius-vault` share
   for your second-brain notes.

---

## PART 7 — Backups (set once, forget) (~10 min)

**There is nothing to schedule.** The backend already runs a nightly `pg_dump`
at 02:00 as part of the ritual spine, prunes to `AURELIUS_BACKUP_KEEP` dumps,
and warns loudly at boot when the newest one is stale. Setting
`AURELIUS_BACKUP_DIR=/Volumes/aurelius-backups` in Part 4 is the entire
configuration — that one variable turns the built-in job into the NAS backup.

> **Do not add a second launchd `pg_dump`.** An earlier version of this runbook
> did, and it was worse than redundant: it wrote `.sql.gz` files while the
> built-in job writes `.dump` (custom format), on a different schedule with a
> different retention. The doctor only counts `.dump` files, so it would have
> reported **"backups EMPTY — no dump has ever landed"** while gzips quietly
> piled up next to it. One job, one format.

Confirm it after the first night:

```bash
ls -lh /Volumes/aurelius-backups/          # expect aurelius-<timestamp>.dump
cd ~/aurelius-legion/aurelius && npx tsx scripts/doctor.ts | grep backups
```

The doctor doesn't trust the variable — it creates the directory, writes and
deletes a probe file, and reads the age of the newest dump. Anything over 48h
old is a failure, not a warning.

Add the NAS's own snapshot/backup schedule for the vault folder in the UGREEN UI.
**Once a month, restore-test a dump into a scratch DB** — a backup you've never
restored is a hope, not a backup:

```bash
createdb aurelius_restore_test
pg_restore --no-owner --no-privileges -d aurelius_restore_test /Volumes/aurelius-backups/aurelius-<newest>.dump
psql aurelius_restore_test -c 'select count(*) from "Memory";'
dropdb aurelius_restore_test
```

---

## PART 8 — GO LIVE: the 7-day soak (the whole point)

This is the test the council said makes Aurelius *real* — the moment it stops
being a repo and becomes an operator.

1. **Send Aurelius a chat message** (Telegram `/ask` or the web UI). Confirm the
   `[AURELIUS][LLM]` log shows a real `tokensUsed` number → the brain is lit.
2. **Grant the first keyhole:** Telegram `/grant calendar.schedule_protection`.
3. **Walk away for 7 days.** Each morning check:
   - A **briefing hits your phone** ~07:00, in voice, citing your real day.
   - Schedule-protection either **placed a deep-work hold** (granted) or proposed
     one you can **Confirm & do it** on the Bridge.
   - At night, the **debrief** names what you actually did vs. planned.
4. **Force one reboot** during the week (unplug/replug). Confirm nothing is lost —
   memory, tasks, grants all survive.

**You pass when:** it ran untouched for 7 days, the briefings kept landing, the
holds were ones you *kept* rather than deleted, and the reboot lost nothing. That
single week validates "runs for days," "briefing on its own," and "finalizes
inward" all at once. Only after that pass do we light a second grant or an outward
engine.

---

## PART 9 — Local-stack upgrades (optional, add after the soak)

In rough priority. None are needed to go live.

1. **Ollama** (`brew install ollama`) — local embeddings at $0 and a local fast
   tier. **The adapter is not built yet** (`retrieval/embeddingAdapter.ts` has
   the slot, not the code) — setting `EMBEDDINGS_PROVIDER=ollama` today disables
   embeddings entirely, and preflight will say so at boot. When the adapter
   lands, the swap also needs a full re-embed with the provider pinned, because
   dimensions change:
   ```bash
   npx tsx scripts/backfillEmbeddings.ts --force --provider ollama
   ```
   `--force` re-embeds rows that already have vectors; without it the old
   Gemini vectors survive and the index silently mixes two geometries.
2. **Paperless-ngx** (Docker) — scan/drop PDFs, get OCR'd tagged text; a ~40-line
   poller feeds them into the corpus. Great for documents/receipts/contracts.
3. **whisper.cpp** — local transcription of voice notes + athlete film → corpus.
4. **Hammerspoon** — macOS "hands," GATED behind the grant system (an allowlisted
   script set you approve). This is where Aurelius can eventually *do* things on
   the Mac itself — but only classes you grant.
5. **Restic** — upgrade Part 7's plain gzip dumps to encrypted, deduplicated
   snapshots on the NAS.

### Media & connectors roadmap (tracked, not yet built)
- **Multimodal chat — DONE (v1).** Attach a photo/short video in the web chat or
  Telegram; Aurelius sees it, talks about it, and remembers it (needs
  `GEMINI_API_KEY`). Athletic movement reported as signals only.
- **Full video / athlete-film pipeline — Mini phase.** Long clips + frame-precise
  technique breakdown: local whisper (audio→transcript) + frame extraction
  (ffmpeg) + Gemini video. Big files live on the NAS, not cloud upload. Pairs with
  Immich when the athlete-video library grows.
- **Instagram — future, two directions:**
  - *Inward (read):* pull Cole's posts / saved / insights into the corpus — an
    inward integration, safe.
  - *Outward (publish):* Aurelius drafts a post → Bridge → **Cole confirms →
    publishes**. An outward action behind the grant gate (a `content.publish`
    class); never posts on its own. Needs a Meta Business/Creator account + Graph
    API app review. Build with the Business Engine, on Cole's real accounts.
  - *Media hosting — this is the Mini's job.* Instagram fetches the image from
    a **public URL** and cannot accept an upload, so publishing is unreachable
    without somewhere to serve files from. `aurelius/media/host.ts` writes to
    `MEDIA_DIR` (default `vault/public-media`) and Express serves it at
    `/media`. Set **`MEDIA_PUBLIC_BASE_URL`** to the origin the Mini answers on
    (e.g. `https://aurelius.yourdomain.com`) and publishing lights up; leave it
    unset and the doctor honestly reports Instagram as `config`, not `live`.
    Two things to know: that directory is deliberately **unauthenticated**
    (Meta must fetch it anonymously, so it sits outside the API lock — put
    nothing there but media meant to be published), and a `localhost` or
    `192.168.x` base URL is **refused** rather than handed to Meta, because
    the Graph error for an unreachable image is opaque enough to cost an hour.

Rejected (so we stop relitigating): n8n/Huginn (Aurelius *is* the workflow/trigger
engine), MinIO (Postgres + NAS filesystem suffice), Logseq (the vault is
Obsidian-format). Parked: Immich (revisit with the athlete-video pipeline).

---

## PART 10 — Migrating an existing Railway deploy to the Mini

If Aurelius has already been running on Railway, you are not starting fresh —
there's a database with real memory in it. Four things move; nothing else does.

**The code is host-agnostic.** There are exactly two places that mention Railway
(`core/doctor.ts` reads `RAILWAY_PUBLIC_DOMAIN` as a fallback, and the frontend
reads `RAILWAY_ENVIRONMENT` to pick an error hint), and both fall back cleanly
when absent. There is no port of the application to do — only data and config.

**1. The database (the only irreplaceable part).** Dump from Neon, restore
locally:

```bash
pg_dump --no-owner --no-privileges -Fc "<neon DATABASE_URL>" -f ~/aurelius-migrate.dump
createdb aurelius
psql aurelius -c 'CREATE EXTENSION IF NOT EXISTS vector;'   # BEFORE the restore
pg_restore --no-owner --no-privileges -d aurelius ~/aurelius-migrate.dump
psql aurelius -c 'select count(*) from "VectorEmbedding";'  # sanity-check
```

Create the `vector` extension *first* — the restore replays column types that
depend on it, and without it every vector column fails while the rest succeeds,
leaving a database that looks restored and has no memory.

Then run `npx prisma migrate deploy` to catch any migrations newer than the dump.

**2. Google, which must be re-done — this is the real friction.** Refresh tokens
are bound to both the client *and* the redirect URI. Changing the domain from
`https://<something>.up.railway.app` to `http://localhost:3001` invalidates
both stored tokens, and there is no way around it:

- Add `http://localhost:3001/api/calendar/callback` and
  `http://localhost:3001/api/gmail/callback` to the **same** Web OAuth client
  (keep the Railway URIs too if you want to run both for a while — a client can
  hold many).
- Set `GOOGLE_REDIRECT_URI` / `GOOGLE_GMAIL_REDIRECT_URI` to the localhost pair.
- Re-connect both at `/api/calendar/auth` and `/api/gmail/auth`.

Budget ten minutes and expect the doctor to read "token REJECTED" until you do.

**3. Environment variables.** Copy them out of the Railway service, then change
exactly these:

| Variable | Railway | Mini |
|---|---|---|
| `DATABASE_URL` | Neon connection string | `postgresql://localhost:5432/aurelius` |
| `AURELIUS_BACKUP_DIR` | `/data/backups` (volume) | `/Volumes/aurelius-backups` (NAS) |
| `GOOGLE_REDIRECT_URI` | `https://<domain>/api/calendar/callback` | `http://localhost:3001/api/calendar/callback` |
| `GOOGLE_GMAIL_REDIRECT_URI` | `https://<domain>/api/gmail/callback` | `http://localhost:3001/api/gmail/callback` |
| `BACKEND_ORIGIN` (frontend) | `http://<service>.railway.internal:3001` | `http://127.0.0.1:3001` |
| `VAULT_DIR` / `INGEST_WATCH_DIR` | unset (no filesystem) | the NAS mounts |

Everything else — every API key, `AURELIUS_API_KEY`, `AURELIUS_TZ`,
`EMBEDDINGS_PROVIDER`, `TELEGRAM_*` — copies across unchanged.

If you ever put the Mini behind a public hostname (Cloudflare Tunnel, a domain
pointed at Tailscale Funnel), set `AURELIUS_PUBLIC_URL` to that origin. The
doctor uses it to decide whether a loopback redirect URI is correct or broken,
and to print auth links you can actually tap from your phone. **Also set
`TRUST_PROXY` to the number of proxy hops in front** (a Cloudflare Tunnel is
`1`) so the public write surfaces (`/intake`, `/start`, `/standard`) rate-limit
per real visitor instead of bucketing every request under the tunnel's IP. Leave
it unset (`0`) while the Mini is reachable only over Tailscale with no proxy —
there the socket address is already the real client.

**4. Turn Railway off *after* the soak, not before.** Run both for a few days
with Railway's scheduled jobs stopped (or its service paused) so only one
Aurelius is sending briefings and polling Telegram — **two pollers on one bot
token cause 409 conflicts**, and the doctor will flag it. Keep Neon around as
the cold backup the topology already assumes.

---

## When something isn't working

One command, in this order:

```bash
cd ~/aurelius-legion/aurelius && npx tsx scripts/doctor.ts
```

Or from your phone: send `/doctor` to the Telegram bot. Or `GET
/api/health/doctor` with the `x-aurelius-key` header.

It live-probes every engine, key, and integration from inside the process and
prints a fix under each line. Three things worth knowing about how to read it:

- **"not configured" is a choice; ✗ is a fault.** A key that is set but rejected
  reads BROKEN, never "dormant".
- **The `failover` row is the one to fear.** If it shows a high substitution
  rate, some provider is dead and the router has been papering over it — the
  answers kept coming, they were just written by a different model.
- **A green tick is a real call**, not a set variable. Backups get a write
  probe, Google gets a token refresh, engines get a one-token ping.

If a degraded stretch already happened — a provider dead for days without you
noticing — `scripts/repairDegradedWindow.ts --since YYYY-MM-DD` reports what
that window wrote into durable state (reuse cache, curriculum cursor, shadow
verdicts), and `--apply` clears it. It's a dry run by default and touches only
derived state.

---

### Quick reference — the whole thing in order
Buy (Part 0) → 4 clicks now (Part 1) → Mini setup (Part 2) → NAS + drives
(Part 3) → install Aurelius (Part 4) → keep-alive (Part 5) → phone access
(Part 6) → backups (Part 7) → **grant one keyhole, soak 7 days (Part 8)** →
local upgrades later (Part 9). Coming from Railway instead of fresh? Read
**Part 10** first — you skip Part 4's seed/backfill and restore a dump instead.

Run `npx tsx scripts/doctor.ts` after Part 4, after Part 5, and once more after
the first night's backup. Three runs catch essentially everything.
