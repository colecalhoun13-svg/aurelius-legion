# AURELIUS — working rules

`docs/NORTH_STAR.md` is the map (vision, DoD, architecture, current state) and
wins all conflicts. This file is the how: hard rules and hard-won gotchas for
anyone (human or agent) working in this repo.

## Hard rules

1. **Act inward, gate outward, never self-escalate.** (Hybrid Autonomy —
   NORTH_STAR §2.5.) Aurelius *finalizes* inward work (schedule, organize,
   draft, ingest) inside a Cole-granted intent-class — reversible, traced,
   landing on the Bridge as an executed proposal. Every **outward** action
   (publish/send/spend) stops for Cole's confirm — non-grantable by
   construction. Living Knowledge writes still go through propose→confirm
   (`knowledge/proposals.ts`) or explicit Cole action (corrections).
   **Autonomy never escalates its own autonomy** (scope `autonomy` never
   auto-applies; the grant switch is only ever Cole's hand).
2. **One voice.** No personality modes. The voice calibrates from learned
   `persona.*` entries (Layer 1.5) and never announces a shift.
3. **Honest failure.** Missing key/token/engine → fail loudly, once, with the
   fix. Never file error text as content (guard regex:
   `/engine is not configured|Missing .*_API_KEY/i`).
4. **Dormant until configured.** Integrations (Telegram, Paperless, RSS,
   Calendar) boot dormant, log one line, and wake when config lands.
5. **Signals only in training/health domains** — Cole owns decisions.
6. **Never commit secrets.** `.env` is gitignored; a leaked token fragment is
   a burned token. Credentials are never embedded into the vector index
   (write them with raw prisma, not `setKnowledge`).
7. **Verify live.** Every block ships with live-fire verification:
   `npx tsx scripts/smokeSuite.ts` (self-cleaning, real Postgres) plus
   `tsc --noEmit` both sides and a prod `next build`.

## Gotchas (each of these has bitten us)

- **Prisma migration diff always emits** `DROP INDEX
  "VectorEmbedding_embedding_hnsw_idx"` — excise the DropIndex block from
  every new migration before deploying.
  Workflow: `npx prisma migrate diff --from-migrations prisma/migrations
  --to-schema-datamodel prisma/schema.prisma --shadow-database-url
  postgresql://aurelius:aurelius@127.0.0.1:5432/shadow_diff --script`.
- **Express matches routes in order** — static routes (`/freshness`,
  `/initiative/run`, `/vault/rebuild`) must register BEFORE `/:param` routes.
- **Codespaces secrets override `.env`** (dotenv never overwrites existing
  env). A changed secret requires a full codespace stop/restart, and both
  user-level and repo-level secret locations exist.
- **Prisma can't upsert a compound unique with a NULL member** — find-then-write
  (see `measurement/scoreboard.ts`).
- **CompiledPattern statuses** are `auto_factual | proposed_heuristic |
  confirmed_heuristic | discarded` — nothing else exists.
- `llmDependenceRate` in snapshots is an **integer percent**, not a fraction.
- Local sandbox DB: `postgresql://aurelius:aurelius@127.0.0.1:5432/aurelius`
  with `EMBEDDINGS_PROVIDER=mock`; Postgres dies on container restarts
  (`sudo service postgresql start`).

## Prompt assembly (llm/router.ts::buildSystemPrompt)

Layer order: 1 persona · 1.5 operator state (score + learned calibration) ·
2 identity · 3–4 operators · 5 memory · 5.5 semantic recall · 5.75 corpus+wiki
awareness · 6 tool catalog · 7 task · 7.5 pending proposals.

## Scheduled spine (all traced via core/trace.ts)

06:00 RSS · 06:30 market pulse · 06:45 schedule-protection (acts if granted,
else proposes) · 07:00 morning briefing · 08:00 initiative ·
13:00 midday check (silent when on pace) · 21:30 debrief · Sun 09:00 weekend
sweep → wiki · Sun 17:00 persona observer · Sun 18:00 weekly planning ·
Sun 19:00 freshness sweep ·
Sun 20:00 scoreboard · Sun 22:00 curriculum ingest (auto-learn each field's canon) ·
every 15 min calendar sync · every 10 min Paperless.

## Parked (do not build speculatively)

Business Engine buildout (Offer/LeadGen/Content/SOP/Workflow/Client/
Analytics/Brand) — needs Cole's real business data, marked in NORTH_STAR.
