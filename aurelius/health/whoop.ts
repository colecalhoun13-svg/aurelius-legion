// aurelius/health/whoop.ts
//
// WHOOP READINESS (NORTH_STAR #8, #46) — Cole's own recovery/strain/sleep, his
// data first (Athlete Zero). Direct WHOOP API, dormant until WHOOP_ACCESS_TOKEN
// lands, live the moment it does.
//
// The readings land as Metric rows on the SELF record (source "whoop"), written
// with raw prisma — NOT through logMetric — deliberately: a daily recovery score
// isn't a "personal best," so it must not trip PR detection or the onPeak
// business machinery. Once stored, the whole coaching eye (performance, dev
// curves) reads them like any measure, and latestReadiness() serves the tab
// even between syncs.
//
// Readiness is a SIGNAL domain (hard rule 5): a low-recovery day surfaces a
// training-domain notice; the training call stays Cole's. Nothing here is a
// medical claim — it reports WHOOP's own numbers, no diagnosis.

import { prisma } from "../core/db/prisma.ts";

const WHOOP_API = "https://api.prod.whoop.com/developer";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_TOKEN_KEY = "whoop_tokens";

// TOKEN REFRESH (audit finding). A WHOOP developer access token lives ~1 hour,
// so a static WHOOP_ACCESS_TOKEN dies within the hour and the 30-min sync 401s
// forever after. The live path is client creds + a refresh token (obtained once
// with the `offline` scope): whoopAccessToken() mints a fresh access token on
// demand and PERSISTS the rotated refresh token (WHOOP rotates it every refresh)
// with raw prisma, exactly like the Google flow. The static token stays as a
// fallback — honest that it won't survive an hour on its own.
type WhoopTokens = { refresh_token: string; access_token: string; expires_at: number };
let whoopCachedAccess: { token: string; expiresAt: number } | null = null;

function whoopClient(): { id: string; secret: string } | null {
  const id = process.env.WHOOP_CLIENT_ID?.trim();
  const secret = process.env.WHOOP_CLIENT_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

/** Configured if EITHER a refreshable grant (client creds + a refresh token) or
 *  a static access token is present. Sync — can't read the DB — so it reads the
 *  refresh token from env; once stored, the env var stays set anyway. */
export function whoopConfigured(): boolean {
  const refreshable = !!(whoopClient() && process.env.WHOOP_REFRESH_TOKEN?.trim());
  return refreshable || !!process.env.WHOOP_ACCESS_TOKEN?.trim();
}

export function whoopStatus(): { configured: boolean; reason: string | null } {
  if (whoopConfigured()) {
    const durable = !!(whoopClient() && process.env.WHOOP_REFRESH_TOKEN?.trim());
    return {
      configured: true,
      reason: durable
        ? null
        : "WHOOP is live off a static token, which WHOOP expires in ~1 hour — for a connection that STAYS live, set WHOOP_CLIENT_ID + WHOOP_CLIENT_SECRET + WHOOP_REFRESH_TOKEN (offline scope) so I can refresh it.",
    };
  }
  return {
    configured: false,
    reason:
      "WHOOP is dormant — set WHOOP_CLIENT_ID + WHOOP_CLIENT_SECRET + WHOOP_REFRESH_TOKEN (offline scope, so it stays live), or a short-lived WHOOP_ACCESS_TOKEN to try it. Then I'll pull your recovery, strain, and sleep.",
  };
}

async function loadWhoopTokens(): Promise<WhoopTokens | null> {
  const row = await prisma.knowledgeEntry.findFirst({ where: { scope: "system", key: WHOOP_TOKEN_KEY, active: true } });
  const v = row?.value as any;
  return v?.refresh_token ? (v as WhoopTokens) : null;
}

async function storeWhoopTokens(tokens: WhoopTokens): Promise<void> {
  const op = await prisma.operator.findUnique({ where: { name: "global" }, select: { id: true } });
  if (!op) return; // no global operator (unseeded) — skip persistence, stay in-memory
  await prisma.knowledgeEntry.upsert({
    where: { operatorId_scope_key: { operatorId: op.id, scope: "system", key: WHOOP_TOKEN_KEY } },
    create: {
      operatorId: op.id, scope: "system", key: WHOOP_TOKEN_KEY, value: tokens as any,
      sourceType: "system", sourceId: "whoop_oauth",
      rationale: "WHOOP OAuth tokens (credential — not indexed)",
      createdBy: "aurelius", updatedBy: "aurelius", version: 1, active: true, history: [],
    },
    update: { value: tokens as any, updatedBy: "aurelius", active: true },
  });
}

async function refreshWhoop(refreshToken: string): Promise<string | null> {
  const cc = whoopClient();
  if (!cc) return null;
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: cc.id, client_secret: cc.secret, scope: "offline" }),
    signal: AbortSignal.timeout(20_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.warn("[whoop] token refresh failed:", json.error ?? res.status);
    return null;
  }
  const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  // WHOOP rotates the refresh token on every refresh — persist the new one or
  // the next refresh fails with the stale token.
  await storeWhoopTokens({ refresh_token: json.refresh_token ?? refreshToken, access_token: json.access_token, expires_at: expiresAt }).catch(() => {});
  whoopCachedAccess = { token: json.access_token, expiresAt };
  return json.access_token;
}

/** A working WHOOP access token — refreshed when stale, falling back to a static
 *  token. Null when nothing is configured. */
