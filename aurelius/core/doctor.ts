// aurelius/core/doctor.ts
//
// THE DOCTOR — what is actually working, right now, on THIS machine.
//
// Built during Cole's first Railway deploy, where "the Google stuff isn't
// working" and "Anthropic isn't coming up" were both true, both invisible
// from the code, and both diagnosable only from inside the running
// container. Config presence is not health: a key can be set and rejected,
// a token can be stored and dead. So every check here that CAN make a
// cheap live call DOES, and reports what the provider actually said.
//
// Honest failure (hard rule 3) taken seriously: every FAIL carries the fix,
// not just the symptom. Dormant-until-configured (hard rule 4) is reported
// as DORMANT, never as broken — an integration Cole hasn't set up is a
// choice, not a fault.

import { ANTHROPIC_DEFAULT_MODEL as ROUTER_DEFAULT_MODEL } from "../llm/modelConfig.ts";

export type CheckStatus = "ok" | "dormant" | "fail";
export type Check = {
  area: string;
  name: string;
  status: CheckStatus;
  detail: string;
  /** What to do about it. Empty when nothing needs doing. */
  fix?: string;
};

const ok = (area: string, name: string, detail: string): Check => ({ area, name, status: "ok", detail });
const dormant = (area: string, name: string, detail: string, fix?: string): Check => ({ area, name, status: "dormant", detail, fix });
const fail = (area: string, name: string, detail: string, fix: string): Check => ({ area, name, status: "fail", detail, fix });

/** Env var present AND non-empty after trimming (a pasted newline is not a key). */
function env(name: string): string | null {
  const v = process.env[name]?.trim().replace(/^["']|["']$/g, "");
  return v ? v : null;
}

// ── Engines ──────────────────────────────────────────────────────────
// A live 1-token ping is the only way to tell "key set" from "key works".

/**
 * When the probe fails, ask the key itself what it CAN do. /v1/models is the
 * cheapest possible question — it separates "this key is dead" from "this key
 * is fine but can't reach that model", which are the same red X otherwise.
 * Returns the model list, `[]` when the key is valid but lists nothing, or
 * null when the key was rejected outright.
 */
async function anthropicModels(key: string): Promise<string[] | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=20", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => ({}));
    return (j?.data ?? []).map((m: any) => m?.id).filter(Boolean);
  } catch {
    return null;
  }
}

async function checkAnthropic(): Promise<Check> {
  const key = env("ANTHROPIC_API_KEY");
  if (!key) {
    return dormant("engines", "anthropic", "no ANTHROPIC_API_KEY on THIS service",
      "set ANTHROPIC_API_KEY on the BACKEND service (the frontend having it is not enough — the backend is what reasons)");
  }
  // Probe the model the router actually defaults to, not a hardcoded guess —
  // otherwise the doctor can report broken while chat works, or vice versa.
  const model = ROUTER_DEFAULT_MODEL;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return ok("engines", "anthropic", `live — key accepted, ${model} reachable`);
    const j: any = await res.json().catch(() => ({}));
    const msg = j?.error?.message ?? `HTTP ${res.status}`;

    if (res.status === 401) {
      return fail("engines", "anthropic", `key REJECTED (401): ${msg}`,
        `the key is set but Anthropic won't accept it. Usual causes, in order: (1) it's the key from a different account or workspace, ` +
        `(2) it was pasted with a trailing space/newline, (3) it's been revoked. Re-copy it from console.anthropic.com, ` +
        `paste with no surrounding quotes or whitespace, and REDEPLOY — a variable change alone doesn't restart the process.`);
    }
    if (res.status === 400 && /credit|balance/i.test(msg)) {
      return fail("engines", "anthropic", `billing — the key is VALID, the account is out of credit: ${msg}`,
        "add credit at console.anthropic.com → Billing. Nothing is wrong with the key or the deploy.");
    }
    if (res.status === 429) {
      return fail("engines", "anthropic", `rate limited — the key WORKS, you're just over the limit: ${msg}`,
        "wait it out, or raise the limit at console.anthropic.com → Limits");
    }
    if (res.status === 404 || /model/i.test(msg)) {
      // The key may be perfectly good and simply lack access to this model.
      const models = await anthropicModels(key);
      if (models === null) {
        return fail("engines", "anthropic", `${res.status}: ${msg} — and the key can't list models either, so it's the KEY, not the model`,
          "re-copy ANTHROPIC_API_KEY from console.anthropic.com and redeploy");
      }
      if (models.length === 0) {
        return fail("engines", "anthropic", `the key is VALID but your account exposes no models`,
          "check console.anthropic.com → the account may be new, unverified, or have no credit yet");
      }
      return fail("engines", "anthropic",
        `the key is VALID, but "${model}" is not available to this account. It CAN reach: ${models.slice(0, 8).join(", ")}`,
        `set ANTHROPIC_CHAT_MODEL to one of those (e.g. ANTHROPIC_CHAT_MODEL=${models[0]}) and redeploy`);
    }
    return fail("engines", "anthropic", `${res.status}: ${msg}`, "check console.anthropic.com — the exact message above is Anthropic's own");
  } catch (e: any) {
    return fail("engines", "anthropic", `unreachable: ${e?.message ?? e}`,
      "the container can't reach api.anthropic.com at all — a network/egress problem, not a key problem");
  }
}

