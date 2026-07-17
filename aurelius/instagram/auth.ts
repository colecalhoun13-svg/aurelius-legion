// aurelius/instagram/auth.ts
//
// INSTAGRAM OAUTH — one-click connect, mirroring the Google Calendar flow.
//   1. GET /api/instagram/auth      → Facebook Login consent screen
//   2. Meta redirects back to       http://localhost:3001/api/instagram/callback
//   3. The callback exchanges the code → a LONG-LIVED (60-day) user token,
//      auto-resolves the linked IG Business account id + Page token, and
//      persists them. getCreds() auto-refreshes the token before it expires.
//
// The one thing no code can skip: Meta requires a registered developer app
// (INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET). Once those two land in .env,
// connecting is a single click. Dormant-honest without them (hard rule 4).
//
// Tokens are a CREDENTIAL — stored with raw prisma (KnowledgeEntry, scope
// "system"), NEVER embedded into the vector index (hard rule 6).

import { prisma } from "../core/db/prisma.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";
const TOKEN_SCOPE = "system";
const TOKEN_KEY = "instagram_tokens";

// Everything Aurelius does with IG: read the account, publish (outward, gated),
// and read insights/metrics.
const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

export type StoredInstagram = {
  userToken: string; // long-lived (60-day) user token
  igUserId: string; // the IG business account id
  pageId: string;
  pageToken: string; // page token — preferred for IG content + insights ops
  username?: string;
  expiresAt: number; // ms — when userToken dies
};

function clientConfig(): { id: string; secret: string } | null {
  const id = (process.env.INSTAGRAM_APP_ID ?? process.env.META_APP_ID)?.trim();
  const secret = (process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET)?.trim();
  return id && secret ? { id, secret } : null;
}

export function isInstagramConfigured(): boolean {
  return clientConfig() !== null;
}

export function redirectUri(): string {
  return (
    process.env.INSTAGRAM_REDIRECT_URI?.trim() ||
    `http://localhost:${process.env.PORT || 3001}/api/instagram/callback`
  );
}

async function globalOperatorId(): Promise<string | null> {
  const op = await prisma.operator.findUnique({ where: { name: "global" }, select: { id: true } });
  return op?.id ?? null;
}

async function loadStored(): Promise<StoredInstagram | null> {
  const row = await prisma.knowledgeEntry.findFirst({
    where: { scope: TOKEN_SCOPE, key: TOKEN_KEY, active: true },
  });
  const v = row?.value as any;
  return v?.userToken && v?.igUserId ? (v as StoredInstagram) : null;
}

async function storeCreds(creds: StoredInstagram): Promise<void> {
  const opId = await globalOperatorId();
  if (!opId) throw new Error("global operator missing — run the seed");
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId: opId, scope: TOKEN_SCOPE, key: TOKEN_KEY } },
    create: {
      operatorId: opId,
      scope: TOKEN_SCOPE,
      key: TOKEN_KEY,
      value: creds as any,
      sourceType: "system",
      sourceId: "instagram_oauth",
      rationale: "Instagram OAuth credentials (credential — not indexed)",
      createdBy: "aurelius",
      updatedBy: "aurelius",
      version: 1,
      active: true,
      history: [],
    },
    update: { value: creds as any, updatedBy: "aurelius", active: true },
  });
}

export async function isInstagramConnected(): Promise<boolean> {
  try {
    if (await loadStored()) return true;
  } catch {
    /* fall through to env fallback */
  }
  // Legacy/manual path still counts as connected.
  return !!(process.env.INSTAGRAM_ACCESS_TOKEN?.trim() && process.env.INSTAGRAM_BUSINESS_ID?.trim());
}

export async function disconnectInstagram(): Promise<void> {
  const opId = await globalOperatorId();
  if (!opId) return;
  await prisma.knowledgeEntry.updateMany({
    where: { operatorId: opId, scope: TOKEN_SCOPE, key: TOKEN_KEY },
    data: { active: false },
  });
}

// ── The flow ─────────────────────────────────────────────────────────

/** Step 1: the consent URL Cole opens once. Null when app creds are missing. */
export function buildAuthUrl(): string | null {
  const cfg = clientConfig();
  if (!cfg) return null;
  const params = new URLSearchParams({
    client_id: cfg.id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
  });
  return `${DIALOG}?${params}`;
}

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json;
}

