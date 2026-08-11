I have now read every file in the territory plus the full execution path (directiveParser, nativeTools, runLLM, the executeToolDirectives loop in index.ts), the config surface, and both package.json/Dockerfiles. Findings:

# TOOLS & INTEGRATION SURFACE — sweep report

## Core engine files

**toolEngine.ts** — dispatcher: lookup, validate action, retry, timeout, trace, persist memory. **B+**. Solid honest-failure design; two real gaps below (D1, D6).
**toolRegistry.ts** — registry + LLM catalog builder. **A-**. Catalog promises "if a tool call fails, you'll see the error" — true in chat (summarizeToolResults appends ✗ lines) but not in rituals, where directives are stripped unexecuted (`rituals/engine.ts:53`, deliberate).
**types.ts** — contract. **A-**. `context.chainId` (types.ts:13, "Phase 9 autonomy chains") is written nowhere and read nowhere — dead field.
**registerTools.ts** — registers all 15 adapters; none dead at the adapter level. **A**.
**integrationStatus.ts** — derived tools-page truth. **B-**; drift items in D5.

## Parsing/execution path (priority hunt)

directiveParser.ts is genuinely hardened: balanced-brace JSON extraction, code-fence exemption, near-miss paging, `defuseDirectives()` at external ingress (web.fetch, sheets read_tabs, RSS, uploads, YouTube, inboxTriage, leadEngine). Native `invoke_tool` (nativeTools.ts) degrades to `[]` never throws; merge dedupes text+native; the bounded loop (index.ts:1133-1216) canonicalizes keys, dedupes gated actions, and refuses directives from non-DIRECTIVE_CAPABLE engines. This is the strongest part of the repo.

## Defects (by severity)

**D1 — gmail adapter output is not defused: the one open injection ingress.** `tools/adapters/gmail.ts:49-67` returns `snippet`, `subject`, and `read_message`'s full body verbatim. Only the inboxTriage *workflow* defuses (`autonomy/workflows/inboxTriage.ts:196-202`); the chat-path tool does not. Tool outputs are re-fed to the model in the agentic loop (index.ts:1169) with nativeTools enabled — text defusing wouldn't stop native-call steering anyway, but every other external-content adapter (web.ts:92, googleSheets.ts:1145) defuses as stated policy, and gmail — the cheapest attacker channel — skips it. Scenario: hostile email body carries `[TOOL: google_calendar.delete_event ...]` or persuasion text; Cole says "read that email"; rounds 2-3 of the loop can chain `read_events → delete_event` (both execute immediately, no gate) or crm writes. `expectTitle` cross-check mitigates but is optional.

**D2 — non-idempotent-write protection is inconsistent.** gmail/calendar/sheets/crm/content/productivity set `maxRetries: 0` with the correct "timeout doesn't cancel the in-flight promise" reasoning — but **autonomy.ts, business.ts, planning.ts, corpus.ts** take the engine default of **1 retry** (toolEngine.ts:22,74). `autonomy.grant`, `business.draft_offer`/`propose_angles` (LLM+research-backed, can plausibly exceed the 120s default timeout), `planning.break_goal_into_steps`, `plan_week` all create Bridge signals/tasks/offers. A slow first attempt trips the timeout, keeps running, AND retries → duplicate grant-confirm cards, duplicate proposed tasks, doubled research spend. Exactly the failure mode the other adapters' comments warn about.

**D3 — `business.draft_offer` is defined twice and half of it is dead.** `tools/adapters/business.ts:39-43` and 83-88 are two conflicting catalog entries for the same action name; at runtime the offers branch (line 143) intercepts, so the positioning-based `P.proposeOffer()` implementation at line 208-219 is unreachable through the tool — dead code (rule 8), and the LLM catalog shows two contradictory schemas for one action. `toolEngine.ts:59`'s `.find()` masks the duplicate.

**D4 — .env.example is materially incomplete.** Undocumented but load-bearing: **AURELIUS_API_KEY** (the API lock itself — preflight warns "OPEN" without it; index.ts:154-189), **FRED_API_KEY** (fred adapter + tools page), **TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER** (crm.text_lead), **INSTAGRAM_APP_ID / INSTAGRAM_REDIRECT_URI / INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ID / META_APP_ID / META_APP_SECRET / META_ADS_TOKEN**, **STRIPE_WEBHOOK_SECRET**, **INGEST_WATCH_DIR** (tools page names it), **GOOGLE_GMAIL_REDIRECT_URI** (gmail's own redirect, distinct from calendar's — integrationStatus.ts:174 even warns about it), HEALTHCHECKS_*, AURELIUS_TZ, LLM_TIMEOUT_MS/WEB_TIMEOUT_MS, MEDIA_HOST_PROVIDER, model overrides. The frontend has **no .env.example at all** (reads APP_UNLOCK_SECRET, AURELIUS_API_KEY, BACKEND_ORIGIN, NEXT_PUBLIC_BACKEND_URL, TRUST_PROXY). Cole funding keys next week will be guessing variable names from source.

