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
   construction. Living Knowledge writes go through propose→confirm
   (`knowledge/proposals.ts`), explicit Cole action (corrections), or — for
   research/ingestion-born proposals only — the Cole-granted
   `knowledge.apply_proposal` keyhole (executor receipts + one-tap undo;
   chat/observer/freshness proposals keep the confirm loop, and the
   `autonomy` + `persona` scopes never auto-apply, granted or not).
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
8. **Built is not done — done is reachable.** The recurring defect in this
   repo is code that compiles, passes smoke, and that nothing can invoke:
   a publish path with no media host, a workflow with no schedule entry, a
   gap-finder behind a condition that can't fire, token counts with no
   reader, a money endpoint with no button. For every capability, name the
   invoker (schedule entry · mounted route · registered tool · a control in
   the UI) and its prerequisites, and make an unmet prerequisite report
   `config`, never `live`. `npx tsx scripts/reachabilityAudit.ts` enforces
   the mechanical half and runs inside the smoke suite.

## Gotchas (each of these has bitten us)

- **Prisma migration diff always emits** `DROP INDEX
  "VectorEmbedding_embedding_hnsw_idx"` — and, since the hot-table-indexes
  migration, `DROP INDEX "Memory_metadata_gin_idx"` (GIN is SQL-only too).
  Excise every such DropIndex block from new migrations before deploying.
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

Assembled in two halves for prompt caching (the Anthropic adapter marks
everything above `CACHE_BREAK` with cache_control): STATIC prefix — 1 persona ·
2 identity · 3–4 operators · 6 tool catalog (skipped when
`omitToolCatalog`) — then LIVE context — 1.5 operator state · 2.4 NOW
(clock/calendar/load/grants) · 5 memory · 5.25 recent conversation ·
5.4 compiled patterns (primary + secondary lenses, fired-rule audit) ·
5.45 field synthesis (the wiki page, injected directly) · 5.5 semantic
recall · 5.75 corpus awareness · 7 task · 7.5 pending proposals ·
decision-mode tail when Cole is making a real call. `noReuse` keeps
internal synthesis jobs out of the semantic reuse cache, both sides.

## Scheduled spine (all traced via core/trace.ts)

02:00 db backup · 05:30 inbox triage (drafts only — never sends; the 07:00
briefing names what's waiting) · 07:30 outreach sweep (drafts to leads whose
follow-up is due, bounded to 3/run — Gmail drafts only, never sends) · 06:00 RSS · 06:30 market pulse · 06:45 schedule-protection
(acts if granted, else proposes) · 07:00 morning briefing (carries the risk
line + checks last night's "tomorrow starts with") · 08:00 initiative ·
13:00 midday check (silent when on pace) · 21:15 queue sweep (keyhole
backlog applies under grant; proposals expire at 30d, stale notices at
14d; ignored missions archive at 14d and may re-propose) · 21:30 debrief
(tomorrow-watch + names tomorrow's opening move + streak sentinel) ·
Sun 09:00 weekend
sweep → wiki · Sun 17:00 persona observer · Sun 18:00 weekly planning ·
Sun 19:00 freshness sweep ·
Sun 19:30 capability gaps (repeated tool failures → one deduped fix signal) ·
Sun 20:00 scoreboard · Sun 21:00 decision curriculum (mine Cole's corrections →
heuristics; judge fired-and-corrected rules → gated retire proposals; trust
rises only on Cole's explicit ratification, never on silence) ·
Sun 22:00 curriculum ingest (2 units × 7 fields, ALTERNATING seed canon and
gap-discovered units — gap discovery fires from run one, not after the seed
list empties) ·
every 15 min calendar sync · every 10 min Paperless.

## Whose business this is (2026-08-05 — read before any business work)

Cole is **employed** by the gym. Those athletes are his employer's — never
propose an offer, price, campaign, or outreach aimed at them. Since 2026-08-08
they MAY sit on the roster as `Client.kind="training_only"` (one PR ledger for
everyone Cole coaches) — but business machinery excludes them **in the query**
(`kind: "client"`): no referral asks, no proof content, no check-in/renewal/SMS
drafts, no invoices/engagements, no analytics, no auto-attached money.
`promoteClient` is the only door to full client, and it is Cole's explicit
action. Any NEW business surface must filter `kind` the same way. The business
Aurelius exists to build is his **own remote/online coaching business**:
zero clients today, previously run on Google Sheets and text, sold in three
billing shapes at once (monthly · 8–12wk block · one-off program). Its
binding constraint is that **nothing arrives on its own** — no inbound, no
funnel, no referrals flowing. An empty CRM is not progress, and Aurelius
should say so rather than render encouraging zeroes.

Facts live in `business/profile.ts` and reconcile into Living Knowledge at
boot. Facts carry a `revision`: bump it when Cole *restates* something so
the correction actually reaches the database, and add to `RETIRED_FACTS`
when a fact stops being true at all. An entry Cole edited by hand (any
`sourceId` that isn't `profile:rev{N}`) is never overwritten.

## Parked (do not build speculatively)

Business Engine buildout (Offer/LeadGen/SOP/Workflow/Analytics/Brand) —
still needs Cole's real numbers (pricing, capacity, the standard), marked
in NORTH_STAR. Two deliberate exceptions have shipped:

- **The gated content lane** (NORTH_STAR §6 Block 7, "light ONE outward
  engine first") — `content.draft` (inward) → `content.publish` (outward,
  always Cole's confirm) + the Instagram engine. Publishing also needs
  `MEDIA_PUBLIC_BASE_URL`: Meta fetches images by URL and cannot accept an
  upload, so `media/host.ts` serves them (local disk on the Mini by
  default, provider-swappable). Without it the doctor reports Instagram as
  `config`, not `live`. The full Content Engine stays parked.
- **The Client Engine** (`crm/`) — Lead → Client → Engagement → Session →
  Invoice → Payment, because the remote business is the point and it had
  nowhere to record a client. Money is integer cents; Invoice (owed) and
  Payment (received) are separate; "overdue" is derived, never stored.
- **The Lead Engine** (`crm/leadEngine.ts`) — un-parked after the 2026-08-06
  council found step 1 of the funnel absent from the code: every caller of
  `addLead` was Cole typing, and `LEAD_SOURCES` offered values nothing could
  produce. Three doors: the WARM LIST (the only channel that works at zero
  audience), the public `/intake` endpoint (the one unauthenticated write —
  narrow, sanitised, rate-limited), and inbound capture. Drafting is
  `outreach.draft`, **inward** — it writes a Gmail draft and nothing else.
  Sending stays `outreach.send`, outward, non-grantable. The sweep is bounded
  to 3/run because the constraint is Cole's review capacity, not generation.
