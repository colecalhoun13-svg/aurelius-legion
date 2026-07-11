# AURELIUS

An operator-class personal OS. One system that is three things at once, in one
voice: a Jarvis-level operator (natural-language missions, planned and executed
across engines, tools, memory, and a real calendar), a second brain (persistent,
provenance-tracked understanding that comes back at the right moment), and a
compounding intelligence (leans on the base LLM *less* over time as its own
knowledge and reasoning compile).

Built by Cole. Coaching-origin, whole-life scope, local-first and sovereign.

## The map

| Doc | What it is |
|---|---|
| [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md) | Where we're going and why — vision, DoD, architecture, honest current state. **This doc wins conflicts.** |
| [`docs/DEPLOY_MAC_MINI.md`](docs/DEPLOY_MAC_MINI.md) | The local-first deploy runbook (Mac Mini + UGREEN NAS + Tailscale, Neon as failover). |
| [`docs/AUDIT_2026-07-10.md`](docs/AUDIT_2026-07-10.md) | Line-by-line audit against the DoD, with the debt register. |

## Layout

```
aurelius/    Express + TypeScript backend — the brain
  llm/         6-provider router, operator-as-lens prompt assembly
  knowledge/   Living Knowledge: store, propose→confirm, freshness, corrections
  corpus/      Second-brain ingestion (four-write pipeline), Paperless + RSS bridges
  retrieval/   pgvector embeddings + semantic recall
  wiki/        Living synthesis pages, one per domain + five Living Documents
  missions/    Plan → execute → report autonomy loop
  rituals/     Morning briefing, nightly debrief, weekly planning
  autonomy/    Initiative pulse, weekend sweeps, reflection
  calendar/    Google Calendar OAuth + 15-min sync + availability
  planning/    Week analysis, overload detection (calendar-aware), goal decomposition
  tools/       Tool Engine: google_sheets, planning, google_calendar
  measurement/ Operator Score, weekly scoreboard, LLM-dependence rate
  telegram/    The phone bridge (push + commands)
  core/        Prisma/Postgres, engine registry, structured tracing
frontend/    Next.js 14 — Command Deck, Today, Bridge, Cockpit, Second Brain, Wiki
```

## Run it

```bash
# Postgres 16 + pgvector, then:
cd aurelius && npm install
cp .env.example .env   # fill in keys + DATABASE_URL (never commit .env)
npx prisma migrate deploy && npx tsx prisma/seed.ts
npx tsx index.ts       # backend :3001 — schedulers arm themselves

cd ../frontend && npm install
npx next dev           # :3000
```

Live-fire verification (real DB, real paths, self-cleaning):

```bash
cd aurelius && npx tsx scripts/smokeSuite.ts   # 21 checks
```

## Operating principles

- **Propose, never impose.** Nothing enters Living Knowledge without Cole's
  confirmation (or his explicit correction). Signals only — Cole owns decisions.
- **Honest failure.** No key, no token, no engine → say so loudly, once. Error
  text is never filed as content.
- **Dormant until configured.** Telegram, Paperless, RSS, Calendar all boot
  dormant and wake the moment their config lands. No crashes, no spam.
- **Everything visible.** Every scheduled run, request, model call, and mission
  step leaves a trace row; the cockpit reads reality, not mock arrays.
- **One voice.** No personality modes — one voice that calibrates from what it
  learns about Cole.
