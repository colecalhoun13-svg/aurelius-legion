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

import fs from "node:fs";
import path from "node:path";

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
    // NOT DORMANT. Anthropic is the strategic + high-leverage tier and the
    // fall-through for every task type the router doesn't name explicitly —
    // roughly everything. Filing its absence under "by choice" is how Cole ran
    // a week at 90% failover thinking the report looked fine.
    return fail("engines", "anthropic",
      "no ANTHROPIC_API_KEY on THIS service — the tier almost every task routes to has no engine",
      "set ANTHROPIC_API_KEY on the BACKEND service (the frontend having it is not enough — the backend is what reasons), " +
        "then press Apply Changes in Railway: the new value only reaches the process on the next deploy. " +
        "Until then every Claude-routed call lands on a substitute model, and the opus reviewer is skipped with no trace.");
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

/**
 * EVERY PROVIDER GETS A ROW — configured or not.
 *
 * The old version emitted a row only for keys that were MISSING, so the
 * moment Cole set GROQ_API_KEY the groq line disappeared from the report
 * entirely. Three engines showed where six exist, and the ones that vanished
 * were precisely the ones he'd just configured. A health report that hides
 * what you set up is worse than no report.
 *
 * Each of these is a plain authenticated GET against the provider's model
 * list — the cheapest question that proves a key works.
 */
async function bearerProbe(args: {
  area: string;
  name: string;
  keyName: string;
  url: string;
  role: string;
  /** Where the operator goes to fix billing or re-copy the key. */
  console: string;
  fixWhenDormant: string;
}): Promise<Check> {
  const key = env(args.keyName);
  if (!key) return dormant(args.area, args.name, `not configured — ${args.role}`, args.fixWhenDormant);
  try {
    const res = await fetch(args.url, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return ok(args.area, args.name, `live — key accepted · ${args.role}`);
    const raw = await res.text().catch(() => "");
    let msg: string = raw;
    try {
      const j = JSON.parse(raw);
      msg = j?.error?.message ?? j?.error ?? j?.message ?? raw;
    } catch { /* not JSON — use the raw body */ }
    // 400 chars, not 160: xAI's reply carried the billing console URL and the
    // old slice amputated it mid-link.
    msg = String(msg).slice(0, 400);

    // A FUNDED-ACCOUNT problem and a BAD-KEY problem are the same red X
    // otherwise, and their fixes have nothing to do with each other. Cole's
    // xAI key was perfectly valid — his team had no credits — and this told
    // him to re-paste the key.
    if (/credit|licen[cs]e|billing|payment|balance|insufficient|quota|permission.?denied/i.test(msg)) {
      return fail(args.area, args.name, `billing — the KEY IS VALID, the account can't pay for calls: ${msg}`,
        `add credits or a plan at ${args.console}. Do NOT re-paste ${args.keyName} — nothing is wrong with the key or the deploy.`);
    }
    if (res.status === 429 || /rate.?limit/i.test(msg)) {
      return fail(args.area, args.name, `rate limited — the key WORKS: ${msg}`,
        `wait it out, or raise the limit at ${args.console}`);
    }
    if (res.status === 401) {
      return fail(args.area, args.name, `key REJECTED (401): ${msg}`,
        `re-copy ${args.keyName} from ${args.console} (no quotes, no trailing space/newline), then press Apply Changes in Railway — the new value only reaches the process on the next deploy.`);
    }
    return fail(args.area, args.name, `${res.status}: ${msg}`, `check ${args.console} — the message above is theirs`);
  } catch (e: any) {
    return fail(args.area, args.name, `unreachable: ${e?.message ?? e}`, "network/egress problem from the container");
  }
}

function checkOptionalEngineKeys(): Array<Promise<Check>> {
  return [
    bearerProbe({
      area: "engines", name: "groq", console: "console.groq.com", keyName: "GROQ_API_KEY",
      url: "https://api.groq.com/openai/v1/models",
      role: "the cheap high-volume tier (log/extract/track/quick replies) + voice-note transcription",
      fixWhenDormant: "optional but free — a Groq key also turns on Telegram voice notes",
    }),
    bearerProbe({
      area: "engines", name: "deepseek", console: "platform.deepseek.com", keyName: "DEEPSEEK_API_KEY",
      url: "https://api.deepseek.com/models",
      role: "the math / code-heavy tier",
      fixWhenDormant: "optional — those tasks fall back to Anthropic without it",
    }),
    bearerProbe({
      area: "engines", name: "xai", console: "console.x.ai", keyName: "XAI_API_KEY",
      url: "https://api.x.ai/v1/models",
      role: "the realtime/current-events tier",
      fixWhenDormant: "optional — realtime questions fall back to web search",
    }),
  ];
}

// ── Data + outward integrations ──────────────────────────────────────
// Everything else that reads a key. These were absent from the report
// entirely, which is its own kind of lying: an integration nobody checks
// looks identical to one that works.

async function checkFred(): Promise<Check> {
  const key = env("FRED_API_KEY");
  if (!key) return dormant("data", "fred", "not configured — economic + rates data for the wealth operator", "a free key from fred.stlouisfed.org (~2 min)");
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series?series_id=GNPCA&file_type=json&api_key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (res.ok) return ok("data", "fred", "live — key accepted");
    return fail("data", "fred", `${res.status}: ${(await res.text().catch(() => "")).slice(0, 140)}`,
      "re-copy FRED_API_KEY from fred.stlouisfed.org");
  } catch (e: any) {
    return fail("data", "fred", `unreachable: ${e?.message ?? e}`, "network/egress problem from the container");
  }
}

