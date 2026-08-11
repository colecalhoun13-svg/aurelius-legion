No grants remain — sandbox clean. Here is the verification report.

---

# SECURITY REPRODUCTION — end-to-end verification

I traced all five findings through the working tree and ran a live PoC for the keyhole trio against the sandbox DB. One finding is now **proven with a receipt**, three are confirmed-but-conditional, none were refuted. Ranked by true exploitability today.

## 1. A1 / A2 / A3 — keyhole system-scope write + embed — **CONFIRMED (NEEDS-GRANT-FIRST), PoC-proven**

**Chain, every hop verified:** `researchEngine.ts:441` `extractDirectives(synthesisRawText)` → loops `parsed.knowledgeProposals`, passing `scope: d.scope` **verbatim** (`:454`) with `origin:"research"` (`:458`) into `createProposal`. `createProposal` validates only that `intentClassId` exists (`proposals.ts:89`) — it does **not** cross-check that scope matches the intent class, so `intentClassId:"rep_band_update"` + `scope:"system"` sails through. The keyhole guard at `:167` is `scope !== "autonomy" && scope !== "persona"` — **`"system"` is absent**. If `decideAction("knowledge.apply_proposal").finalize` is true, it calls `executeAction` → finalizer `registerActions.ts:100` → `resolveProposal(decision:"confirmed", updatedBy:"aurelius")`. `resolveProposal` (`proposals.ts:275`) re-checks **only** `status==="pending"` + the atomic claim — **no scope, no origin re-derivation**. It calls `setKnowledge` (`:302`) → `store.ts:219` `indexKnowledgeEntry` → `embedSourceSafe` with **no scope filter**.

**PoC output (sandbox, grant flipped on, then cleaned up):**
```
grant ok: knowledge.apply_proposal | decideAction.finalize = true
proposal.status after createProposal: confirmed
KnowledgeEntry scope=system written: true (updatedBy=aurelius, sourceType=research_ingestion)
VectorEmbedding for system-scope entry: true (domain=system)
acted BridgeSignal receipt: true (title=Learned: system.poc_mirror_context_...)
```

This is the whole ledger's worst case, demonstrated: an LLM-chosen `scope:"system"` (e.g. the mirror's own `mirror_context` key) was auto-applied, **embedded into the vector index** (A3, the exact thing rule 6 and `mirror.ts:18` forbid), and stamped with a perfect receipt. The blocklists at `proposals.ts:167` and `queueSweep.ts:52` both omit `system`; the finalizer re-checks nothing (A1). **Precondition: `knowledge.apply_proposal` grant is live.** Contrarian's audit and my own query confirm **zero grants exist today** → latent, not live. Blast radius when granted: an injected research/corpus source overwrites operational cursors and un-learns Cole's corrections, silently, with receipts that look clean. **This is the single most dangerous finding and it sits directly under the one grant Fuel Week proposes flipping.** The Steward's "hold `knowledge.apply_proposal` until gate zero" is correct and load-bearing.

## 2. C1 — undefused gmail into immediate-execution loop — **CONFIRMED reachable (persuasion channel; outward stays gated)**

`gmail.ts` has **no `defuseDirectives`** anywhere (grep-confirmed; `web.ts:92` and `googleSheets.ts:1138` both defuse). `read_message` returns `...m` — the full body raw (`:67`). That output is fed as prompt input into the bounded agentic loop (`index.ts:1164-1182`), with `nativeTools: !finalRound` — so rounds 1–2 permit tool calls. I verified the gate-exemption claim directly: **`googleCalendar.create_event`/`delete_event` call `createCalendarEvent`/`deleteCalendarEvent` inline in the adapter's `run()` with NO `executeAction`/`decideAction`** (`googleCalendar.ts:123,166`). Same for crm `import_warm_list` (`crm.ts:424`). Only `crm.draft_outreach` routes through the executor gate (`res.gated`, `:446`). So a persuaded native `delete_event` in round 2 executes immediately, ungated.

