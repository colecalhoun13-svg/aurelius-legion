# THE CARTOGRAPHER'S MAP — Promise vs Reality (2026-08-11)

Verification base: docs listed in the brief; cron spine at `aurelius/index.ts:1675-1893`; routes at `index.ts:194-365`; 15 tool adapters in `aurelius/tools/adapters/`; frontend doors in `frontend/app/(chrome)/` + public `standard/`, `start/`, `unlock/`. I cannot see Cole's production env — key-dependent statuses are derived from `integrationStatus.ts` ladder logic, not a live probe.

## 1. THE LEDGER

**LIVE (keyless or code-complete, invoker verified)**
- Full scheduled spine: 24 cron jobs (`index.ts:1675-1893`) incl. queue sweep, curriculum, decision curriculum — matches CLAUDE.md except three jobs CLAUDE.md omits (see DRIFTED).
- Autonomy grants + executor + keyhole + undo/trust ledger (NORTH_STAR:563-599; `autonomy/` module present; `queue_sweep` at `index.ts:1844`).
- Demand/CRM rails, all reachable: public `/intake` (`index.ts:231`), ref-links `/l/:code` (:256), Stripe webhook (:286), Twilio webhook (:306), IG webhooks (:330,342); public `/standard` + `/start` pages exist (`frontend/app/standard`, `/start`) — bands are **provisional defaults** awaiting Cole (`assessment/benchmarks.ts:14-16,66`).
- Lead-reply attribution actually closes now: `autonomy/workflows/inboxTriage.ts:34-72` flips Lead→replied and increments the angle.
- Chat-side compile loop (`compiled/chatCompiler.ts`) — pattern mining beyond the training room.
- Keyless research APIs (`integrationStatus.ts:126-130`); reachabilityAudit inside smoke (`smokeSuite.ts:1324`).

**DORMANT (built; the one unblock, per `integrationStatus.ts`)**
- Telegram — `TELEGRAM_BOT_TOKEN`+chat id (:115) · Voice — `GROQ_API_KEY` (:122) · FRED — free key (:207) · Ingest folder — `INGEST_WATCH_DIR` (:214) · RSS — name feeds in `research.rss_feeds` (:235) · Calendar/Sheets/Gmail — one OAuth click each, with 7-day token death until consent screen published (:107,:146,:175; NORTH_STAR:520-529) · **IG publishing — `MEDIA_PUBLIC_BASE_URL`** even when connected (:243-252; `media/host.ts:71,122`) · Semantic memory — real embeddings key + backfill (:186-193; the "fuel, not features" verdict, NORTH_STAR:625-627) · Stripe/Twilio — secret / 10DLC (MASTER_BUILD 5.1-5.2) · Paperless — Mini (:226).

**PROMISED-NOT-BUILT**
- **MCP socket** — spec frozen, "Not built" (`MCP_SPEC.md:4`), and bound to the Mini deploy's DoD (:5-8). Verified absent: no `tools/adapters/mcp.ts`, no `scripts/mockMcpServer.ts`.
- **Ollama adapter** — slot-comment only (`retrieval/embeddingAdapter.ts:189`); setting it today disables embeddings (DEPLOY_MAC_MINI Part 9.1).
- Plaid/SimpleFIN, Hammerspoon, Sentry, MinIO, Canvas — `planned` rows in `integrationStatus.ts:196-295`; only file mentioning them.
- **Reels/video publish** — NORTH_STAR:752-753 admits unwritten; `outward/instagram.ts` greps clean of any video path.
- Delivery platform (athlete portal) — gated on `delivery_scope` in `business/profile.ts`; no code.
- Wealth ledger — Vision §2.2/§3.4/§7.5 taxonomies (accounts, categories, recurring) absent; `wealth/` is FRED + engine only.
- Tier-9/10 deferred list: pass-2 unification, experiment framework, drift canary, reliability metric, etc. (ROADMAP_8_9_10:257-270).
- "Runs for days" — DoD line (NORTH_STAR:57-58) unproven; no soak evidence exists in-repo. Unverifiable here whether Railway is live.