async function checkOpenAI(): Promise<Check> {
  const key = env("OPENAI_API_KEY");
  if (!key) return dormant("engines", "openai", "no OPENAI_API_KEY", "optional — set it for failover and openai embeddings");
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return ok("engines", "openai", "live — key accepted");
    const j: any = await res.json().catch(() => ({}));
    return fail("engines", "openai", `${res.status}: ${j?.error?.message ?? "rejected"}`,
      res.status === 401 ? "re-copy OPENAI_API_KEY (watch for whitespace)" : "check the OpenAI dashboard");
  } catch (e: any) {
    return fail("engines", "openai", `unreachable: ${e?.message ?? e}`, "network/egress problem from the container");
  }
}

async function checkGemini(): Promise<Check> {
  const key = env("GEMINI_API_KEY");
  if (!key) return dormant("engines", "gemini", "no GEMINI_API_KEY", "optional — powers vision, web search fallback, gemini embeddings");
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return ok("engines", "gemini", "live — key accepted");
    return fail("engines", "gemini", `HTTP ${res.status}`, "re-copy GEMINI_API_KEY from aistudio.google.com");
  } catch (e: any) {
    return fail("engines", "gemini", `unreachable: ${e?.message ?? e}`, "network/egress problem from the container");
  }
}

function checkOptionalEngineKeys(): Check[] {
  return (["GROQ_API_KEY", "DEEPSEEK_API_KEY", "XAI_API_KEY"] as const)
    .filter((k) => !env(k))
    .map((k) => dormant("engines", k.replace("_API_KEY", "").toLowerCase(), "not configured", "optional failover provider"));
}

// ── Embeddings ───────────────────────────────────────────────────────

async function checkEmbeddings(): Promise<Check> {
  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider === "mock") {
    return fail("retrieval", "embeddings", "EMBEDDINGS_PROVIDER=mock — recall is fake (hash vectors)",
      "set the real provider (openai or gemini) + its key, then run scripts/backfillEmbeddings.ts --force");
  }
  if (provider !== "openai" && provider !== "gemini") {
    return fail("retrieval", "embeddings", `unknown provider "${provider}" — retrieval DISABLED`,
      "EMBEDDINGS_PROVIDER must be exactly 'openai' or 'gemini'");
  }
  const keyName = provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
  if (!env(keyName)) {
    return fail("retrieval", "embeddings", `provider is ${provider} but ${keyName} is missing — retrieval DISABLED`,
      `set ${keyName}, or switch EMBEDDINGS_PROVIDER to the one you have a key for`);
  }
  try {
    const { getEmbeddingAdapter } = await import("../retrieval/embeddingAdapter.ts");
    const adapter = getEmbeddingAdapter();
    if (!adapter) {
      return fail("retrieval", "embeddings", "no adapter resolved — retrieval DISABLED",
        `check EMBEDDINGS_PROVIDER and ${keyName}`);
    }
    const [vec] = await adapter.embed(["aurelius doctor probe"]);
    if (Array.isArray(vec) && vec.length > 0) {
      return ok("retrieval", "embeddings", `live — ${adapter.name}/${adapter.model}, ${vec.length} dims`);
    }
    return fail("retrieval", "embeddings", "embedder returned nothing", "check the provider key and quota");
  } catch (e: any) {
    return fail("retrieval", "embeddings", `probe failed: ${e?.message ?? e}`, `check ${keyName} and the provider's quota`);
  }
}

