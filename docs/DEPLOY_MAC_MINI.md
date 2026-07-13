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

# ── The brain (fund Anthropic at minimum) ──
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=            # optional
GROQ_API_KEY=             # optional (free tier — good for the fast lane + voice)
GEMINI_API_KEY=AIza...    # free — powers embeddings
DEEPSEEK_API_KEY=         # optional
XAI_API_KEY=              # optional

# ── Memory (real recall, free via Gemini) ──
EMBEDDINGS_PROVIDER=gemini

# ── Phone bridge ──
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=your-numeric-id

# ── Macro data (optional) ──
FRED_API_KEY=

# ── Vault on the NAS ──
VAULT_DIR=/Volumes/aurelius-vault

# ── Google OAuth (from your Google Cloud project) ──
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

Then set up the database and build the frontend:

```bash
npx prisma migrate deploy          # creates all tables
npx tsx prisma/seed.ts             # seeds starting knowledge (if present)
npx tsx scripts/backfillEmbeddings.ts   # embeds everything with Gemini (fresh DB)

cd ../frontend && npm install && npx next build
```

**Verify before going further:**
```bash
cd ../aurelius && npx tsx scripts/smokeSuite.ts   # expect "46 passed, 0 failed"
```

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

**Then connect Google, once:** open `http://localhost:3001/api/calendar/auth` and
`http://localhost:3001/api/gmail/auth` in the Mini's browser, approve each. (On the
Mini itself the `localhost` callback just works — no URL-swapping like Codespaces.)

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

Nightly database dump to the NAS. Create
`~/Library/LaunchAgents/com.aurelius.backup.plist` running this daily at 03:00:

```bash
/bin/sh -c 'pg_dump aurelius | gzip > /Volumes/aurelius-backups/aurelius-$(date +\%F).sql.gz && find /Volumes/aurelius-backups -name "aurelius-*.sql.gz" -mtime +30 -delete'
```

Add the NAS's own snapshot/backup schedule for the vault folder in the UGREEN UI.
**Once a month, restore-test a dump into a scratch DB** — a backup you've never
restored is a hope, not a backup.

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
   tier. Swap `EMBEDDINGS_PROVIDER=ollama` when ready (sovereignty upgrade; frees
   you from Gemini's free-tier limits). Re-run `backfillEmbeddings.ts` after the
   swap.
2. **Paperless-ngx** (Docker) — scan/drop PDFs, get OCR'd tagged text; a ~40-line
   poller feeds them into the corpus. Great for documents/receipts/contracts.
3. **whisper.cpp** — local transcription of voice notes + athlete film → corpus.
4. **Hammerspoon** — macOS "hands," GATED behind the grant system (an allowlisted
   script set you approve). This is where Aurelius can eventually *do* things on
   the Mac itself — but only classes you grant.
5. **Restic** — upgrade Part 7's plain gzip dumps to encrypted, deduplicated
   snapshots on the NAS.

Rejected (so we stop relitigating): n8n/Huginn (Aurelius *is* the workflow/trigger
engine), MinIO (Postgres + NAS filesystem suffice), Logseq (the vault is
Obsidian-format). Parked: Immich (revisit with the athlete-video pipeline).

---

### Quick reference — the whole thing in order
Buy (Part 0) → 4 clicks now (Part 1) → Mini setup (Part 2) → NAS + drives
(Part 3) → install Aurelius (Part 4) → keep-alive (Part 5) → phone access
(Part 6) → backups (Part 7) → **grant one keyhole, soak 7 days (Part 8)** →
local upgrades later (Part 9).