async function checkPaperless(): Promise<Check> {
  // env(), not raw process.env — every other check strips wrapping quotes, and
  // a quoted value behaving differently in two code paths is its own bug.
  const url = env("PAPERLESS_URL")?.replace(/\/$/, "");
  const token = env("PAPERLESS_TOKEN");
  if (!url || !token) {
    return dormant("data", "paperless", "not configured — scanned documents → OCR → second brain, every 10 min",
      "set PAPERLESS_URL + PAPERLESS_TOKEN (this one lives on the Mac Mini / NAS, not Railway)");
  }
  try {
    const res = await fetch(`${url}/api/documents/?page_size=1`, {
      headers: { authorization: `Token ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return ok("data", "paperless", `live — reachable at ${url}`);
    return fail("data", "paperless", `${res.status} from ${url}`,
      res.status === 401 || res.status === 403 ? "re-issue PAPERLESS_TOKEN" : "check that PAPERLESS_URL is reachable from this container");
  } catch (e: any) {
    return fail("data", "paperless", `unreachable at ${url}: ${e?.message ?? e}`,
      "a private/LAN address is not reachable from a cloud container — Paperless belongs on the Mini deploy");
  }
}

async function checkInstagram(): Promise<Check> {
  try {
    const { isInstagramConfigured, isInstagramConnected } = await import("../instagram/auth.ts");
    if (!isInstagramConfigured() && !env("INSTAGRAM_ACCESS_TOKEN")) {
      return dormant("outward", "instagram", "not configured — drafting works keyless; publishing + metrics need the app",
        "create a Meta app → INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET, then connect at /api/instagram/auth");
    }
    if (!(await isInstagramConnected())) {
      return dormant("outward", "instagram", "app configured, account not connected", "one tap at /api/instagram/auth");
    }
    return ok("outward", "instagram", "connected — publishing still stops for your confirm (outward, non-grantable)");
  } catch (e: any) {
    return fail("outward", "instagram", `module failed to load: ${e?.message ?? e}`,
      "this is a code/deploy error, not a config choice — see the backend log");
  }
}

function checkSheets(calendar: Check | undefined): Check {
  const path = env("GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH");
  if (path) {
    // Presence of a STRING is not presence of a FILE. The adapter opens this
    // at call time; a typo'd or unmounted path was green here and threw there.
    try {
      JSON.parse(fs.readFileSync(path, "utf8"));
      return ok("google", "sheets auth", `service account file present and parseable: ${path}`);
    } catch (e: any) {
      return fail("google", "sheets auth", `GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH=${path} is unreadable or not JSON: ${e?.message ?? e}`,
        "mount the key file into the container at that path, or drop the var and use the Google login instead");
    }
  }
  if (!env("GOOGLE_CLIENT_ID")) {
    return dormant("google", "sheets auth", "no Google login and no service account",
      `connect Google at ${authUrl("/api/calendar/auth")} — one authorization covers Calendar and Sheets`);
  }
  if (calendar?.status === "fail") {
    return fail("google", "sheets auth", "DEAD — Sheets rides the calendar token, and that token is rejected (see above)",
      `every Sheets read and write is failing right now. Fixing the calendar row fixes this one: ${authUrl("/api/calendar/auth")}`);
  }
  if (calendar?.status !== "ok") {
    return dormant("google", "sheets auth", "waiting on the Google login (Sheets rides the calendar token)",
      `connect once at ${authUrl("/api/calendar/auth")}`);
  }
  return ok("google", "sheets auth", "rides your Google login — the calendar token above is live");
}

function checkIngestPaths(): Check[] {
  const out: Check[] = [];
  const dir = env("INGEST_WATCH_DIR");
  out.push(dir
    ? ok("data", "ingest folder", `watching ${dir}`)
    : dormant("data", "ingest folder", "not configured — drop a file, the brain learns it within 10 min",
        "set INGEST_WATCH_DIR to a drop folder (not the vault). Most useful on the Mini, where you have a real filesystem."));
  const vault = env("VAULT_DIR");
  out.push(vault
    ? ok("data", "vault mirror", `mirroring to ${vault}`)
    : dormant("data", "vault mirror", "not configured — Obsidian vault mirror", "optional; set VAULT_DIR at the Mini deploy"));
  // A SET STRING IS NOT A WORKING BACKUP. This printed OK off the env var alone
  // — it never asked whether the directory was writable, whether a Railway
  // volume was actually mounted there, or whether a dump had ever landed. An
  // unmounted path means every nightly dump dies with the container, silently,
  // under a green tick.
  const backups = env("AURELIUS_BACKUP_DIR");
  if (!backups) {
    out.push(fail("core", "backups", "AURELIUS_BACKUP_DIR not set — nightly dumps have nowhere durable to land",
      "set AURELIUS_BACKUP_DIR=/data/backups and mount a Railway volume at /data, or the 02:00 backup writes into a container that gets replaced"));
  } else {
    try {
      fs.mkdirSync(backups, { recursive: true });
      const probe = path.join(backups, ".doctor-probe");
      fs.writeFileSync(probe, "ok");
      fs.unlinkSync(probe);
      const dumps = fs
        .readdirSync(backups)
        .filter((f) => f.startsWith("aurelius-") && f.endsWith(".dump"))
        .map((f) => fs.statSync(path.join(backups, f)).mtimeMs)
        .sort((a, b) => b - a);
      if (!dumps.length) {
        out.push(fail("core", "backups", `${backups} is writable but EMPTY — no dump has ever landed`,
          "the 02:00 job has never succeeded. Check the backend log for [backup] lines, and confirm a Railway volume is mounted at the parent of this path — without one, dumps die with the container."));
      } else {
        const ageH = Math.round((Date.now() - dumps[0]) / 3600_000);
        out.push(ageH > 48
          ? fail("core", "backups", `newest dump is ${ageH}h old (${dumps.length} on disk in ${backups})`,
              "the 02:00 job hasn't run or hasn't succeeded — check the [backup] lines in the backend log")
          : ok("core", "backups", `${dumps.length} dump(s) in ${backups}, newest ${ageH}h old`));
      }
    } catch (e: any) {
      out.push(fail("core", "backups", `${backups} is NOT writable: ${e?.message ?? e}`,
        "mount a Railway volume at /data (service → Settings → Volumes) — without it the 02:00 dump has nowhere to land and every backup is lost on redeploy"));
    }
  }
  return out;
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
      // By here the provider and key are both proven fine, so the only way to
      // land here is the kill switch. Saying "check EMBEDDINGS_PROVIDER and
      // the key" would send Cole to re-verify the two things just validated.
      const killed = process.env.RETRIEVAL_EMBEDDINGS_ENABLED === "false";
      return fail("retrieval", "embeddings",
        killed
          ? "RETRIEVAL_EMBEDDINGS_ENABLED=false — retrieval is switched OFF at the kill switch, even though the provider and key are both fine"
          : "no adapter resolved — retrieval DISABLED",
        killed
          ? "unset RETRIEVAL_EMBEDDINGS_ENABLED (or set it to true) and redeploy"
          : `check EMBEDDINGS_PROVIDER and ${keyName}`);
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
    if (!adapter) {
      // Never null — a dropped row reads as "fine". The embeddings row above
      // carries the fix; this one just refuses to disappear.
      return dormant("retrieval", "vector index", "not measurable — no embedder resolved (see the embeddings row above)", "");
    }
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
      const stranded = rows
        .filter((r) => r.embeddingModel !== active)
        .map((r) => `${r.embeddingModel} (${Number(r.n)})`)
        .join(", ");
      // NOT dormant — nobody chose this, and the consequence is invisible:
      // searchSimilar filters on embeddingModel, so these rows are excluded
      // from EVERY recall query forever and nothing ever says so.
      return fail("retrieval", "vector index",
        `${usable}/${total} vectors readable by ${active} — ${total - usable} are STRANDED in ${stranded} and are filtered out of every recall query. Whatever they encode will never surface again, and nothing will tell you.`,
        `re-embed the index into one geometry, and PIN THE PROVIDER EXPLICITLY: ` +
          `EMBEDDINGS_PROVIDER=${adapter.name} DATABASE_URL=<prod url> npx tsx scripts/backfillEmbeddings.ts --force . ` +
          `The pin matters — that script loads .env, and a local .env carrying EMBEDDINGS_PROVIDER=mock would overwrite all ${total} production vectors with hash garbage. ` +
          `--force is required too: the incremental path skips any source that already has a row regardless of which model wrote it — i.e. exactly the stranded ones.`);
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
  const KEY_FOR: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", groq: "GROQ_API_KEY",
    gemini: "GEMINI_API_KEY", deepseek: "DEEPSEEK_API_KEY", xai: "XAI_API_KEY",
  };
  try {
    const { prisma } = await import("./db/prisma.ts");
    const since = new Date(Date.now() - 7 * 86400_000);
    const recent = await prisma.logEntry.findMany({
      where: { type: "llm_call", createdAt: { gte: since } },
      select: { context: true },
      // ORDER matters: `take` without it made recent.length a cap over an
      // arbitrary slice, so the percentage went arbitrary above the limit.
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    if (!recent.length) {
      // Never return null — a missing row reads as "fine".
      return dormant("engines", "failover", "no LLM calls logged in the last 7 days — nothing to measure", "");
    }
    const counts = new Map<string, number>();
    for (const r of recent) {
      const from = (r.context as any)?.failedOverFrom;
      if (typeof from === "string") counts.set(from, (counts.get(from) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (total === 0) return ok("engines", "failover", `no failovers in ${recent.length} calls over 7 days`);

    const detail = [...counts.entries()].map(([p, n]) => `${n}× away from ${p}`).join(", ");
    const share = total / recent.length;
    if (share <= 0.25) {
      return dormant("engines", "failover", `${total}/${recent.length} calls re-routed in 7 days (${detail})`,
        "occasional failover is the system working as designed");
    }
    const [worst] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const worstProvider = worst[0];
    const configured = !!process.env[KEY_FOR[worstProvider] ?? ""]?.trim();
    return fail("engines", "failover",
      `${total}/${recent.length} calls (${Math.round(share * 100)}%) were re-routed away from the engine the router chose (${detail})`,
      configured
        ? `${worstProvider} is answering but failing — the "${worstProvider}" row above carries the provider's own error. Scheduled rituals never mention failover, so this runs for weeks unnoticed.`
        : `THIS IS THE "${worstProvider}" ROW ABOVE, not a separate fault: ${worstProvider} has no key on this service, so every call the router sends there lands on a substitute model. Fix that row and this one clears on its own.`);
  } catch (e: any) {
    return fail("engines", "failover", `couldn't read the call log: ${e?.message ?? e}`, "see the backend log");
  }
}

/**
 * The public origin, derived from what we already know. The report printed the
 * real domain on the "redirect uri" line and then, four lines later, told Cole
 * to open `https://<backend-domain>/api/calendar/auth` — a literal placeholder,
 * in Telegram, where he can't substitute anything. These auth routes are in
 * AUTH_EXEMPT, so a plain browser tap works.
 */
function publicOrigin(): string | null {
  const r = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (r) {
    try { return new URL(r).origin; } catch { /* fall through */ }
  }
  const d = process.env.RAILWAY_PUBLIC_DOMAIN?.trim(); // Railway injects this
  return d ? `https://${d}` : null;
}
const authUrl = (p: string): string =>
  `${publicOrigin() ?? `http://localhost:${process.env.PORT || 3001}`}${p}`;

// ── Google (calendar + gmail) ────────────────────────────────────────
// The subtle one: a stored refresh token is bound to the CLIENT that
// minted it. Swap OAuth clients (desktop → web) and every stored token
// dies with `invalid_grant`, which reads like "Google is broken".

async function checkGoogle(): Promise<Check[]> {
  const out: Check[] = [];
  const id = env("GOOGLE_CLIENT_ID");
  const secret = env("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) {
    // NEVER return early here. The old version dropped FIVE rows at once
    // (redirect uri, calendar, gmail, gmail redirect, consent screen) — and a
    // missing row reads as "fine", which is the failure this file exists for.
    out.push(dormant("google", "credentials", "GOOGLE_CLIENT_ID/SECRET not set",
      "add both from the Google Cloud Console OAuth client (it must be a WEB application client — a Desktop client cannot register an https redirect)"));
    for (const n of ["redirect uri", "calendar", "gmail", "gmail redirect uri", "sheets auth"]) {
      out.push(dormant("google", n, "waiting on GOOGLE_CLIENT_ID/SECRET", ""));
    }
    return out;
  }
  out.push(ok("google", "credentials", `client configured (…${id.slice(-14)})`));

  // Validate the redirect PROPERLY. "not localhost" passed a URI pointing at
  // the frontend service, or one missing the callback path — and this string
  // is the root of the whole OAuth failure class.
  const redirect = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!redirect) {
    out.push(fail("google", "redirect uri", "GOOGLE_REDIRECT_URI not set — Connect will send your browser to localhost",
      `set GOOGLE_REDIRECT_URI=${authUrl("/api/calendar/callback")} and register that EXACT string in the Google Console`));
  } else {
    let bad = "";
    try {
      const u = new URL(redirect);
      if (u.protocol !== "https:") bad = "Google requires https for a Web client";
      else if (u.pathname !== "/api/calendar/callback") bad = `path is "${u.pathname}", must be exactly /api/calendar/callback`;
    } catch { bad = "not a valid URL"; }
    out.push(bad
      ? fail("google", "redirect uri", `${redirect} — ${bad}`,
          "point GOOGLE_REDIRECT_URI at the BACKEND service's public domain + /api/calendar/callback, and register that exact string in the Google Console — it must match character for character, trailing slash included")
      : ok("google", "redirect uri", redirect));
  }

  // CALENDAR — with a READ-ONLY probe. The old check used a forced refresh,
  // which DISCONNECTS the token on invalid_grant: running /doctor deleted the
  // thing it was diagnosing, so the second run always said "never connected"
  // and the real failure moved into the quiet bucket.
  let calendarDead = false;
  try {
    const { isCalendarConnected, probeRefresh } = await import("../calendar/googleAuth.ts");
    if (!(await isCalendarConnected())) {
      out.push(dormant("google", "calendar", "no stored token — never connected, or a dead one was cleared",
        `open ${authUrl("/api/calendar/auth")} once and approve`));
    } else {
      const probe = await probeRefresh();
      if (probe.ok) {
        out.push(ok("google", "calendar", "live — refresh token works"));
      } else if (probe.error === "invalid_client") {
        // Completely different fix from invalid_grant, and re-connecting can
        // never resolve it. Worth its own branch.
        calendarDead = true;
        out.push(fail("google", "calendar", "Google rejected the CLIENT, not the token (invalid_client)",
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are from different OAuth clients, or the secret was rotated. Re-connecting will NOT fix this — correct the pair in Railway variables first, then re-connect."));
      } else {
        calendarDead = true;
        out.push(fail("google", "calendar", `stored token REJECTED — Google says: ${probe.error}`,
          `Most likely on a fresh deploy: the OAuth consent screen is still in TESTING, where Google expires every refresh token after 7 days — publish it at console.cloud.google.com → OAuth consent screen. ` +
            `Otherwise the token was minted by a DIFFERENT client (a desktop → web swap does this) or access was revoked. Either way, re-connect at ${authUrl("/api/calendar/auth")}`));
      }
    }
  } catch (e: any) {
    out.push(fail("google", "calendar", `check threw: ${e?.message ?? e}`, "this is a code/deploy error, not a config choice — see the backend log"));
  }

  // GMAIL — its own token AND its own redirect var.
  let gmailDead = false;
  try {
    const { gmailAuth } = await import("../gmail/engine.ts");
    if (!(await gmailAuth.isConnected())) {
      out.push(dormant("google", "gmail", "not connected", `optional — open ${authUrl("/api/gmail/auth")} to enable inbox triage`));
    } else {
      // probeRefresh, not isHealthy: isHealthy can return true off a CACHED
      // access token with no network call, so a revoked grant reported "live"
      // for up to an hour.
      const probe = await gmailAuth.probeRefresh();
      if (probe.ok) {
        out.push(ok("google", "gmail", "live — refresh token works"));
      } else {
        gmailDead = true;
        out.push(fail("google", "gmail", `stored token REJECTED — Google says: ${probe.error}`,
          `re-connect at ${authUrl("/api/gmail/auth")}. Gmail holds its OWN token and its OWN redirect var, separate from the calendar's — check the row below first.`));
      }
    }
  } catch (e: any) {
    out.push(fail("google", "gmail", `module failed to load: ${e?.message ?? e}`,
      "this is a code/deploy error, not a config choice — see the backend log"));
  }

  // The gmail redirect var, OUTSIDE the try above so a gmail module error
  // can't swallow it. Dormant only when it isn't blocking anything.
  const gmailRedirect = process.env.GOOGLE_GMAIL_REDIRECT_URI?.trim();
  if (!gmailRedirect) {
    // NOT a choice when the token above is dead: this var is the door. Without
    // it /api/gmail/auth bounces the browser to localhost, so the fix printed
    // on the gmail FAIL cannot possibly succeed.
    const blocking = gmailDead;
    out.push((blocking ? fail : dormant)("google", "gmail redirect uri",
      blocking
        ? "GOOGLE_GMAIL_REDIRECT_URI not set — AND the Gmail token above is dead. Gmail CANNOT be re-connected until this is set: the consent screen would send your browser to localhost."
        : "GOOGLE_GMAIL_REDIRECT_URI not set — falls back to localhost",
      `set GOOGLE_GMAIL_REDIRECT_URI=${authUrl("/api/gmail/callback")} and add that EXACT URI to the same Web OAuth client in the Google Console (it is a SEPARATE var from GOOGLE_REDIRECT_URI), then open ${authUrl("/api/gmail/auth")}`));
  } else if (gmailRedirect.includes("localhost")) {
    out.push(fail("google", "gmail redirect uri", `points at localhost: ${gmailRedirect}`,
      `on a hosted deploy this must be ${authUrl("/api/gmail/callback")}`));
  } else {
    out.push(ok("google", "gmail redirect uri", gmailRedirect));
  }

  // Consent screen: only worth a row when a Google token is actually dead —
  // otherwise it was unconditional, unactionable noise. When it IS relevant
  // it's the single likeliest cause, so it gets named as such.
  if (calendarDead || gmailDead) {
    out.push(fail("google", "consent screen", "unverifiable from the API — and it is the #1 cause of the dead Google token(s) above",
      "console.cloud.google.com → APIs & Services → OAuth consent screen. If Publishing status is TESTING, Google expires every refresh token after 7 days — press PUBLISH APP, then re-connect. Re-connecting without publishing buys you another 7 days and nothing more."));
  }

  // SHEETS rides the calendar token — so it must actually follow it. The old
  // row said "health follows the calendar token above" and then printed a
  // green tick while that token was rejected.
  out.push(checkSheets(out.find((c) => c.name === "calendar")));
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
    if (!j?.ok) return fail("telegram", "bot", `rejected: ${j?.description ?? res.status}`, "re-copy TELEGRAM_BOT_TOKEN from BotFather");
    const username = j.result?.username ?? "bot";

    // getMe only proves the token PARSES. The real failure mode is "the bot is
    // live but never answers": a leftover webhook, or a second poller (a stray
    // codespace backend) stealing the updates. getWebhookInfo sees both.
    try {
      const wh = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { signal: AbortSignal.timeout(15_000) });
      const w: any = await wh.json().catch(() => ({}));
      if (w?.ok && w.result?.url) {
        return fail("telegram", "bot", `@${username} has a WEBHOOK registered (${w.result.url}) — long-polling can't receive anything while one is set`,
          `delete it: curl https://api.telegram.org/bot<token>/deleteWebhook`);
      }
      const lastErr = w?.result?.last_error_message;
      if (lastErr) {
        return fail("telegram", "bot", `@${username} — Telegram's last delivery error: ${lastErr}`,
          "a 409 here means a SECOND process is polling the same bot token (usually a codespace backend left running). Stop the other one.");
      }
    } catch { /* the getMe result stands on its own */ }
    return ok("telegram", "bot", `live — @${username}, long-polling with no webhook conflict`);
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
    // index.ts sets process.env.TZ from AURELIUS_TZ only when TZ is UNSET — so
    // an externally-set TZ silently wins for everything using local time while
    // this row still printed a confident tick. Catch the disagreement.
    const processTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (processTz && processTz !== tz) {
      return fail("core", "timezone",
        `AURELIUS_TZ=${tz} but the process is actually running in ${processTz} — every ritual fires on the wrong clock`,
        `TZ is set to something else and wins. Set TZ=${tz} alongside AURELIUS_TZ on this service, or remove the conflicting TZ.`);
    }
    return ok("core", "timezone", `${tz} — local time reads ${now}`);
  } catch {
    return fail("core", "timezone", `AURELIUS_TZ="${tz}" is not a valid IANA zone`, "use a zone like America/Phoenix");
  }
}

function checkWebSearch(): Check {
  // Tavily has no free health endpoint — a probe would burn a search credit,
  // so this row says "configured", not "verified". Say which it is.
  if (env("TAVILY_API_KEY")) return ok("research", "web search", "Tavily configured (not probed — no free health endpoint; a real search proves it)");
  if (env("GEMINI_API_KEY")) return ok("research", "web search", "live — Gemini grounding (the gemini key above was probed)");
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
  // The rest of the roster — every provider and integration, probed in
  // parallel. None of these may be silently omitted: a missing row reads as
  // "fine" and that is exactly the failure mode this whole file exists for.
  const [optional, fred, paperless, instagram] = await Promise.all([
    Promise.all(checkOptionalEngineKeys()),
    checkFred(),
    checkPaperless(),
    checkInstagram(),
  ]);
  const paths = checkIngestPaths();
  const checks: Check[] = [
    db,
    checkLock(),
    checkTimezone(),
    ...paths.filter((c) => c.area === "core"),
    anthropic,
    openai,
    gemini,
    ...optional,
    ...(failover ? [failover] : []),
    embeddings,
    ...(geometry ? [geometry] : []),
    ...google,
    telegram,
    checkWebSearch(),
    fred,
    ...paths.filter((c) => c.area === "data"),
    paperless,
    instagram,
  ];
  const failed = checks.filter((c) => c.status === "fail");
  const dormantCount = checks.filter((c) => c.status === "dormant").length;
  // "by choice" is a claim about Cole's intent. Only say it about things that
  // genuinely are optional — never about a subsystem that failed into silence.
  const summary = failed.length
    ? `${failed.length} thing(s) BROKEN: ${failed.map((c) => c.name).join(", ")}. ${dormantCount} not configured.`
    : `Everything configured is working. ${dormantCount} not configured.`;
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
    // PRINT EVERY FIX, not just the failures. Half this file's fix strings were
    // computed and silently discarded — including the single most useful
    // sentence in Cole's whole report ("set ANTHROPIC_API_KEY on the BACKEND
    // service"). A dormant row with no guidance reads as content-free noise,
    // which is why the report looked thin.
    if (c.fix?.trim()) lines.push(`      → ${c.fix}`);
  }
  return `${result.summary}\n${lines.join("\n")}`;
}