/**
 * THE SECOND HALF OF THE EMBEDDINGS STORY. A working embedder is not a
 * working memory: retrieval only matches rows whose stored `embeddingModel`
 * equals the ACTIVE one, because different models put text in different
 * places. Switch provider (mock → openai, openai → gemini) and every
 * existing vector becomes invisible — `searchSimilar` returns zero rows,
 * which is indistinguishable from "nothing relevant". The index is fine;
 * it's just being read in the wrong geometry, and only a backfill fixes it.
 */
async function checkVectorGeometry(): Promise<Check | null> {
  try {
    const { getEmbeddingAdapter } = await import("../retrieval/embeddingAdapter.ts");
    const adapter = getEmbeddingAdapter();
    if (!adapter) return null; // the embeddings check already reported this
    const active = `${adapter.name}:${adapter.model}`;
    const { prisma } = await import("./db/prisma.ts");
    const rows: Array<{ embeddingModel: string; n: bigint }> = await prisma.$queryRaw`
      SELECT "embeddingModel", COUNT(*)::bigint AS n
      FROM "VectorEmbedding" GROUP BY "embeddingModel"`;
    const total = rows.reduce((a, r) => a + Number(r.n), 0);
    if (total === 0) {
      return dormant("retrieval", "vector index", "empty — nothing embedded yet",
        "normal on a fresh database; it fills as knowledge lands");
    }
    const usable = Number(rows.find((r) => r.embeddingModel === active)?.n ?? 0);
    if (usable === 0) {
      const others = rows.map((r) => `${r.embeddingModel} (${Number(r.n)})`).join(", ");
      return fail("retrieval", "vector index",
        `${total} vectors stored, NONE readable by the active embedder (${active}). Stored as: ${others}`,
        "the provider changed, so the whole index is in the wrong geometry — recall silently returns nothing. Re-embed: cd aurelius && DATABASE_URL=<url> npx tsx scripts/backfillEmbeddings.ts --force");
    }
    if (usable < total) {
      return dormant("retrieval", "vector index",
        `${usable}/${total} vectors readable by ${active} — the rest were embedded by another model`,
        "run scripts/backfillEmbeddings.ts --force to bring the whole index into one geometry");
    }
    return ok("retrieval", "vector index", `${total} vectors, all readable by ${active}`);
  } catch (e: any) {
    return fail("retrieval", "vector index", `check failed: ${e?.message ?? e}`, "see the backend log");
  }
}

/**
 * FAILOVER IS SILENT IN THE SPINE. Chat says so out loud ("anthropic was
 * unreachable — openai answered this one"), but the 07:00 briefing and every
 * other scheduled job only record it in a LogEntry field. A provider that has
 * been dead for a week reads as "everything's fine" unless Cole opens Traces.
 */
