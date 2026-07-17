// aurelius/instagram/insights.ts
//
// THE SOCIAL-MEDIA METRICS PLUGIN. Reads Instagram back: account-level reach /
// followers / profile activity, plus per-post performance for recent media —
// so Aurelius can tell Cole what's landing and feed the content money-path
// with real numbers instead of vibes.
//
// Read-only (INWARD): metrics never publish anything, so no gate is needed —
// this is Aurelius knowing, not acting. Dormant-honest without a connection
// (hard rule 4): fails loudly, once, with the fix.
//
// Meta Graph API: account insights at /{ig-user-id}/insights, media insights at
// /{ig-media-id}/insights. Needs instagram_manage_insights (in the OAuth scopes).

import { getInstagramCreds } from "./auth.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`);
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json;
}

export type AccountMetrics = {
  username?: string;
  followers: number;
  following: number;
  posts: number;
  window: string; // e.g. "last 30 days"
  reach: number;
  profileViews: number;
  websiteClicks: number;
};

export type PostMetrics = {
  id: string;
  caption: string;
  permalink?: string;
  timestamp: string;
  mediaType: string;
  likes: number;
  comments: number;
  reach: number;
  saved: number;
  shares: number;
  engagement: number; // likes + comments + saves + shares
};

/**
 * Account-level metrics over a window (default 30 days). Followers/following/
 * posts are profile fields; reach/profileViews/websiteClicks are insights.
 */
export async function accountMetrics(days = 30): Promise<AccountMetrics> {
  const creds = await getInstagramCreds();
  if (!creds) {
    throw new Error(
      "Instagram isn't connected — open /api/instagram/auth once (needs INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET). See docs/SETUP_AND_LAUNCH.md."
    );
  }
  const { token, igUserId } = creds;

  const profile = await graphGet(igUserId, {
    fields: "username,followers_count,follows_count,media_count",
    access_token: token,
  });

  // Insights window: Graph wants unix seconds; cap at 30 days per call.
  const clampedDays = Math.min(Math.max(days, 1), 30);
  const since = Math.floor((Date.now() - clampedDays * 86400_000) / 1000);
  const until = Math.floor(Date.now() / 1000);

  let insights: any = { data: [] };
  try {
    insights = await graphGet(`${igUserId}/insights`, {
      metric: "reach,profile_views,website_clicks",
      period: "day",
      since: String(since),
      until: String(until),
      access_token: token,
    });
  } catch (err) {
    // Insights can 400 on brand-new/low-activity accounts — profile still returns.
    console.warn("[instagram] account insights unavailable:", (err as any)?.message ?? err);
  }

  const sum = (metric: string) => {
    const m = (insights?.data ?? []).find((d: any) => d.name === metric);
    const vals: any[] = m?.values ?? [];
    return vals.reduce((n, v) => n + (Number(v?.value) || 0), 0);
  };

  return {
    username: profile?.username,
    followers: Number(profile?.followers_count) || 0,
    following: Number(profile?.follows_count) || 0,
    posts: Number(profile?.media_count) || 0,
    window: `last ${clampedDays} days`,
    reach: sum("reach"),
    profileViews: sum("profile_views"),
    websiteClicks: sum("website_clicks"),
  };
}

/** Recent posts with per-post performance, newest first. */
export async function recentPostMetrics(limit = 8): Promise<PostMetrics[]> {
  const creds = await getInstagramCreds();
  if (!creds) {
    throw new Error(
      "Instagram isn't connected — open /api/instagram/auth once. See docs/SETUP_AND_LAUNCH.md."
    );
  }
  const { token, igUserId } = creds;

  const media = await graphGet(`${igUserId}/media`, {
    fields: "id,caption,permalink,timestamp,media_type,like_count,comments_count",
    limit: String(Math.min(Math.max(limit, 1), 25)),
    access_token: token,
  });
  const items: any[] = media?.data ?? [];

  const out: PostMetrics[] = [];
  for (const item of items) {
    let reach = 0;
    let saved = 0;
    let shares = 0;
    try {
      // Reels vs feed images expose slightly different metric names; ask for the
      // common set and read whatever comes back.
      const ins = await graphGet(`${item.id}/insights`, {
        metric: "reach,saved,shares",
        access_token: token,
      });
      for (const d of ins?.data ?? []) {
        const val = Number(d?.values?.[0]?.value) || 0;
        if (d.name === "reach") reach = val;
        else if (d.name === "saved") saved = val;
        else if (d.name === "shares") shares = val;
      }
    } catch {
      /* per-post insights can lag for very fresh posts — likes/comments still land */
    }
    const likes = Number(item.like_count) || 0;
    const comments = Number(item.comments_count) || 0;
    out.push({
      id: item.id,
      caption: (item.caption ?? "").slice(0, 140),
      permalink: item.permalink,
      timestamp: item.timestamp,
      mediaType: item.media_type ?? "IMAGE",
      likes,
      comments,
      reach,
      saved,
      shares,
      engagement: likes + comments + saved + shares,
    });
  }
  return out;
}

