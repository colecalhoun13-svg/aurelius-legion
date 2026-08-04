// aurelius/core/preflight.ts
//
// ONE LINE PER SUBSYSTEM, AT BOOT.
//
// Hard rule 4 ("boot dormant, log one line") was honoured by the integrations
// and quietly skipped by the engines, embeddings, and research tiers. That is
// the root reason Cole's first deploy could be broken in four places at once
// with a clean-looking log: retrieval silently disabled, research with no live
// web tier, a rejected Anthropic key failing over to OpenAI, a Google token
// dead since an OAuth client swap.
//
// This is CHEAP and SYNCHRONOUS — config-shape only, no network calls, so it
// never delays boot. It answers "what did this process wake up with?".
// For "does it actually WORK", the doctor makes the real calls:
//   GET /api/health/doctor   ·   cd aurelius && npx tsx scripts/doctor.ts

function set(name: string): boolean {
  return !!process.env[name]?.trim();
}

export function preflight(): void {
  const lines: string[] = [];

  // ── LLM providers, in the router's failover order ──
  const providers: Array<[string, string]> = [
    ["anthropic", "ANTHROPIC_API_KEY"],
    ["openai", "OPENAI_API_KEY"],
    ["groq", "GROQ_API_KEY"],
    ["gemini", "GEMINI_API_KEY"],
    ["deepseek", "DEEPSEEK_API_KEY"],
    ["xai", "XAI_API_KEY"],
  ];
  const live = providers.filter(([, k]) => set(k)).map(([n]) => n);
  lines.push(
    live.length
      ? `[preflight] llm: ${live.join(" → ")} (failover order)`
      : `[preflight] llm: NONE CONFIGURED — every reasoning call will fail honestly. Set ANTHROPIC_API_KEY.`
  );

  // ── Embeddings: the silent one ──
  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider === "mock") {
    lines.push("[preflight] embeddings: MOCK — recall is hash-based, not semantic (fine locally, wrong in production)");
  } else if (provider === "openai" || provider === "gemini") {
    const keyName = provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
    lines.push(
      set(keyName)
        ? `[preflight] embeddings: ${provider} — semantic recall live`
        : `[preflight] embeddings: DISABLED — EMBEDDINGS_PROVIDER=${provider} with no ${keyName}. Recall, /ask sources, semantic reuse and precedent are all OFF.`
    );
  } else {
    lines.push(`[preflight] embeddings: DISABLED — unknown EMBEDDINGS_PROVIDER "${provider}" (use openai, gemini, or mock)`);
  }

  // ── Live web (research Tier 2 + the web tool) ──
  const webBackend = set("TAVILY_API_KEY") ? "tavily" : set("GEMINI_API_KEY") ? "gemini grounding" : null;
  lines.push(
    webBackend
      ? `[preflight] web search: ${webBackend}`
      : "[preflight] web search: dormant — research runs model-only and says so (add TAVILY_API_KEY or GEMINI_API_KEY)"
  );

  // ── Research tiers ──
  lines.push(
    `[preflight] research tiers: llm · open sources (keyless, always on)` +
      `${webBackend ? " · live web" : ""}${set("SERPAPI_KEY") || set("SERP_API_KEY") ? " · serpapi" : ""}`
  );

  // ── Google ──
  if (set("GOOGLE_CLIENT_ID") && set("GOOGLE_CLIENT_SECRET")) {
    const redirect = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (!redirect) {
      lines.push("[preflight] google: credentials set, GOOGLE_REDIRECT_URI is NOT — Connect will send you to localhost");
    } else if (redirect.includes("localhost") && process.env.NODE_ENV === "production") {
      lines.push(`[preflight] google: GOOGLE_REDIRECT_URI points at localhost (${redirect}) — cannot work on a hosted deploy`);
    } else {
      lines.push(`[preflight] google: configured → ${redirect}`);
    }
  } else {
    lines.push("[preflight] google: dormant — no GOOGLE_CLIENT_ID/SECRET");
  }

  // ── The lock ──
  lines.push(
    set("AURELIUS_API_KEY")
      ? "[preflight] api lock: armed"
      : "[preflight] api lock: OPEN — AURELIUS_API_KEY is not set. Anything that can reach this port can write grants."
  );

  // ── Clock (every ritual hangs off this) ──
  const tz = process.env.AURELIUS_TZ?.trim() || process.env.TZ?.trim();
  lines.push(
    tz
      ? `[preflight] timezone: ${tz}`
      : "[preflight] timezone: UNSET — rituals will fire on the container's UTC clock, not yours. Set AURELIUS_TZ."
  );

  for (const l of lines) console.log(l);
  console.log("[preflight] deeper check (live probes, with fixes): GET /api/health/doctor");
}
