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
  const telegramLive = has("TELEGRAM_BOT_TOKEN") && has("TELEGRAM_CHAT_ID");
  const voiceLive = has("GROQ_API_KEY");
  const sheetsLive = registered.has("google_sheets") && has("GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH");

  let calendarLive = false;
  try {
    const { isCalendarConnected, isCalendarConfigured } = await import("../calendar/googleAuth.ts");
    calendarLive = isCalendarConfigured() && (await isCalendarConnected());
  } catch {
    /* calendar module unavailable → not live */
  }

  // Gmail: derive live status the same way as calendar (don't hardcode).
  let gmailLive = false;
  try {
    const { gmailAuth } = await import("../gmail/engine.ts");
    gmailLive = registered.has("gmail") && (await gmailAuth.isConnected());
  } catch {
    /* gmail module unavailable → not live */
  }

  const fredLive = registered.has("fred") && has("FRED_API_KEY");
  const visionLive = has("GEMINI_API_KEY");

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
      need: calendarLive ? undefined : "one-time auth at /api/calendar/auth",
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
      name: "Google Sheets",
      status: sheetsLive ? "live" : "config",
      desc: "Reads athlete sessions, writes feedback + PRs back (training engine)",
      glyph: "▦",
      need: sheetsLive ? undefined : "GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH",
    },
    {
      name: "Planning",
      status: registered.has("planning") ? "live" : "config",
      desc: "Weekly session, overload detection, goal decomposition, candidates",
      glyph: "◱",
    },
    {
      name: "Gmail",
      status: gmailLive ? "live" : "config",
      desc: "Read + draft-only. Flags what needs you, never sends on its own",
      glyph: "✉",
      need: gmailLive ? undefined : "one Google OAuth authorization at /api/gmail/auth",
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
      need: embLive ? undefined : "set EMBEDDINGS_PROVIDER=gemini + a Gemini key, then re-embed",
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
      name: "Instagram Graph",
      status: "parked",
      desc: "Content operator's eyes — analytics, trends, drafts",
      glyph: "▣",
      need: "business engine — parked for your working session",
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
      name: "Ollama (local)",
      status: "planned",
      desc: "Free local inference — embeddings + bulk background work",
      glyph: "⌂",
      need: "not built yet — the adapter slots in at Mac Mini deploy",
    },
    {
      name: "MCP connectors",
      status: "parked",
      desc: "Plug into the tool ecosystem (Notion, files, more) — gated by the grant system",
      glyph: "⧉",
      need: "a near-term block; best on the Mac Mini so servers run local",
    },
  ];
}