**Important nuance the reading slightly over-stated:** the loop parses directives from the **model's output** (`synth.text`), not from tool results. A literal `[TOOL: …]` string in an email body is *not* directly parsed — the vector is **persuasion** of a native/text tool-call, not directive injection. Defusing gmail would stop literal-directive mimicry but not persuasion (the Steward concedes this). **Blast radius: calendar mutation (guarded by mirror + title cross-check at `:147-165`, and Google-reversible) and crm lead writes. NOT send** — gmail OAuth is draft-only, sms/publish are outward-gated. Real, cheapest attacker channel, but bounded to reversible inward writes. CRITICAL-for-hygiene, not catastrophic.

## 3. A6 — default retry on non-idempotent adapters — **CONFIRMED**

`toolEngine.ts:22` `MAX_RETRIES=1`; `:74` `adapter.maxRetries ?? MAX_RETRIES`; `withTimeout` (`:28`) rejects **without cancelling** the in-flight promise (comment `:25` admits it). Grep confirms `maxRetries:0` on content/crm/gmail/googleCalendar/googleSheets/learning/productivity, and **absent from autonomy, business, corpus, planning** (also fred/googleAuth/self/web, but those are read-only). A slow `business.draft_offer`/`planning.plan_week` that trips 120s keeps running **and** retries → duplicate Bridge cards, doubled research spend. Mechanically certain. Severity MEDIUM (needs a genuinely slow call to trigger).

## 4. A4 — confirm route dormant-open — **CONFIRMED-but-config-dependent**

`middleware.ts:55`: `if (!secret) return NextResponse.next()`. `confirm/route.ts` has no auth of its own; it calls `confirmAction(signalId)`, which runs finalizers "regardless of grant state" — including `autonomy.apply_grant` stamping `grantedBy:"cole"` (`registerActions.ts:93`). **So when `APP_UNLOCK_SECRET` is unset AND the origin is network-exposed, `POST /api/autonomy/confirm` is unauthenticated.** Two real barriers reduce blast radius: (a) it needs a valid `signalId` — a **cuid**, not enumerable sequentially, and only a *pending/surfaced* signal with a `confirm_action` is confirmable (`executor.ts:262-269`); (b) `grantAutonomy` re-runs `checkGrantable` (`grants.ts:40`), so outward classes still can't be minted. Exploit requires attacker to *know* a pending confirm signal's id. Deployment condition is live (Engineer's Tailscale note: exposed origins exist). Genuine hole, gated by config + id-secrecy. HIGH-if-misconfigured.

## 5. C5 — images as instructions — **CONFIRMED reachable, but Cole-mediated**

`telegram/bot.ts:619` folds `analyzeMedia` transcription into `handleCommand` undefused (only when a caption is present, `:615`) → full tool pipeline incl. immediate-execution calendar. **But `handleCommand` only runs for `TELEGRAM_CHAT_ID`** (`:64-65`, exact-match lock) — so the attacker cannot send directly; **Cole must forward the hostile screenshot himself** with a caption. Same undefused fold at `index.ts:848-868` for web chat. Real command channel, but requires Cole-in-the-loop relaying attacker content. MEDIUM.

## Bottom line for Cole

- **Real-and-live today:** none are remotely exploitable at zero grants / secret-set / no exposed origin.
- **Latent-until-a-key (the one that matters):** A1/A2/A3 — proven to fire the instant `knowledge.apply_proposal` is granted. **Do not flip that grant until the three-line blocklist + finalizer guard + `indexKnowledgeEntry` scope-skip land.** My PoC is the receipt.
- **Config-dependent:** A4 (unset unlock secret + exposed origin + known signal id).
- **Hygiene / mechanical:** C1 (persuasion into reversible calendar/crm writes — outward stays safe), A6 (four adapters need `maxRetries:0`), C5 (Cole-mediated).
- **Reading slightly over-called:** C1's "directive in email body auto-parses" — the loop parses model output, not tool results; the true vector is persuasion, which adapter-defuse alone won't close.

Sandbox left clean (grant revoked, rows deleted). Throwaway PoC at `/tmp/claude-0/-home-user-aurelius-legion/fd34675c-9dae-55d6-b503-01612b486495/scratchpad/poc_a123.ts`. No source modified.
