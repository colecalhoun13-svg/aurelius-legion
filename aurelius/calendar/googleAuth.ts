// aurelius/calendar/googleAuth.ts
//
// GOOGLE CALENDAR OAUTH (OG doc Part VIII) — zero dependencies, raw fetch.
// The flow Cole runs ONCE:
//
//   1. GET /api/calendar/auth       → redirect to Google's consent screen
//   2. Google redirects back to     GOOGLE_REDIRECT_URI
//   3. Callback exchanges the code for tokens; the refresh token persists
//      in the DB and access tokens mint themselves forever after.
//
// CLIENT TYPE (this cost a deploy): a "Desktop app" client accepts any
// http://localhost port with no registration, which is why local dev never
// needed GOOGLE_REDIRECT_URI. A hosted deploy needs a **Web application**
// client with the exact public https callback registered — and a refresh
// token is bound to the client that minted it, so swapping desktop → web
// kills every stored token with `invalid_grant`. That is a re-connect, not
// a bug. Publish the consent screen too: in "Testing" Google expires
// refresh tokens after 7 days.
//
// Token storage: a KnowledgeEntry (system.google_calendar_tokens on the
// global operator) written with RAW prisma — deliberately bypassing
// setKnowledge() so the token is never embedded into the vector index or
// surfaced by semantic recall. Credentials are not knowledge.

import { prisma } from "../core/db/prisma.ts";
import { google } from "googleapis";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
// One Google login covers Calendar AND Sheets — so Aurelius reads/writes Cole's
// own athlete sheets AS HIM (no service account, no per-sheet sharing). Adding
// scopes means re-authorizing once at /api/calendar/auth to grant them.
const SCOPE = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets", // read + write cells
  "https://www.googleapis.com/auth/drive.readonly", // find sheets by name in his Drive
].join(" ");
const TOKEN_SCOPE = "system";
const TOKEN_KEY = "google_calendar_tokens";

type StoredTokens = {
  refresh_token: string;
  access_token: string;
  expires_at: number; // epoch ms
};

function clientConfig(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

export function isCalendarConfigured(): boolean {
  return clientConfig() !== null;
}

let warnedLocalhostRedirect = false;

export function redirectUri(): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  // Hosted with no explicit URI = the Connect button sends Cole's browser to
  // HIS OWN machine. Say so once instead of letting it fail as a mystery.
  if (process.env.NODE_ENV === "production" && !warnedLocalhostRedirect) {
    warnedLocalhostRedirect = true;
    console.warn(
      "[calendar] GOOGLE_REDIRECT_URI is not set — falling back to localhost, which cannot work on a hosted deploy. " +
        "Set GOOGLE_REDIRECT_URI=https://<backend-domain>/api/calendar/callback and register that exact URI on the Web OAuth client."
    );
  }
  return `http://localhost:${process.env.PORT || 3001}/api/calendar/callback`;
}

/**
 * The Sheets/Drive adapter caches its googleapis client for the process
 * lifetime, and building that client makes no network call — so a client
 * holding a DEAD refresh token caches perfectly and survives a re-connect.
 * Cole re-authorized, the calendar came back, and Sheets stayed broken until
 * a restart. Every token transition now drops that cache.
 */
async function invalidateGoogleClients(): Promise<void> {
  try {
    const { resetSheetsClient } = await import("../tools/adapters/googleAuth.ts");
    resetSheetsClient();
  } catch {
    /* adapter not present in this process (frontend) — nothing to drop */
  }
}

// ── Token persistence (raw prisma — never embedded) ─────────────────

async function globalOperatorId(): Promise<string | null> {
  const op = await prisma.operator.findUnique({ where: { name: "global" }, select: { id: true } });
  return op?.id ?? null;
}

async function loadTokens(): Promise<StoredTokens | null> {
  const row = await prisma.knowledgeEntry.findFirst({
    where: { scope: TOKEN_SCOPE, key: TOKEN_KEY, active: true },
  });
  const v = row?.value as any;
  return v?.refresh_token ? (v as StoredTokens) : null;
}

async function storeTokens(tokens: StoredTokens): Promise<void> {
  const opId = await globalOperatorId();
  if (!opId) throw new Error("global operator missing — run the seed");
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId: opId, scope: TOKEN_SCOPE, key: TOKEN_KEY } },
    create: {
      operatorId: opId,
      scope: TOKEN_SCOPE,
      key: TOKEN_KEY,
      value: tokens as any,
      sourceType: "system",
      sourceId: "google_oauth",
      rationale: "Google Calendar OAuth tokens (credential — not indexed)",
      createdBy: "aurelius",
      updatedBy: "aurelius",
      version: 1,
      active: true,
      history: [],
    },
    update: { value: tokens as any, updatedBy: "aurelius", active: true },
  });
}

/**
 * Does the stored Google token still WORK? `isCalendarConnected()` only
 * proves a row exists — after an OAuth client swap the row is there and
 * every call fails, which is how the Tools page reported Calendar/Sheets/
 * Gmail "live" while nothing worked. This mints an access token (refreshing
 * a stale one), so a dead refresh token reports false.
 */
export async function isCalendarHealthy(): Promise<boolean> {
  try {
    return (await getAccessToken()) !== null;
  } catch {
    return false;
  }
}

export async function isCalendarConnected(): Promise<boolean> {
  try {
    return (await loadTokens()) !== null;
  } catch {
    return false;
  }
}

export async function disconnectCalendar(): Promise<void> {
  const opId = await globalOperatorId();
  if (!opId) return;
  await prisma.knowledgeEntry.updateMany({
    where: { operatorId: opId, scope: TOKEN_SCOPE, key: TOKEN_KEY },
    data: { active: false },
  });
  cachedAccess = null;
  await invalidateGoogleClients();
}

