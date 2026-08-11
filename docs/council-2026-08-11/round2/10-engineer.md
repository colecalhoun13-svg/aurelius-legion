All findings verified against the code. Every load-bearing claim holds. Here is my round-2 ruling.

---

# THE ENGINEER — ROUND 2: The Reliability Defect Ledger, the Jarvis Floor, the Mini Gate

The sweeps confirmed my round-1 spine findings to the line. I've re-verified each against source. The picture is sharper than round 1: this repo does not have a bug problem, it has a **single-source-of-truth problem that manufactures bugs**. Name that once, then rank what it spawns.

## THE META-DEFECT: non-exclusive sources of truth

A fact that should live in one place lives in three-to-sixteen, and they drift. Every sweep hit an instance. Enumerated:

- **Job roster — 3 copies.** `scheduleNamed` in index.ts, `ONCE_PER_DAY` (schedule.ts:47-53), catchUp's `JOBS` (catchUp.ts:25-166). Drift confirmed: `retention_sweep`, `content_outcome`, `training_trend_sweep` are in ONCE_PER_DAY but **absent from catchUp JOBS** — and CatchUpJob has no Monday concept to even express the trend sweep.
- **`AWAITING_DECISION` — 1 export, ≥8 inline `["pending","surfaced"]` copies** (productivity/service.ts, executor.ts, rituals/engine.ts, frontend badges/scoreboard).
- **`surfaceSignal` — "the one place" + 16 direct `bridgeSignal.create` callers.**
- **The kind-filter (gym boundary) — per-query vigilance, one miss found:** `ledger.ts:40-53` and `scoreboard.ts:81-83` aggregate Payments with no `kind:"client"` filter.
- **`dayRange` — reimplemented per module, all wrong the same way** (below).
- **Keyhole scope blocklist — 2 copies** (proposals.ts:167, queueSweep.ts:52), both omit `system`.