**DRIFTED (doc ↔ code disagree)**
- **NORTH_STAR body vs its own appendix**: §4 "nothing today finalizes; everything defaults to propose" (:225-226) and "initiative pulse… never runs them" (:206) are inverted by the 2026-07-15+ state updates (:563-634). The map's canonical top half describes a system three eras old.
- **CLAUDE.md spine omits three live jobs**: `marketing_pass` Sun 16:00 (`index.ts:1731`), `content_outcome` 09:00 (:1741), `retention_sweep` 08:30 (:1760).
- **Vision §2.3 "reduces LLM calls"** vs code: `compiled/reasoningHelper.ts:66,153` hardcodes `llmCallsAvoided: 0`; `canShortCircuit()` has zero production callers (only `smokeSuite.ts:2827`). Compiled understanding decorates prompts; it has never skipped one. (Correctness coupling *did* ship — `measurement/scoreboard.ts:70-133` — so the metric is de-gamed, but it cannot structurally fall.)
- **Vision §3.1** ("build and refine training blocks") vs hard rule 5 / NORTH_STAR:119-120 signals-only, non-grantable by construction.
- **Vision §6 connector list** (HubSpot/Streak CRM, Zotero, NotebookLM) vs code: native `crm/` replaced the CRM; Zotero/NotebookLM absent, served by native research adapters.
- **ROADMAP_TO_NINE §0 audit vs current code**: its headline findings ("lead stays `contacted` forever"; "write side only fired in the training room") are now false — fixed by MASTER_BUILD Waves 1.3 and 0.7 (`inboxTriage.ts:41`, `chatCompiler.ts`). DB-row claims (CompiledPattern = 0) are unverifiable from repo.
- **Gym boundary**: CLAUDE.md says exclusion is "in the query"; MASTER_BUILD:13-19 concedes there is no mechanical gym-athlete rejection at intake. Both true, but the two docs read differently — worth one reconciling sentence.

## 2. Five biggest gaps vs "second operator," ranked

1. **Starved, not stupid** — mock embeddings, ungranted keyholes, empty CRM, no athlete sheet (NORTH_STAR:625-634). The learning stack exists; its fuel doesn't. Everything downstream (recall, reuse, patterns, trust flywheel) idles.
2. **Compilation never closes the loop** — the "leans on the LLM less" pillar (NORTH_STAR:37-39) is decorative: no production short-circuit path (evidence above). This is the vision's core compounding claim.
3. **Always-on unproven** — half the DoD ("runs for days," briefings arriving on their own) is untestable until a deploy soaks; every dormant integration also waits behind it.
4. **Thin outward hands** — one outward engine (IG **images** only), itself dormant on `MEDIA_PUBLIC_BASE_URL`; no reels, no MCP/browser/macOS hands. "Acts on your behalf via integrations" (Vision §1) currently means drafts-into-Gmail.
5. **Wealth operator is macro-only** — FRED rates, no personal/business ledger (Plaid planned-not-built), so the "explicitly money-focused" reasoning has attribution rails but no money-in/money-out substrate.

## 3. Retire or rewrite

- **NORTH_STAR §4/§6 body** — rewrite; the append-only log has inverted the canonical text of the doc that "wins all conflicts."
- **ROADMAP_TO_NINE §0** — stamp superseded-by-MASTER_BUILD; its code findings are part-fixed and now mislead.
- **ROADMAP_8_9_10 + ROADMAP_DEMAND_ENGINE execution sections** — collapse to "shipped, see MASTER_BUILD"; keep Deferred/Rejected.
- **CLAUDE.md spine list** — add the three missing jobs.
- **MCP_SPEC** — fine as spec, but it binds the Mini deploy's DoD; either honor or formally re-vote.
- **AURELIUS_3.4_VISION §3.1, §6** — Cole-owned, not editable; log as standing findings (training-blocks conflict; connector list superseded by native builds).