export type PostingPatterns = {
  sampleSize: number;
  avgEngagement: number;
  avgReach: number;
  engagementRatePct: number; // engagement / reach
  byMediaType: Array<{ type: string; count: number; avgEngagement: number }>;
  byDay: Array<{ day: string; count: number; avgEngagement: number }>;
  byHour: Array<{ hourBlock: string; count: number; avgEngagement: number }>;
  bestDay?: string;
  bestHourBlock?: string;
  bestMediaType?: string;
  trend: "rising" | "flat" | "falling";
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function hourBlock(h: number): string {
  if (h < 6) return "late night (12–6a)";
  if (h < 11) return "morning (6–11a)";
  if (h < 14) return "midday (11a–2p)";
  if (h < 18) return "afternoon (2–6p)";
  if (h < 22) return "evening (6–10p)";
  return "night (10p–12a)";
}

/**
 * ALGORITHM LEVERAGE, honestly. Meta never exposes the ranking algorithm — but
 * Cole's OWN posts reveal what works FOR HIM: which media types, days, and times
 * earn engagement, and whether he's trending up. Pure computation over the last
 * ~25 posts — no LLM, no guessing.
 */
export async function postingPatterns(sample = 25): Promise<PostingPatterns> {
  const posts = await recentPostMetrics(sample);
  if (posts.length === 0) {
    return {
      sampleSize: 0, avgEngagement: 0, avgReach: 0, engagementRatePct: 0,
      byMediaType: [], byDay: [], byHour: [], trend: "flat",
    };
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const avgEngagement = avg(posts.map((p) => p.engagement));
  const avgReach = avg(posts.map((p) => p.reach));

  const group = (keyOf: (p: PostMetrics) => string) => {
    const m = new Map<string, number[]>();
    for (const p of posts) {
      const k = keyOf(p);
      (m.get(k) ?? m.set(k, []).get(k)!).push(p.engagement);
    }
    return [...m.entries()]
      .map(([k, es]) => ({ key: k, count: es.length, avgEngagement: Math.round(avg(es)) }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);
  };

  const byType = group((p) => p.mediaType);
  const byDay = group((p) => DAYS[new Date(p.timestamp).getDay()]);
  const byHour = group((p) => hourBlock(new Date(p.timestamp).getHours()));

  // Trend: mean engagement of the newer half vs the older half.
  const half = Math.floor(posts.length / 2);
  const newer = avg(posts.slice(0, half).map((p) => p.engagement));
  const older = avg(posts.slice(half).map((p) => p.engagement));
  const trend = half === 0 ? "flat" : newer > older * 1.15 ? "rising" : newer < older * 0.85 ? "falling" : "flat";

  return {
    sampleSize: posts.length,
    avgEngagement: Math.round(avgEngagement),
    avgReach: Math.round(avgReach),
    engagementRatePct: avgReach > 0 ? Math.round((avgEngagement / avgReach) * 1000) / 10 : 0,
    byMediaType: byType.map((x) => ({ type: x.key, count: x.count, avgEngagement: x.avgEngagement })),
    byDay: byDay.map((x) => ({ day: x.key, count: x.count, avgEngagement: x.avgEngagement })),
    byHour: byHour.map((x) => ({ hourBlock: x.key, count: x.count, avgEngagement: x.avgEngagement })),
    bestDay: byDay[0]?.key,
    bestHourBlock: byHour[0]?.key,
    bestMediaType: byType[0]?.key,
    trend,
  };
}

/** A compact, chat-ready digest of how the account is doing. */
export async function metricsDigest(): Promise<string> {
  const acct = await accountMetrics(30);
  const posts = await recentPostMetrics(5).catch(() => [] as PostMetrics[]);
  const lines: string[] = [
    `@${acct.username ?? "your account"} — ${acct.followers.toLocaleString()} followers · ${acct.posts} posts`,
    `Last ${acct.window.replace("last ", "")}: ${acct.reach.toLocaleString()} reach · ${acct.profileViews.toLocaleString()} profile views` +
      (acct.websiteClicks ? ` · ${acct.websiteClicks} link clicks` : ""),
  ];
  if (posts.length) {
    const best = [...posts].sort((a, b) => b.engagement - a.engagement)[0];
    lines.push("");
    lines.push("Recent posts (newest first):");
    for (const p of posts) {
      lines.push(
        `• ${new Date(p.timestamp).toLocaleDateString()} — ${p.reach.toLocaleString()} reach, ${p.likes} likes, ${p.comments} comments, ${p.saved} saves${p.id === best.id ? "  ★ top" : ""}`
      );
    }
    lines.push("");
    lines.push(`Your strongest recent post: "${best.caption || "(no caption)"}" — ${best.engagement} total engagement.`);
  }
  return lines.join("\n");
}
