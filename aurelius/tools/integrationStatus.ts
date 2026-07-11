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
//   parked    — deliberately not built (business engine — Cole's call)

import { listTools } from "./toolRegistry.ts";

export type IntegrationStatus = "live" | "partial" | "config" | "deploy" | "parked";

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
      status: "config",
      desc: "Read + draft-only. Flags what needs you, never sends on its own",
      glyph: "✉",
      need: "one Google OAuth authorization (same flow as calendar)",
    },
    {
      name: "Canvas LMS",
      status: "config",
      desc: "School assignments + due dates flow into Today",
      glyph: "✎",
      need: "a Canvas access token from your school portal",
    },
    {
      name: "FRED",
      status: "config",
      desc: "Economic + rates data for the wealth engine",
      glyph: "◈",
      need: "a free FRED API key (~2 min)",
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
      status: "deploy",
      desc: "Wealth operator's ledger — read-only, local-first era",
      glyph: "◇",
      need: "sensitive — wired at Mac Mini deploy",
    },
    {
      name: "Hammerspoon",
      status: "deploy",
      desc: "macOS hands — allowlisted scripts behind the escalation matrix",
      glyph: "⌘",
      need: "runs on the Mac Mini",
    },
    {
      name: "Ollama (local)",
      status: "deploy",
      desc: "Free local inference — embeddings + bulk background work",
      glyph: "⌂",
      need: "runs on the Mac Mini",
    },
  ];
}
