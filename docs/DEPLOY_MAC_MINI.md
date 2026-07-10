# Deploy — Mac Mini + UGREEN NASync (local-first, NORTH_STAR §3)

The locked topology: **Mac Mini** runs the OS (backend, reasoning, rituals,
schedulers, frontend); **UGREEN NASync** holds Postgres data, backups, and the
vault; **Tailscale** makes it reachable anywhere; **Neon** stays as failover
only. This runbook is written to be executed top-to-bottom on a fresh Mini.

## 0. Prerequisites (one-time, Cole)
- Mac Mini on the same LAN as the UGREEN, both on Tailscale.
- UGREEN: create an SMB share `aurelius` (or NFS if preferred) and a
  scheduled-backup folder.
- LLM keys funded (`ANTHROPIC_API_KEY` at minimum; others per Engines page).

## 1. Mount the NAS on the Mini
```bash
# Finder → Cmd+K → smb://<ugreen-ip>/aurelius, check "remember"; or:
mkdir -p ~/nas-aurelius
mount_smbfs //cole@<ugreen-ip>/aurelius ~/nas-aurelius
```
Auto-remount: System Settings → General → Login Items → add the share.

## 2. Postgres + pgvector
Option A (recommended — data lives on the NAS via the Mini):
```bash
brew install postgresql@16 pgvector
# point the data dir at the NAS mount (or keep local + pg_dump to NAS nightly):
initdb -D ~/nas-aurelius/pgdata
pg_ctl -D ~/nas-aurelius/pgdata -l ~/nas-aurelius/pg.log start
createdb aurelius && psql aurelius -c 'CREATE EXTENSION vector;'
```
Option B: run Postgres in the UGREEN's container station and point
`DATABASE_URL` at it over the LAN. (Slightly slower vector ops; simpler HA.)

> NOTE: SMB-mounted pgdata can misbehave under lock contention. If Option A
> flakes, keep pgdata local on the Mini and rely on §5 backups to the NAS.

## 3. The app
```bash
git clone https://github.com/colecalhoun13-svg/aurelius-legion && cd aurelius-legion
cd aurelius && npm install
cp /path/to/.env .   # keys + DATABASE_URL=postgresql://cole@localhost:5432/aurelius
                     # + EMBEDDINGS_PROVIDER=gemini + VAULT_DIR=~/nas-aurelius/vault
                     # + TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID when ready
npx prisma migrate deploy && npx tsx prisma/seed.ts
npx tsx scripts/backfillEmbeddings.ts        # only on a fresh DB
cd ../frontend && npm install && npx next build
```

## 4. Keep it alive (launchd)
Two LaunchAgents (`~/Library/LaunchAgents/`): one for the backend
(`npx tsx aurelius/index.ts`, port 3001), one for the frontend
(`npx next start -p 3000`, cwd frontend, with DATABASE_URL in env). Use
`KeepAlive=true`, `RunAtLoad=true`, logs to `~/nas-aurelius/logs/`.
`launchctl load` both. The schedulers (rituals 07:00/21:30, initiative 08:00,
weekend sweep Sun 09:00, scoreboard Sun 20:00) live inside the backend
process — nothing else to configure.

## 5. Backups (UGREEN's job)
- Nightly `pg_dump aurelius | gzip > ~/nas-aurelius/backups/aurelius-$(date +%F).sql.gz`
  (launchd timer), keep 30 days.
- The vault (`VAULT_DIR`) is already on the NAS — include it in the UGREEN's
  own backup/snapshot schedule.
- Monthly: restore-test a dump into a scratch DB. A backup that's never been
  restored is a hope, not a backup.

## 6. Reach it anywhere
- Tailscale on the Mini → phone/laptop hit `http://<mini-tailname>:3000`.
- Install the PWA from that URL (Add to Home Screen) — full-screen Aurelius.
- Point Obsidian (desktop/mobile) at the NAS vault share for the second brain
  files.

## 7. Neon failover (kept warm, not primary)
- Keep the Neon `DATABASE_URL` in `.env.failover`.
- Weekly: replay latest dump to Neon (`psql $NEON_URL < dump.sql`) or accept
  RPO of "last dump."
- Cutover = swap DATABASE_URL, restart LaunchAgents. Cut back the same way.

## 8. Smoke test after cutover
```bash
curl localhost:3001/            # backend up
curl localhost:3000/api/deck    # frontend + DB
# Telegram: /status → numbers; /brief → briefing in voice
# UI: boot flash → deck; Second Brain ask returns cited answer
```

## 9. Local stack (reviewed from Copilot's list — install during deploy)
Accepted, in install order:
1. **Homebrew** — first command on the fresh Mini; everything below flows from it.
2. **Syncthing** (`brew install syncthing`) — sync VAULT_DIR + backups across
   Mini ↔ UGREEN ↔ laptop. Point it at the vault share.
3. **Paperless-ngx** (Docker on the Mini or UGREEN container station) — PDFs
   in, OCR'd tagged text out. Integration: a small poller hits Paperless's
   REST API for new documents → `ingestDocument` (four-write pipeline, wiki
   refresh included). Build the poller at deploy time (~40 lines).
4. **Hammerspoon** (`brew install --cask hammerspoon`) — macOS hands, GATED:
   Aurelius may only trigger an allowlisted script set Cole approves, wired
   as a Tool Engine adapter with the escalation matrix in front of it.
5. **Zotero** (optional) — if Cole uses it for reading, poll its local
   SQLite for new items → corpus.
6. **Ollama** (`brew install ollama`) — local embeddings (swap
   EMBEDDINGS_PROVIDER when ready; NORTH_STAR names this as the Gemini
   swap-in) and local inference for the fast tier. Sovereignty upgrade.
7. **whisper.cpp** (`brew install whisper-cpp`) — local audio/video
   transcription → corpus ingestion. Athlete film + voice notes.
8. **Docker Compose** — carries Paperless-ngx (and anything else
   containerized) on the Mini or the UGREEN's container station.
9. **Caddy** (`brew install caddy`) — reverse proxy with auto-HTTPS in
   front of the PWA on the tailnet.
10. **Restic** (`brew install restic`) — upgrade §5's plain pg_dump gzip
    to encrypted, deduplicated snapshots targeting the UGREEN repo
    (pg_dump | restic backup --stdin). Keep the monthly restore test.

Rejected (recorded so we stop relitigating): n8n/Huginn (Aurelius IS the
workflow+trigger engine — no second brainstem), MinIO (Postgres + NAS
filesystem suffice), Logseq (vault is Obsidian-format; one markdown brain).
Parked: Immich (revisit with the athlete-video pipeline). Already live:
Google Sheets, Postgres, Obsidian-via-vault.