export async function whoopAccessToken(forceRefresh = false): Promise<string | null> {
  if (whoopClient()) {
    if (!forceRefresh && whoopCachedAccess && whoopCachedAccess.expiresAt - Date.now() > 60_000) return whoopCachedAccess.token;
    const stored = await loadWhoopTokens().catch(() => null);
    const refreshToken = stored?.refresh_token ?? process.env.WHOOP_REFRESH_TOKEN?.trim();
    if (refreshToken) {
      if (!forceRefresh && stored && stored.expires_at - Date.now() > 60_000) {
        whoopCachedAccess = { token: stored.access_token, expiresAt: stored.expires_at };
        return stored.access_token;
      }
      const fresh = await refreshWhoop(refreshToken);
      if (fresh) return fresh;
    }
  }
  return process.env.WHOOP_ACCESS_TOKEN?.trim() || null;
}

export type Readiness = {
  recovery: number | null; // 0-100
  hrv: number | null; // ms (rmssd)
  restingHr: number | null; // bpm
  at: Date | null;
};

/** Latest stored readiness on the self record — works from stored data even
 *  between syncs; null when nothing has been pulled yet. */
export async function latestReadiness(): Promise<Readiness> {
  const { getSelf } = await import("../athlete/self.ts");
  const self = await getSelf();
  if (!self) return { recovery: null, hrv: null, restingHr: null, at: null };
  const rows = await prisma.metric.findMany({
    where: { clientId: self.id, source: "whoop", label: { in: ["recovery", "hrv", "resting_hr"] } },
    orderBy: { achievedAt: "desc" },
    take: 30,
    select: { label: true, value: true, achievedAt: true },
  });
  const pick = (l: string) => rows.find((r) => r.label === l) ?? null;
  const rec = pick("recovery");
  return {
    recovery: rec?.value ?? null,
    hrv: pick("hrv")?.value ?? null,
    restingHr: pick("resting_hr")?.value ?? null,
    at: rec?.achievedAt ?? null,
  };
}

/** Pull the latest recovery from WHOOP and store it on the self record.
 *  Dormant-honest: no token → a clean skip, never an error or a fake reading. */
export async function syncWhoop(): Promise<{ ran: boolean; reason: string; stored: number }> {
  if (!whoopConfigured()) return { ran: false, reason: "dormant — no WHOOP credentials", stored: 0 };

  let recovery: { score?: number; hrv?: number; rhr?: number; at?: string } | null = null;
  try {
    let token = await whoopAccessToken();
    if (!token) return { ran: false, reason: "no usable WHOOP token (refresh failed?)", stored: 0 };
    const pull = (t: string) =>
      fetch(`${WHOOP_API}/v1/recovery?limit=1`, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(20_000) });
    let res = await pull(token);
    // A 401 mid-life means the token expired between refresh and use — force a
    // refresh once and retry, so a long-running process self-heals instead of
    // 401ing until restart.
    if (res.status === 401) {
      token = await whoopAccessToken(true);
      if (token) res = await pull(token);
    }
    if (!res.ok) return { ran: false, reason: `WHOOP API ${res.status}: ${(await res.text()).slice(0, 120)}`, stored: 0 };
    const j: any = await res.json();
    const rec = j?.records?.[0];
    const s = rec?.score;
    if (s) recovery = { score: s.recovery_score, hrv: s.hrv_rmssd_milli, rhr: s.resting_heart_rate, at: rec?.created_at };
  } catch (err: any) {
    return { ran: false, reason: `WHOOP fetch failed: ${(err?.message ?? String(err)).slice(0, 120)}`, stored: 0 };
  }
  if (!recovery || recovery.score == null) return { ran: true, reason: "no new recovery record", stored: 0 };

  const { getOrCreateSelf } = await import("../athlete/self.ts");
  const self = await getOrCreateSelf();
  const at = recovery.at ? new Date(recovery.at) : new Date();
  const readings: Array<{ label: string; value: number; unit: string }> = [
    { label: "recovery", value: Math.round(recovery.score), unit: "%" },
    ...(recovery.hrv != null ? [{ label: "hrv", value: Math.round(recovery.hrv), unit: "ms" }] : []),
    ...(recovery.rhr != null ? [{ label: "resting_hr", value: Math.round(recovery.rhr), unit: "bpm" }] : []),
  ];
  // Dedup on (self, label, day) so a re-sync doesn't stack duplicate readings.
  const dayStart = new Date(at);
  dayStart.setHours(0, 0, 0, 0);
  let stored = 0;
  for (const r of readings) {
    const exists = await prisma.metric.count({
      where: { clientId: self.id, source: "whoop", label: r.label, achievedAt: { gte: dayStart } },
    });
    if (exists > 0) continue;
    await prisma.metric.create({
      data: { clientId: self.id, label: r.label, value: r.value, unit: r.unit, source: "whoop", achievedAt: at, isPR: false },
    });
    stored++;
  }

  // Readiness signal (observation only): a low recovery day is worth flagging —
  // Cole decides what to do with it. Deduped per day.
  if (recovery.score < 34) {
    const { surfaceSignal } = await import("../core/bridge.ts");
    await surfaceSignal({
      kind: "opportunity",
      domain: "training",
      sourceType: "readiness",
      sourceId: `readiness:${dayStart.toISOString().slice(0, 10)}`,
      severity: "notice",
      title: `Recovery is low today — ${Math.round(recovery.score)}%`,
      body: `WHOOP has you in the red (${Math.round(recovery.score)}% recovery${recovery.hrv != null ? `, HRV ${Math.round(recovery.hrv)}ms` : ""}). An observation, not a prescription — you know how you feel. Consider it before a heavy session.`,
    }).catch(() => {});
  }

  return { ran: true, reason: "synced", stored };
}