/**
 * Resolve the IG Business account + Page token from a user token. IG content
 * publishing and insights run against the Page that's linked to the IG business
 * account, so we find the first Page that has one.
 */
async function resolveInstagramAccount(
  userToken: string
): Promise<{ igUserId: string; pageId: string; pageToken: string; username?: string }> {
  const accounts = await graphGet("me/accounts", {
    fields: "name,access_token,instagram_business_account",
    access_token: userToken,
  });
  const pages: any[] = accounts?.data ?? [];
  const linked = pages.find((p) => p?.instagram_business_account?.id);
  if (!linked) {
    throw new Error(
      "No Instagram Business account is linked to your Facebook Pages. In Instagram: Settings → Account type → switch to Business/Creator, then link it to a Facebook Page."
    );
  }
  const igUserId = linked.instagram_business_account.id as string;
  let username: string | undefined;
  try {
    const prof = await graphGet(igUserId, { fields: "username", access_token: linked.access_token });
    username = prof?.username;
  } catch {
    /* username is a nicety */
  }
  return { igUserId, pageId: linked.id, pageToken: linked.access_token, username };
}

/** Step 3: code → long-lived token → resolved account, persisted. */
export async function handleOAuthCallback(code: string): Promise<{ ok: boolean; error?: string; username?: string }> {
  const cfg = clientConfig();
  if (!cfg) return { ok: false, error: "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET not set" };

  try {
    // code → short-lived user token
    const short = await graphGet("oauth/access_token", {
      client_id: cfg.id,
      client_secret: cfg.secret,
      redirect_uri: redirectUri(),
      code,
    });
    if (!short.access_token) return { ok: false, error: "Meta returned no access token" };

    // short-lived → long-lived (60-day) user token
    const long = await graphGet("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: cfg.id,
      client_secret: cfg.secret,
      fb_exchange_token: short.access_token,
    });
    const userToken = long.access_token as string;
    if (!userToken) return { ok: false, error: "long-lived token exchange failed" };

    const account = await resolveInstagramAccount(userToken);
    await storeCreds({
      userToken,
      expiresAt: Date.now() + (long.expires_in ?? 60 * 24 * 3600) * 1000,
      ...account,
    });
    console.log(`[instagram] connected as @${account.username ?? account.igUserId}`);
    return { ok: true, username: account.username };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

// ── Credential access (auto-refresh) ─────────────────────────────────

const REFRESH_MARGIN_MS = 7 * 24 * 3600_000; // refresh a week before expiry

/**
 * The credential every IG call uses: a token + the IG business account id.
 * Prefers stored OAuth creds (auto-refreshing the long-lived token as it nears
 * expiry); falls back to the manual env-var path for backward compatibility.
 * Returns null when neither is present (dormant).
 */
export async function getInstagramCreds(): Promise<{ token: string; igUserId: string } | null> {
  let stored: StoredInstagram | null = null;
  try {
    stored = await loadStored();
  } catch {
    stored = null;
  }

  if (stored) {
    if (stored.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
      const refreshed = await refreshCreds(stored).catch((err) => {
        console.warn("[instagram] token refresh failed (using existing until it dies):", err?.message ?? err);
        return null;
      });
      if (refreshed) stored = refreshed;
    }
    // Page token is preferred for IG content + insights.
    return { token: stored.pageToken || stored.userToken, igUserId: stored.igUserId };
  }

  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const envId = process.env.INSTAGRAM_BUSINESS_ID?.trim();
  return envToken && envId ? { token: envToken, igUserId: envId } : null;
}

/** Re-exchange the long-lived user token for a fresh 60-day one and re-resolve
 * the page token (which is derived from it). Best-effort; persists on success. */
async function refreshCreds(stored: StoredInstagram): Promise<StoredInstagram | null> {
  const cfg = clientConfig();
  if (!cfg) return null;
  const long = await graphGet("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: cfg.id,
    client_secret: cfg.secret,
    fb_exchange_token: stored.userToken,
  });
  const userToken = long.access_token as string;
  if (!userToken) return null;
  const account = await resolveInstagramAccount(userToken);
  const next: StoredInstagram = {
    userToken,
    expiresAt: Date.now() + (long.expires_in ?? 60 * 24 * 3600) * 1000,
    ...account,
  };
  await storeCreds(next);
  console.log("[instagram] long-lived token refreshed");
  return next;
}