async function checkFailover(): Promise<Check | null> {
  try {
    const { prisma } = await import("./db/prisma.ts");
    const since = new Date(Date.now() - 7 * 86400_000);
    const recent = await prisma.logEntry.findMany({
      where: { type: "llm_call", createdAt: { gte: since } },
      select: { context: true },
      take: 2000,
    });
    if (!recent.length) return null;
    const counts = new Map<string, number>();
    for (const r of recent) {
      const from = (r.context as any)?.failedOverFrom;
      if (typeof from === "string") counts.set(from, (counts.get(from) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (total === 0) return ok("engines", "failover", `no failovers in ${recent.length} calls over 7 days`);
    const detail = [...counts.entries()].map(([p, n]) => `${p} → ${n}×`).join(", ");
    const share = total / recent.length;
    return share > 0.25
      ? fail("engines", "failover", `${total}/${recent.length} calls failed over in 7 days (${detail})`,
          "a provider is failing consistently — the checks above say which. Scheduled rituals never mention this, so it can run for weeks unnoticed.")
      : dormant("engines", "failover", `${total}/${recent.length} calls failed over in 7 days (${detail})`,
          "occasional failover is the system working as designed");
  } catch {
    return null;
  }
}

// ── Google (calendar + gmail) ────────────────────────────────────────
// The subtle one: a stored refresh token is bound to the CLIENT that
// minted it. Swap OAuth clients (desktop → web) and every stored token
// dies with `invalid_grant`, which reads like "Google is broken".

async function checkGoogle(): Promise<Check[]> {
  const out: Check[] = [];
  const id = env("GOOGLE_CLIENT_ID");
  const secret = env("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) {
    out.push(dormant("google", "credentials", "GOOGLE_CLIENT_ID/SECRET not set",
      "add both from the Google Cloud Console OAuth client (must be a WEB application client)"));
    return out;
  }
  out.push(ok("google", "credentials", `client configured (…${id.slice(-14)})`));

  const redirect = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!redirect) {
    out.push(fail("google", "redirect uri", "GOOGLE_REDIRECT_URI not set — Connect will send you to localhost",
      "set GOOGLE_REDIRECT_URI=https://<backend-domain>/api/calendar/callback AND add that exact URI in the Google Console"));
  } else if (redirect.includes("localhost")) {
    out.push(fail("google", "redirect uri", `points at localhost: ${redirect}`,
      "on a hosted deploy this must be the public backend domain + /api/calendar/callback"));
  } else {
    out.push(ok("google", "redirect uri", redirect));
  }

  // Calendar: stored token + a LIVE refresh, which is what actually breaks.
  try {
    const { isCalendarConnected, getAccessToken } = await import("../calendar/googleAuth.ts");
    if (!(await isCalendarConnected())) {
      out.push(dormant("google", "calendar", "no stored token — never connected, or a dead token was cleared",
        "open https://<backend-domain>/api/calendar/auth once and approve"));
    } else {
      const token = await getAccessToken(true); // force refresh: the real test
      if (token) {
        out.push(ok("google", "calendar", "live — refresh token works, access token minted"));
      } else {
        out.push(fail("google", "calendar", "stored token REJECTED — refresh failed (usually invalid_grant)",
          "the token was minted by a DIFFERENT OAuth client (e.g. you swapped desktop → web), or access was revoked. Re-connect at https://<backend-domain>/api/calendar/auth"));
      }
    }
  } catch (e: any) {
    out.push(fail("google", "calendar", `check threw: ${e?.message ?? e}`, "see the backend log"));
  }

  // Gmail rides the same OAuth client but its OWN token AND its own redirect
  // var — setting only GOOGLE_REDIRECT_URI leaves Gmail unable to re-connect.
  try {
    const { gmailAuth } = await import("../gmail/engine.ts");
    if (!(await gmailAuth.isConnected())) {
      out.push(dormant("google", "gmail", "not connected", "optional — open /api/gmail/auth to enable inbox triage"));
    } else if (await gmailAuth.isHealthy()) {
      out.push(ok("google", "gmail", "live — refresh token works"));
    } else {
      out.push(fail("google", "gmail", "stored token REJECTED — refresh failed",
        "re-connect at /api/gmail/auth (Gmail has its own token, separate from the calendar's)"));
    }
    const gmailRedirect = process.env.GOOGLE_GMAIL_REDIRECT_URI?.trim();
    if (!gmailRedirect) {
      out.push(dormant("google", "gmail redirect uri", "GOOGLE_GMAIL_REDIRECT_URI not set — falls back to localhost",
        "needed only to (re)connect Gmail on a hosted deploy: set it to https://<backend-domain>/api/gmail/callback and register that exact URI too. It is a SEPARATE var from GOOGLE_REDIRECT_URI."));
    } else if (gmailRedirect.includes("localhost")) {
      out.push(fail("google", "gmail redirect uri", `points at localhost: ${gmailRedirect}`,
        "on a hosted deploy this must be the public backend domain + /api/gmail/callback"));
    } else {
      out.push(ok("google", "gmail redirect uri", gmailRedirect));
    }
  } catch {
    out.push(dormant("google", "gmail", "not wired on this build", ""));
  }

  // Consent-screen mode is invisible from here but bites in 7 days.
  out.push(dormant("google", "consent screen", "cannot be read from the API — verify manually",
    "if the OAuth consent screen is still in TESTING, publish it: Google expires refresh tokens after 7 days in testing mode"));
  return out;
}

// ── Telegram ─────────────────────────────────────────────────────────

async function checkTelegram(): Promise<Check> {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) return dormant("telegram", "bot", "no TELEGRAM_BOT_TOKEN", "optional — set it for the phone bridge");
  if (!env("TELEGRAM_CHAT_ID")) {
    return fail("telegram", "bot", "token set but TELEGRAM_CHAT_ID missing — pushes can't be delivered",
      "set TELEGRAM_CHAT_ID to your own chat id");
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(15_000) });
    const j: any = await res.json().catch(() => ({}));
    if (j?.ok) return ok("telegram", "bot", `live — @${j.result?.username ?? "bot"}`);
    return fail("telegram", "bot", `rejected: ${j?.description ?? res.status}`, "re-copy TELEGRAM_BOT_TOKEN from BotFather");
  } catch (e: any) {
    return fail("telegram", "bot", `unreachable: ${e?.message ?? e}`, "network/egress problem from the container");
  }
}