**D5 — integrationStatus drift.** (a) `sheetsLive` is true when `GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH` is merely *set* (line 51-52) — googleAuth.ts:49 returns null if the file doesn't exist, so a bad path shows "live" while every call fails. (b) `googleHealthy` proves the calendar token mints, not that it carries Drive/Sheets scope — a pre-Sheets token shows Sheets "live" while every Drive search 403s (the adapter's `driveSearchProblem()` knows this; the status page can't). (c) RSS row status is **hardcoded "config"** (line 233) — it can never report live once feeds exist. (d) No rows at all for Twilio SMS, Stripe self-record, or Meta ads, though crm.text_lead is in the LLM catalog unconditionally. (e) Cosmetic: line 101's ternary has identical branches.

**D6 — secrets/PII hygiene in tool telemetry.** `persistToolMemory` (toolEngine.ts:155) stores full `inputData` for *every* call into Memory (which is embedded into the vector index), and `index.ts:448` console-logs the full payload. Any credential or sensitive text Cole pastes into a tool argument becomes a durable, recalled, embedded memory — brushing against hard rule 6's "credentials never in the vector index."

**Minor:** googleSheets `log_session`/`read_sessions` build ranges as `${dayTab}!A:I` unquoted (googleSheets.ts:290,353) — a tab name with an apostrophe breaks; the generic actions quote correctly (line 1135). Drive query escaping (`\'`, line 47) is correct per Drive API.

## Package/deploy

Backend deps: **uuid, groq-sdk, @google/generative-ai are installed but never imported** (Groq/Gemini/Anthropic all called via raw fetch); ts-node + nodemon are dead dev-deps (tsx is the runtime). pdf-parse pinned 1.1.1 with the known debug-mode quirk worked around via deep import (corpus/upload.ts:27) — fine but fragile on upgrade. Frontend: @types/react 19 against react 18.3. Dockerfiles are healthy and well-commented; no .github CI beyond copilot-instructions.md — smoke suite runs only when someone runs it.

## Auth handling (verified clean)

calendar/googleAuth.ts is the best-in-class piece: real health probe that refreshes, disconnects on `invalid_grant`, resets the cached Sheets client on token transitions; gmail has its own probe; integrationStatus distinguishes "dead token" from "never connected". SSRF guard on web.fetch covers direct private/link-local/loopback (DNS rebinding acknowledged as out of scope).

## Top 5 by severity

1. Gmail tool output not defused — the open injection channel into an immediate-execution loop (D1).
2. Default retry on autonomy/business/planning write actions — duplicate Bridge cards/tasks, doubled spend (D2).
3. .env.example gaps incl. AURELIUS_API_KEY — the API lock is undocumented (D4).
4. Duplicate/dead `business.draft_offer` + contradictory catalog entries (D3).
5. integrationStatus "live" claims that reality can't honor (Sheets path/scope, hardcoded RSS) (D5).

## "When Cole funds every key next week, what breaks on first contact?"

Honestly: less than usual for this codebase — the dormant-until-configured discipline is real. What breaks: (1) he won't find the variable names — half the paid surface (Twilio, Instagram publishing quartet, FRED, Stripe, the API lock) isn't in .env.example; (2) Sheets will show "live" and then 403 until he *re-authorizes* Google with the Sheets scope (or sets a service-account path that actually exists); (3) Instagram publishing still stops on `MEDIA_PUBLIC_BASE_URL` (correctly reported); (4) first hostile email read via `gmail.read_message` meets an un-defused injection path with live keys behind it; (5) a slow `business.options` research call will double-fire.

## 3 best opportunities

1. One-line fixes with outsized value: defuse in gmail.ts outputs; `maxRetries: 0` on autonomy/business/planning; delete the dead draft_offer block.
2. Generate .env.example (and a frontend one) from the actual `process.env` read set — the doctor already knows most of these; make the template derived like integrationStatus is.
3. Make integrationStatus probe the same way the doctor does (real Sheets-scope probe, RSS-config lookup, add SMS/Stripe rows) so the tools page and `self.diagnose` can't disagree.