// ── The flow ─────────────────────────────────────────────────────────

/** Step 1: the consent URL Cole opens once. Null when creds are missing.
 *  `state` is the login-CSRF guard the callback verifies (go-live council). */
export function buildAuthUrl(state?: string): string | null {
  const cfg = clientConfig();
  if (!cfg) return null;
  const params = new URLSearchParams({
    client_id: cfg.id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // → refresh token
    prompt: "consent",      // → refresh token EVERY time, even on re-auth
    ...(state ? { state } : {}),
  });
  return `${AUTH_URL}?${params}`;
}

/** Step 3: code → tokens, persisted. Returns an error string on failure. */
export async function handleOAuthCallback(code: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = clientConfig();
  if (!cfg) return { ok: false, error: "GOOGLE_CLIENT_ID/SECRET not set" };
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.id,
      client_secret: cfg.secret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    return { ok: false, error: `token exchange failed: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim() };
  }
  if (!json.refresh_token) {
    return { ok: false, error: "Google returned no refresh token — revoke the app at myaccount.google.com/permissions and authorize again" };
  }
  await storeTokens({
    refresh_token: json.refresh_token,
    access_token: json.access_token,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  });
  cachedAccess = null;
  await invalidateGoogleClients(); // a re-connect must reach Sheets too
  console.log("[calendar] Google Calendar connected — refresh token stored");
  return { ok: true };
}

// ── Access tokens (auto-refresh, in-memory cache) ────────────────────

let cachedAccess: { token: string; expiresAt: number } | null = null;

async function refreshAccessToken(stored: StoredTokens): Promise<string | null> {
  const cfg = clientConfig();
  if (!cfg) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.id,
      client_secret: cfg.secret,
      refresh_token: stored.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.warn("[calendar] token refresh failed:", json.error ?? res.status, json.error_description ?? "");
    if (json.error === "invalid_grant") {
      // Refresh token revoked/expired — force a clean re-auth instead of
      // failing silently every 15 minutes.
      await disconnectCalendar();
      console.warn("[calendar] refresh token dead — disconnected; re-run /api/calendar/auth");
    }
    return null;
  }
  const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  await storeTokens({
    refresh_token: json.refresh_token ?? stored.refresh_token, // Google rarely rotates it
    access_token: json.access_token,
    expires_at: expiresAt,
  });
  cachedAccess = { token: json.access_token, expiresAt };
  return json.access_token;
}

/**
 * READ-ONLY health probe. Asks Google whether the refresh token still works
 * and changes NOTHING.
 *
 * The doctor used to diagnose the calendar with getAccessToken(true), which
 * routes through refreshAccessToken() — and that DISCONNECTS on invalid_grant.
 * So running /doctor deleted the very token it was reporting on: the first run
 * said "REJECTED", every run after said "never connected". The system appeared
 * to heal by being examined, and the real failure moved into the quiet bucket.
 *
 * Returns Google's own error code, because they mean different things:
 *   invalid_grant       → re-consent (dead token, revoked, or testing-mode expiry)
 *   invalid_client      → the CLIENT_ID/SECRET pair is wrong; re-connecting won't help
 *   unauthorized_client → the client isn't allowed this grant type
 */
export async function probeRefresh(): Promise<{ ok: boolean; error?: string }> {
  const cfg = clientConfig();
  if (!cfg) return { ok: false, error: "no_client_config" };
  const stored = await loadTokens();
  if (!stored?.refresh_token) return { ok: false, error: "no_token" };
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.id,
        client_secret: cfg.secret,
        refresh_token: stored.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (res.ok && json.access_token) return { ok: true };
    return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: `unreachable: ${e?.message ?? e}` };
  }
}

export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && cachedAccess && cachedAccess.expiresAt - Date.now() > 60_000) {
    return cachedAccess.token;
  }
  const stored = await loadTokens();
  if (!stored) return null;
  if (!forceRefresh && stored.expires_at - Date.now() > 60_000) {
    cachedAccess = { token: stored.access_token, expiresAt: stored.expires_at };
    return stored.access_token;
  }
  return refreshAccessToken(stored);
}

/**
 * A googleapis OAuth2 client authenticated AS COLE — seeded with his stored
 * refresh token so it auto-refreshes. Any Google API (Sheets, Drive) can use it,
 * which is how Aurelius reads his own sheets with zero sharing. Null when the
 * Google login isn't configured/connected (or wasn't re-authorized for Sheets).
 */
export async function getUserGoogleClient(): Promise<any | null> {
  const cfg = clientConfig();
  if (!cfg) return null;
  const stored = await loadTokens();
  if (!stored?.refresh_token) return null;
  const client = new google.auth.OAuth2(cfg.id, cfg.secret, redirectUri());
  client.setCredentials({ refresh_token: stored.refresh_token });
  return client;
}

/**
 * Authenticated fetch against the Calendar API. `path` is relative to
 * /calendar/v3 (e.g. "/calendars/primary/events?..."). Retries exactly
 * once on 401 with a forced token refresh.
 */
export async function calendarFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await getAccessToken();
  if (!token) throw new Error("Google Calendar not connected — open /api/calendar/auth");
  const url = `https://www.googleapis.com/calendar/v3${path}`;
  const doFetch = (t: string) =>
    fetch(url, {
      ...init,
      headers: { ...(init.headers as any), Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    });
  let res = await doFetch(token);
  if (res.status === 401) {
    token = await getAccessToken(true);
    if (!token) throw new Error("Google Calendar auth expired — open /api/calendar/auth");
    res = await doFetch(token);
  }
  return res;
}