// ── Core plumbing ────────────────────────────────────────────────────

async function checkDatabase(): Promise<Check> {
  try {
    const { prisma } = await import("./db/prisma.ts");
    await prisma.$queryRaw`SELECT 1`;
    return ok("core", "database", "reachable");
  } catch (e: any) {
    return fail("core", "database", `unreachable: ${e?.message ?? e}`, "check DATABASE_URL (Neon URL, not the sandbox one)");
  }
}

function checkLock(): Check {
  return env("AURELIUS_API_KEY")
    ? ok("core", "api lock", "armed")
    : fail("core", "api lock", "AURELIUS_API_KEY not set — the API is OPEN",
        "set AURELIUS_API_KEY on the backend AND the same value on the frontend service");
}

function checkTimezone(): Check {
  const tz = process.env.AURELIUS_TZ?.trim();
  if (!tz) {
    return fail("core", "timezone", "AURELIUS_TZ not set — the container's UTC clock drives every ritual",
      "set AURELIUS_TZ (and TZ) to your zone, e.g. America/Phoenix, on BOTH services");
  }
  try {
    const now = new Date().toLocaleString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
    return ok("core", "timezone", `${tz} — local time reads ${now}`);
  } catch {
    return fail("core", "timezone", `AURELIUS_TZ="${tz}" is not a valid IANA zone`, "use a zone like America/Phoenix");
  }
}

function checkWebSearch(): Check {
  if (env("TAVILY_API_KEY")) return ok("research", "web search", "live — Tavily");
  if (env("GEMINI_API_KEY")) return ok("research", "web search", "live — Gemini fallback");
  return dormant("research", "web search", "no TAVILY_API_KEY or GEMINI_API_KEY — live search disabled",
    "optional — research falls back to model knowledge and says so");
}

/** Run every check. Live probes run in parallel; the whole sweep is bounded. */
export async function runDoctor(): Promise<{ checks: Check[]; summary: string }> {
  const [anthropic, openai, gemini, embeddings, google, telegram, db] = await Promise.all([
    checkAnthropic(),
    checkOpenAI(),
    checkGemini(),
    checkEmbeddings(),
    checkGoogle(),
    checkTelegram(),
    checkDatabase(),
  ]);
  // These two read the DB, so they run after it has been proven reachable —
  // otherwise their failures would just restate "no database".
  const [geometry, failover] =
    db.status === "ok" ? await Promise.all([checkVectorGeometry(), checkFailover()]) : [null, null];
  const checks: Check[] = [
    db,
    checkLock(),
    checkTimezone(),
    anthropic,
    openai,
    gemini,
    ...checkOptionalEngineKeys(),
    ...(failover ? [failover] : []),
    embeddings,
    ...(geometry ? [geometry] : []),
    ...google,
    telegram,
    checkWebSearch(),
  ];
  const failed = checks.filter((c) => c.status === "fail");
  const dormantCount = checks.filter((c) => c.status === "dormant").length;
  const summary = failed.length
    ? `${failed.length} thing(s) BROKEN: ${failed.map((c) => c.name).join(", ")}. ${dormantCount} dormant by choice.`
    : `Everything configured is working. ${dormantCount} dormant by choice.`;
  return { checks, summary };
}

/** Human-readable report — what Telegram and the console print. */
export function formatDoctor(result: { checks: Check[]; summary: string }): string {
  const glyph = { ok: "✓", dormant: "○", fail: "✗" } as const;
  const lines: string[] = [];
  let area = "";
  for (const c of result.checks) {
    if (c.area !== area) {
      area = c.area;
      lines.push(`\n${area.toUpperCase()}`);
    }
    lines.push(`  ${glyph[c.status]} ${c.name} — ${c.detail}`);
    if (c.status === "fail" && c.fix) lines.push(`      → ${c.fix}`);
  }
  return `${result.summary}\n${lines.join("\n")}`;
}