The fix is structural, not per-instance: derive the dependents from one manifest, and make `reachabilityAudit` enforce parity (it checks existence, never exclusivity — that's why every instance survived five councils).

## THE LEDGER (ranked by interest rate = always-on cost × how surely it fires)

| # | Defect | file:line | Always-on consequence | Fix |
|---|---|---|---|---|
| 1 | **Triple job list drift** | catchUp.ts:25-166 vs schedule.ts:52 | Mini asleep 08:30/09:00/Mon-06:50 → retention, content-outcome, training-trend **lost for the day/week, no trace**. The exact defect the file says it fixed for Sunday learners. | Derive JOBS from manifest + audit parity. 1 refactor. |
| 2 | **Agentic loop bypasses spend ledger** | index.ts:1177 `routeLLM` direct; recording lives only in runLLM.ts:22 (routeLLM→adapter.run at router.ts:625, never through runLLM) | Every tool-synthesis round (full prompt + 7KB results, ≤3/turn) is invisible to `llm_call`, failover doctor, scoreboard, **budget alarm — which undercounts exactly the priciest turns**. | Route synth through runLLM, or lift telemetry into routeLLM. Add smoke assertion: no `routeLLM` callsite outside runLLM. ½ day. |
| 3 | **Delivery-blind success** | trace pings Healthchecks on trace-ok (trace.ts:130), sendToCole never throws (bot.ts:210-227) | Telegram outage → trace `ok`, JobRun `done`, dead-man **green** — the monitor certifies a briefing Cole never got. First silent week ends the "second operator" claim. | Make send failure a job failure w/ retry; ping only after confirmed delivery. ~1 day. |
| 4 | **Claim fallback re-opens double-fire** | schedule.ts:85 returns true on non-P2002 (verified) | A DB flap across a cron minute + catch-up double-sends the briefing — the window claims exist to close. | Cap: fail-closed for briefing/debrief (user-visible sends); availability-wins only for idempotent sweeps. Small. |
| 5 | **UTC day-window skew** | nowContext.ts:59, productivity/service.ts:20, planning/tools.ts:78, promises.ts:97 | Under America/* TZ, **evening events (17:00+) vanish from Today/briefing/session-prep** — fatal for a coach whose sessions are evenings; done-counts and streak sentinel skew. Hits Cole daily. | One TZ-correct `dayRange` in core/time.ts, four callers adopt it. Fixes 5 skews. |
| 6 | **Secrets in inputData memory + console** | toolEngine.ts:155 (embedded into vector index), index.ts:448 (console) | Any credential Cole pastes as a tool arg becomes a durable, recalled, **embedded** memory — brushes hard rule 6. | Redact/omit inputData for sensitive tools; drop the console payload. Small. |
| 7 | **Dead v3.4 architecture still mounted** | autonomyRouter at index.ts:211 → engineRouter `routeTask`; engineTest at :206 | `POST /api/autonomy/tick` is a live reasoning door with **no persona, memory, patterns, tracing, or gate** — an unlocked side entrance around the whole safety assembly. Returns 200 "Engine 'autonomy' not found". | Delete ~600 lines + unmount 2 routers. Low interest, high blast radius if ever wired. |
| 8 | **Prod-unsafe smoke cleanup** | smokeSuite.ts:1914,1997 `deleteMany({sourceType:["inbound_lead","outreach_draft","lead_reply"]})` | Sandbox-only contract stated once, deep in the file. One wrong `DATABASE_URL` during "verify live" **destroys real Bridge/lead rows.** | TAG-scope every delete or assert sandbox DSN at suite entry. Small. |
| 9 | **Unbounded LogEntry/ConversationTurn + intakeHits map** | schema.prisma:124; index.ts:230 | Slow interest, certain principal: forever-growth on a btree'd 1000-char column; IP-rotating bot grows process memory. | Retention `deleteMany` on a schedule + LRU-evict the map. Small. |

Defects 1-6 are the always-on core. 7-9 are latent but cheap.

## THE JARVIS BILL — re-ordered: the minimal reliability floor

The Jarvis promise is *"can be heard when it fails."* Everything below must exist **before always-on deploy, before voice, before any new grant.** In strict order:

1. **Delivery-verified notification path** (Ledger #3 + #4). An operator you can't hear isn't one. Send failure = job failure + retry; Healthchecks pings on confirmed delivery only; briefing/debrief claims fail-closed.
2. **Cost is fully metered** (Ledger #2). The budget alarm cannot guard autonomy while blind to the turns autonomy spends most on. This gates grants specifically — you don't widen autonomy over an undercounting meter.
3. **Downtime recovery is complete** (Ledger #1). "The spine survives naps" is the product thesis; three jobs currently don't. Manifest + parity audit.
4. **The daily artifact is true** (Ledger #5). The briefing is the most-read surface; a TZ skew that hides evening sessions teaches Cole to distrust it in a week.
5. **Watchdog-of-the-watchdog.** External synthetic probe: scheduled `/health` curl + a scheduled `/doctor` run posted where Cole reads. Dead-man proves process-alive; briefing-ping proves spine-ran; **neither proves correct.** Nothing schedules the doctor today.

Voice (local STT, streamed router — it doesn't stream today, Haiku fast-lane, warm cache) is **item 6+**, and only after 1-5. The bones for latency exist (CACHE_BREAK, tiering); the bones for *being heard when it fails* do not.

## THE MINI-READINESS GATE (the synthesis's deploy gate)

Railway→Mac Mini does not proceed until every box is checked:

- [ ] **Ledger 1-4 shipped** (recovery complete, cost metered, delivery-verified, no double-fire). These are deploy blockers, not nice-to-haves.
- [ ] **SMB mount is not on the critical path.** launchd starts before Finder-login mounts; today `backend.log` + backups point at `/Volumes/*NAS*` — a dropped mount kills logging and backups together. Logs → local SSD; backups → local first, NAS as *copy*; mount-drop marker already exists (backup.ts:48) — verify it fires.
- [ ] **Backups: no plaintext secrets at rest, offsite exists, restore is tested.** The pg_dump holds every OAuth refresh token and credential row in plaintext on an SMB share (hard rule 6 stops at the vector index — the dump escapes it). Encrypt the dump; add one offsite copy (NAS RAID1 is one fire from zero); automate a monthly restore test (DEPLOY doc delegates it to Cole's memory). Also: DATABASE_URL passes as a `pg_dump` CLI arg (backup.ts:52) — visible in `ps` on a shared box.
- [ ] **Doctor fix-strings localized.** Non-backup rows still print "press Apply Changes in Railway" (doctor.ts:94,232); only `ephemeralHost()` localizes backups. Instant confusion on day one otherwise.
- [ ] **Watchdog blind-window vs macOS auto-update reconciled.** The 26h watchdog window (watchdog.ts:22) overlaps an update-reboot; defer OS updates, and a wedge inside the first boot-day is currently invisible.
- [ ] **Smoke suite refuses non-sandbox DSN** (Ledger #8). Assert the sandbox DSN at entry so "verify live" on the Mini can never delete production rows.
- [ ] **`.env` complete and the API lock proven on.** `.env.example` omits `AURELIUS_API_KEY` itself (the lock); `/intake` and `/l/:code` are unauthenticated writes — safe on Tailscale *only because* the key is mandatory. Preflight must confirm OPEN is not the boot state.
- [ ] **v3.4 side door removed** (Ledger #7) before the origin is Tailscale-exposed.

Verdict unchanged and now precise: **Mini-ready for the supervised soak; not yet trustable unattended.** The gap is exactly the five-item floor. Build 1-4, wire item 5, then run the 7-day soak — and only then does "second operator" stop being a claim and start being a property.
