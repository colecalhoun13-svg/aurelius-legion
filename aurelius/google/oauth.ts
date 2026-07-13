// aurelius/google/oauth.ts
//
// SHARED GOOGLE OAUTH — a factory so every Google surface (Gmail today,
// more later) reuses one proven flow instead of copy-pasting the token
// dance. Same shape as calendar/googleAuth.ts (which stays as-is —
// working code, left untouched), generalized over service + scope +
// token key + callback path. Refresh tokens persist with RAW prisma —
// credentials are never embedded into the vector index.
//
// One Google client (GOOGLE_CLIENT_ID/SECRET) backs every service; each
// service holds its own token under its own key, so authorizing Gmail
// never disturbs Calendar and vice-versa.

import { prisma } from "../core/db/prisma.ts";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type StoredTokens = { refresh_token: string; access_token: string; expires_at: number };

export type GoogleOAuth = {
  isConfigured(): boolean;
  redirectUri(): string;
  buildAuthUrl(): string | null;
  handleCallback(code: string): Promise<{ ok: boolean; error?: string }>;
  isConnected(): Promise<boolean>;
  disconnect(): Promise<void>;
  fetch(url: string, init?: RequestInit): Promise<Response>;
};

function clientConfig(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

export function makeGoogleOAuth(cfg: {
  service: string;      // "gmail"
  scope: string;        // space-separated scope string
  callbackPath: string; // "/api/gmail/callback"
  tokenKey: string;     // "google_gmail_tokens"
}): GoogleOAuth {
  const TOKEN_SCOPE = "system";
  let cachedAccess: { token: string; expiresAt: number } | null = null;

  const redirectUri = () =>
    process.env[`GOOGLE_${cfg.service.toUpperCase()}_REDIRECT_URI`]?.trim() ||
    `http://localhost:${process.env.PORT || 3001}${cfg.callbackPath}`;

  async function globalOperatorId(): Promise<string | null> {
    const op = await prisma.operator.findUnique({ where: { name: "global" }, select: { id: true } });
    return op?.id ?? null;
  }

  async function loadTokens(): Promise<StoredTokens | null> {
    const row = await prisma.knowledgeEntry.findFirst({
      where: { scope: TOKEN_SCOPE, key: cfg.tokenKey, active: true },
    });
    const v = row?.value as any;
    return v?.refresh_token ? (v as StoredTokens) : null;
  }

  async function storeTokens(tokens: StoredTokens): Promise<void> {
    const opId = await globalOperatorId();
    if (!opId) throw new Error("global operator missing — run the seed");
    await prisma.knowledgeEntry.upsert({
      where: { operatorId_scope_key: { operatorId: opId, scope: TOKEN_SCOPE, key: cfg.tokenKey } },
      create: {
        operatorId: opId, scope: TOKEN_SCOPE, key: cfg.tokenKey, value: tokens as any,
        sourceType: "system", sourceId: `google_oauth_${cfg.service}`,
        rationale: `Google ${cfg.service} OAuth tokens (credential — not indexed)`,
        createdBy: "aurelius", updatedBy: "aurelius", version: 1, active: true, history: [],
      },
      update: { value: tokens as any, updatedBy: "aurelius", active: true },
    });
  }

  async function disconnect(): Promise<void> {
    const opId = await globalOperatorId();
    if (!opId) return;
    await prisma.knowledgeEntry.updateMany({
      where: { operatorId: opId, scope: TOKEN_SCOPE, key: cfg.tokenKey },
      data: { active: false },
    });
    cachedAccess = null;
  }

  async function refreshAccessToken(stored: StoredTokens): Promise<string | null> {
    const cc = clientConfig();
    if (!cc) return null;
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cc.id, client_secret: cc.secret,
        refresh_token: stored.refresh_token, grant_type: "refresh_token",
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      console.warn(`[${cfg.service}] token refresh failed:`, json.error ?? res.status);
      if (json.error === "invalid_grant") {
        await disconnect();
        console.warn(`[${cfg.service}] refresh token dead — disconnected; re-run ${cfg.callbackPath.replace("/callback", "/auth")}`);
      }
      return null;
    }
    const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
    await storeTokens({
      refresh_token: json.refresh_token ?? stored.refresh_token,
      access_token: json.access_token,
      expires_at: expiresAt,
    });
    cachedAccess = { token: json.access_token, expiresAt };
    return json.access_token;
  }

  async function getAccessToken(forceRefresh = false): Promise<string | null> {
    if (!forceRefresh && cachedAccess && cachedAccess.expiresAt - Date.now() > 60_000) return cachedAccess.token;
    const stored = await loadTokens();
    if (!stored) return null;
    if (!forceRefresh && stored.expires_at - Date.now() > 60_000) {
      cachedAccess = { token: stored.access_token, expiresAt: stored.expires_at };
      return stored.access_token;
    }
    return refreshAccessToken(stored);
  }

  return {
    isConfigured: () => clientConfig() !== null,
    redirectUri,
    buildAuthUrl() {
      const cc = clientConfig();
      if (!cc) return null;
      const params = new URLSearchParams({
        client_id: cc.id, redirect_uri: redirectUri(), response_type: "code",
        scope: cfg.scope, access_type: "offline", prompt: "consent",
      });
      return `${AUTH_URL}?${params}`;
    },
    async handleCallback(code: string) {
      const cc = clientConfig();
      if (!cc) return { ok: false, error: "GOOGLE_CLIENT_ID/SECRET not set" };
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: cc.id, client_secret: cc.secret,
          redirect_uri: redirectUri(), grant_type: "authorization_code",
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json.access_token) {
        return { ok: false, error: `token exchange failed: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim() };
      }
      if (!json.refresh_token) {
        return { ok: false, error: "Google returned no refresh token — revoke at myaccount.google.com/permissions and re-authorize" };
      }
      await storeTokens({
        refresh_token: json.refresh_token,
        access_token: json.access_token,
        expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
      });
      cachedAccess = null;
      console.log(`[${cfg.service}] connected — refresh token stored`);
      return { ok: true };
    },
    async isConnected() {
      try { return (await loadTokens()) !== null; } catch { return false; }
    },
    disconnect,
    async fetch(url: string, init: RequestInit = {}) {
      let token = await getAccessToken();
      if (!token) throw new Error(`Google ${cfg.service} not connected — open ${cfg.callbackPath.replace("/callback", "/auth")}`);
      const doFetch = (t: string) =>
        fetch(url, { ...init, headers: { ...(init.headers as any), Authorization: `Bearer ${t}` } });
      let res = await doFetch(token);
      if (res.status === 401) {
        token = await getAccessToken(true);
        if (!token) throw new Error(`Google ${cfg.service} auth expired — re-authorize`);
        res = await doFetch(token);
      }
      return res;
    },
  };
}
