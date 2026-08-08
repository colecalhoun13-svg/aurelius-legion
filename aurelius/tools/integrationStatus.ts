// aurelius/tools/integrationStatus.ts
//
// THE TOOLS PAGE, TRUTHFUL. Status is DERIVED from real state — the Tool
// Engine registry, environment config, and live connection checks — not
// a hardcoded roadmap that drifts the moment something ships. If the map
// ever disagrees with reality again, it's a bug in here, not stale copy.
//
// Status ladder:
//   live      — registered/configured and working right now
//   partial   — working but not fully wired (e.g. keyless research)
//   config    — built, waiting on one credential from Cole
//   deploy    — built, wakes on the Mac Mini
//   planned   — designed, NOT built yet (no code) — honest about the gap
//   parked    — deliberately not built (business engine — Cole's call)

import { listTools } from "./toolRegistry.ts";

export type IntegrationStatus = "live" | "partial" | "config" | "deploy" | "planned" | "parked";

export type Integration = {
  name: string;
  status: IntegrationStatus;
  desc: string;
  glyph: string;
  need?: string; // what unblocks it, when not live
};

export async function getIntegrations(): Promise<Integration[]> {
  const registered = new Set(listTools().map((t) => t.name));

  const has = (k: string) => !!process.env[k]?.trim();

  // TRUTHFUL GOOGLE (deploy triage): every Google row below used to mean
  // "a token row exists", which stays true forever after an OAuth client
  // swap while every actual call fails. One probe, shared by Calendar and
  // Sheets (same login), that mints an access token — refreshing a stale
  // one, and reporting false when the refresh token is dead.
  let googleHealthy = false;
  let googleHasRow = false;
  try {
    const { isCalendarHealthy, isCalendarConnected } = await import("../calendar/googleAuth.ts");
    googleHasRow = await isCalendarConnected();
    googleHealthy = googleHasRow && (await isCalendarHealthy());
  } catch {
    /* calendar module unavailable → not live */
  }
  const telegramLive = has("TELEGRAM_BOT_TOKEN") && has("TELEGRAM_CHAT_ID");
  const voiceLive = has("GROQ_API_KEY");
  // Sheets is live via Cole's own Google login (once re-authorized for Sheets)
  // OR the legacy service account.
  const sheetsLive =
    registered.has("google_sheets") && (googleHealthy || has("GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH"));

  const calendarLive = googleHealthy;
  // A stored-but-dead token is its own state: the fix is a re-connect, not
  // a first-time setup, and saying so is the difference between two minutes
  // and an evening.
  const googleTokenDead = googleHasRow && !googleHealthy;

  // Gmail rides the same OAuth client but its own token — probe it too.
  let gmailLive = false;
  let gmailTokenDead = false;
  try {
    const { gmailAuth } = await import("../gmail/engine.ts");
    const connected = registered.has("gmail") && (await gmailAuth.isConnected());
    gmailLive = connected && (await gmailAuth.isHealthy());
    gmailTokenDead = connected && !gmailLive;
  } catch {
    /* gmail module unavailable → not live */
  }

  const fredLive = registered.has("fred") && has("FRED_API_KEY");
  const visionLive = has("GEMINI_API_KEY");
  // Instagram: connected via OAuth (stored creds) OR the manual env token.
  let igConnected = false;
  try {
    const { isInstagramConnected } = await import("../instagram/auth.ts");
    igConnected = await isInstagramConnected();
  } catch {
    igConnected = has("INSTAGRAM_ACCESS_TOKEN") && has("INSTAGRAM_BUSINESS_ID");
  }
  const igAppConfigured =
    has("INSTAGRAM_APP_ID") || has("META_APP_ID") || (has("INSTAGRAM_ACCESS_TOKEN") && has("INSTAGRAM_BUSINESS_ID"));
  const instagramLive = registered.has("content") && igConnected;
  // Publishing needs a public URL for the image, not just a token.
  const { isMediaHostConfigured } = await import("../media/host.ts");
  const mediaHosted = isMediaHostConfigured();
  const webLive = registered.has("web") && (has("TAVILY_API_KEY") || has("GEMINI_API_KEY"));

  // Memory/recall: what's actually powering semantic recall right now.
  const embProvider = (process.env.EMBEDDINGS_PROVIDER ?? "openai").trim().toLowerCase();
  const embLive =
    (embProvider === "gemini" && has("GEMINI_API_KEY")) ||
    (embProvider === "openai" && has("OPENAI_API_KEY")) ||
    embProvider === "ollama";
  const embMock = embProvider === "mock";

  return [
    {
      name: "Google Calendar",
      status: calendarLive ? "live" : registered.has("google_calendar") ? "config" : "config",
      desc: "Read/write events, availability scanning, calendar-aware planning",
      glyph: "▤",
      need: calendarLive
        ? undefined
        : googleTokenDead
          ? "your stored Google token was REJECTED (usually: the OAuth client changed, access was revoked, or the consent screen is still in Testing — those tokens die after 7 days). Re-connect at /api/calendar/auth"
          : "one-time auth at /api/calendar/auth",
    },
    {
      name: "Telegram",
      status: telegramLive ? "live" : "config",
      desc: "Aurelius in your pocket — briefings, capture, /plan, /cal, two-way chat",
      glyph: "✈",
      need: telegramLive ? undefined : "TELEGRAM_BOT_TOKEN + chat id",
    },
    {
      name: "Voice notes (Whisper)",
      status: voiceLive ? "live" : "config",
      desc: "Telegram voice → transcription → capture. Talk to the second brain",
      glyph: "◉",
      need: voiceLive ? undefined : "GROQ_API_KEY (free tier works); local whisper.cpp at deploy",
    },
    {
      name: "Research APIs",
      status: "live",
      desc: "arXiv · PubMed · Semantic Scholar · OpenAlex — keyless, always on",
      glyph: "❉",
    },
    {
      name: "Live web search",
      status: webLive ? "live" : "config",
      desc: "Real-time search (grounded, with sources) + page fetch — no more fabricated trends",
      glyph: "⌕",
      need: webLive ? undefined : "GEMINI_API_KEY (you have it) or a free TAVILY_API_KEY",
    },
    {
      name: "Google Sheets",
      status: sheetsLive ? "live" : "config",
      desc: "Reads athlete sessions by name, writes feedback + PRs back (training engine)",
      glyph: "▦",
      need: sheetsLive
        ? undefined
        : googleTokenDead
          ? "same dead Google token as Calendar — re-connect at /api/calendar/auth and Sheets comes back with it"
          : "re-authorize Google at /api/calendar/auth (adds Sheets to your login) — then just name an athlete",
    },
    {
      name: "Planning",
      status: registered.has("planning") ? "live" : "config",
      desc: "Plan the day/week, overload detection, goal decomposition — plus change or pause ritual times from chat",
      glyph: "◱",
    },
    {
      name: "Productivity",
      status: registered.has("productivity") ? "live" : "config",
      desc: "Tasks, goals, and today's focus from chat — add/complete tasks, add goals, set focus, 'what's on today'",
      glyph: "☑",
    },
    {
      name: "Autonomy grants",
      status: registered.has("autonomy") ? "live" : "config",
      desc: "Manage keyholes conversationally — list, revoke (instant), or grant (files a Bridge confirm; the switch stays your hand)",
      glyph: "⚿",
    },
    {
      name: "Gmail",
      status: gmailLive ? "live" : "config",
      desc: "Read + draft-only. Flags what needs you, never sends on its own",
      glyph: "✉",
      need: gmailLive
        ? undefined
        : gmailTokenDead
          ? "your stored Gmail token was REJECTED — re-connect at /api/gmail/auth (Gmail has its OWN token AND its own GOOGLE_GMAIL_REDIRECT_URI, separate from the calendar's)"
          : "one Google OAuth authorization at /api/gmail/auth",
    },
    {
      name: "Vision (photos & video)",
      status: visionLive ? "live" : "config",
      desc: "Attach a photo/video in chat — Aurelius reads it, describes it, remembers it",
      glyph: "◎",
      need: visionLive ? undefined : "GEMINI_API_KEY (free); big athlete-film analysis at deploy",
    },
    {
      name: "Memory / recall",
      status: embLive ? "live" : embMock ? "partial" : "config",
      desc: embMock
        ? "Running on MOCK embeddings — recall is not semantic yet"
        : `Semantic recall via ${embProvider} embeddings`,
      glyph: "❈",
      need: embLive
        ? undefined
        : `EMBEDDINGS_PROVIDER=${embProvider} has no matching key — set ${embProvider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} (or switch provider), then re-embed with scripts/backfillEmbeddings.ts --force`,
    },
    {
      name: "Canvas LMS",
      status: "planned",
      desc: "School assignments + due dates flow into Today",
      glyph: "✎",
      need: "not built yet — say the word (you noted you didn't need it yet)",
    },
    {
      name: "FRED",
      status: fredLive ? "live" : "config",
      desc: "Economic + rates data for the wealth engine",
      glyph: "◈",
      need: fredLive ? undefined : "a free FRED API key (~2 min)",
    },
    {
      name: "Ingest folder",
      status: has("INGEST_WATCH_DIR") ? "live" : "config",
      desc: "Drop a file (.md/.txt/.pdf) in one folder — the brain learns it within 10 min, no LLM in the loop",
      glyph: "▽",
      need: has("INGEST_WATCH_DIR") ? undefined : "set INGEST_WATCH_DIR to a drop folder (not the vault) and restart",
    },
    {
      name: "YouTube transcripts",
      status: "partial",
      desc: "Paste a video link in chat — Aurelius pulls the transcript and ingests it",
      glyph: "▶",
      need: "best-effort here (YouTube blocks many server IPs) — fully reliable from the Mac Mini's home connection",
    },
    {
      name: "Paperless-ngx",
      status: "deploy",
      desc: "Scanned documents → OCR → second brain, every 10 min",
      glyph: "▥",
      need: "runs on the Mac Mini / NAS",
    },
    {
      name: "RSS feeds",
      status: "config",
      desc: "Standing reading feeds → daily digests into the corpus",
      glyph: "⟳",
      need: "name your feeds in one conversation (research.rss_feeds)",
    },
    {
      name: "Content / Instagram",
      // A connected Instagram is NOT a publishable Instagram. Meta fetches the
      // image from a public URL, so without a media host the publish call
      // cannot complete — reporting "live" there would be the doctor lying
      // about a lane that fails on first use.
      status: instagramLive && mediaHosted ? "live" : "config",
      desc: "Draft posts in your voice (inward), read live metrics (reach/engagement/followers), and publish — outward, so every post stops for your one-tap confirm on the Bridge",
      glyph: "▣",
      need: !instagramLive
        ? igAppConfigured
          ? "one click to connect at /api/instagram/auth"
          : "create a Meta app → INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET, then connect at /api/instagram/auth (docs/SETUP_AND_LAUNCH.md). Drafting works keyless now."
        : !mediaHosted
          ? "Instagram is connected, but publishing also needs somewhere to serve the image from — Meta fetches it by URL and cannot accept an upload. Set MEDIA_PUBLIC_BASE_URL to the origin Aurelius is reachable at (this lands with the Mac Mini). Drafting and metrics work now."
          : undefined,
    },
    {
      name: "Cal.com (self-hosted)",
      status: "parked",
      desc: "Owned booking — athletes book, pipeline visible",
      glyph: "◷",
      need: "business engine — parked for your working session",
    },
    {
      name: "Plaid / SimpleFIN",
      status: "planned",
      desc: "Wealth operator's ledger — read-only, local-first era",
      glyph: "◇",
      need: "not built yet — sensitive; build at Mac Mini deploy",
    },
    {
      name: "Hammerspoon",
      status: "planned",
      desc: "macOS hands — allowlisted scripts behind the grant system",
      glyph: "⌘",
      need: "not built yet — build at Mac Mini deploy, gated by grants",
    },
    {
      name: "Sentry",
      status: "planned",
      desc: "Error tracking with stack traces, both services — 'why did it break' without reading logs",
      glyph: "⚠",
      need: "not built yet — Cole-approved for the Mac Mini deploy (free tier, SENTRY_DSN each side)",
    },
    {
      name: "MinIO media store",
      status: "planned",
      desc: "S3-compatible backend for the media host (host.ts is provider-swappable)",
      glyph: "▧",
      need: "Mac Mini deploy, CONDITIONAL — default stays local disk + NAS; adopt only if that proves insufficient",
    },
    {
      name: "Ollama (local)",
      status: "planned",
      desc: "Free local inference — embeddings + bulk background work",
      glyph: "⌂",
      need: "not built yet — the adapter slots in at Mac Mini deploy",
    },
    {
      name: "MCP connectors",
      status: "parked",
      desc: "Plug into the tool ecosystem — gated by the grant system, hardened per the frozen spec",
      glyph: "⧉",
      need: "spec frozen by council (docs/MCP_SPEC.md) — builds as part of the Mac Mini deploy's definition of done, first server: Playwright browser",
    },
  ];
}
