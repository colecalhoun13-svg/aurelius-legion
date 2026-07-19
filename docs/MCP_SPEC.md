# MCP Socket — Frozen Spec (build at Mac Mini deploy)

**Status:** SPEC FROZEN 2026-07-19 by full council (5 seats, blind openings →
rebuttals → red team; final vote unanimous). Not built. Builds as part of the
**Mac Mini deploy's definition of done** — the deploy is not complete until
this socket exists per this spec with its acceptance test green, or the
council explicitly re-votes the deferral.

**Why deferred:** every server that justifies MCP (browser, macOS control,
finance) runs on the Mini. A hardened socket with no real server behind it is
inventory, not capability — and the trust economy only starts spinning on
repeatedly-confirmed gated writes, which no Codespace-safe server produces.
The capability Cole needed now (drop-folder ingest, transcripts) shipped
natively in the 2026-07-19 block with no LLM in the ingest loop.

**First server (named, per the forcing-function requirement):**
`@playwright/mcp` (browser automation) — first mission: Mindbody session
review, read-only. **First keyhole candidate:** none at connect — everything
gates via `mcp.call` (non-grantable). If a specific browser flow earns trust
through repeated confirms, Cole may hand-add a named action class for it
(e.g. `browser.mindbody_read`) — his hand on the switch, per hard rule 1.

---

## Architecture

- `aurelius/tools/adapters/mcp.ts` — one adapter per configured server,
  registered as `mcp_<server>`; the server's tools become actions. Registry is
  open and the catalog rebuilds per prompt, so late/async registration works
  with zero Tool Engine changes (verified against `pattern.confirm` precedent).
- Config: `MCP_SERVERS=./mcp.servers.json` (gitignored — `env` blocks may
  carry keys; hard rule 6). Absent → one boot log line, fully dormant (hard
  rule 4). Shape per server:
  `{ "command": "<node_modules/.bin/...>", "args": [], "env": {}, "local": true,
     "inwardTools": ["read_file"], "exposeTools": ["..."] }`
- SDK: `@modelcontextprotocol/sdk`, exact-pinned committed dependency.

## Gating (safety kernel — non-negotiable)

1. **One static action class:** `mcp.call`, tier `outward`, in
   `ACTION_CLASSES` — non-grantable by construction (`checkGrantable` refuses;
   the reaper treats it conservatively). NO dynamic `registerActionClass` —
   a server's tool list must never mint grantability taxonomy (council
   rejected per-tool classes: a server update could silently widen grants).
2. Non-allowlisted tool call → `executeAction` files a Bridge proposal
   (mirrors `content.publish_post`); generic finalizer re-resolves the live
   client by server name from the payload; fails honestly if unconfigured.
3. **Bridge confirms render server + tool + FULL arguments verbatim** — Cole
   never confirms an opaque blob.
4. Inward allowlist (`inwardTools`) is hand-written, default-deny, honored
   **only for `local: true` servers** — model-authored arguments to a remote
   "read-only" tool are an exfiltration channel, so remote servers gate
   everything.
5. Trust-ledger attribution comes from BridgeSignal payloads +
   `persistToolMemory` metadata (server/tool stamped), mined by the Sunday
   decision curriculum — not from class keys.

## Supply chain + process hygiene

6. Servers are exact-pinned committed dependencies; config `command` points at
   `node_modules/.bin`. Loader **rejects `npx`/network-fetch commands loudly**.
   No auto-update, ever.
7. **Child env whitelist:** spawn with `PATH`/`HOME` + config-declared vars
   ONLY. Never inherit provider keys or `GITHUB_TOKEN`. Smoke-asserted (mock
   server echoes its env).
8. **Tool-list hash + drift refusal:** the approved `{server, version, tools,
   descriptions}` set is hashed in config; on mismatch at connect, refuse to
   register and file a Bridge signal (rug-pull detection).
9. Lifecycle: connect timeout (~10s) → degraded state, never blocks boot; no
   auto-respawn (fail loudly once with the fix); SIGTERM/exit kills children;
   health on `/api/mcp/status` + `integrationStatus`.

## Prompt + content hygiene

10. **Tool DESCRIPTIONS are attacker-controlled** (the canonical MCP attack):
    defuse + length-cap every server-supplied name/description/schema before
    `buildToolCatalog` injection; prefer hand-written descriptions for
    allowlisted tools. `exposeTools` caps catalog bloat; schemas truncated.
11. Names normalized to lowercase snake_case at registration (the directive
    parser eats hyphens/camelCase); `normalized → original` map in the
    adapter; collisions with existing tools **hard-fail** (no warn-overwrite).
12. Outputs recursively defused (every string field) **before prompt injection
    AND before memory persistence**; ~8KB truncation (web.ts precedent).
13. Engine seams (ALREADY SHIPPED 2026-07-19): `ToolAdapter.maxRetries` — MCP
    sets `0` (non-idempotent; the engine default re-fires) — and
    `ToolAdapter.timeoutMs`; reaper treats unknown classes as outward.

## Acceptance test (the deploy gate)

`scripts/mockMcpServer.ts` — stdio server via the same SDK: `echo_read`
(returns text containing a live `[TOOL: ...]` string — poison probe) +
`echo_write`. Smoke suite (self-cleaning, no network) asserts: registration
under `mcp_mock` with normalized names; `echo_read` (allowlisted) executes
directly and arrives defused in output AND in the persisted memory row;
`echo_write` returns gated with a pending BridgeSignal carrying verbatim args;
`confirmAction` flips it through the finalizer to `acted`;
`checkGrantable("mcp.call").grantable === false`; env-whitelist assertion; a
hyphenated tool name round-trips the directive parser.

## First consumer (build with the socket, not before)

`research/researchAdapters/mcpResearchAdapter.ts` — bridges content-bearing
MCP servers into the existing `ContentSource` seam (`research/sources.ts`,
shipped 2026-07-19), so every future server feeds curriculum/missions/
freshness automatically.

---

## Recorded separately (not MCP-dependent)

**Client Engine on-ramp** — near-term NATIVE block, first agenda item of the
parked business working session: Client model + roster sync from Cole's real
sheet (live `google_sheets` rails), populating the dormant
`ToolCall.context.clientId` so tool memory/traces become client-scoped from
day one. Council finding: this never needed MCP.
