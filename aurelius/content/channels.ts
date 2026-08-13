// aurelius/content/channels.ts
//
// MULTI-CHANNEL PUBLISHING (NORTH_STAR #41) — the honest state of "one idea,
// many channels." Today ONE channel has a real publisher (Instagram, itself
// config-gated on a Meta token + a public media host). TikTok and YouTube
// publishing genuinely require their own OAuth tokens and app review — they
// cannot be "live" without Cole's credentials — so this registry names each
// channel, what media it takes, and whether it's actually wired, and reports it
// honestly: a channel with no publisher/token is `dormant` with the exact fix,
// never a silent no-op or a fake success.
//
// This is the reachable BOUNDARY for #41: the multi-channel intent is real and
// inspectable, and the day Cole adds a channel's token, that channel flips to
// live without touching the callers. Publishing anywhere stays OUTWARD (Cole's
// confirm) by construction — this only reports readiness; it never posts.

import { instagramConfigured } from "../outward/instagram.ts";
import { isMediaHostConfigured } from "../media/host.ts";

export type ChannelKind = "image" | "video" | "text";

export type ChannelReadiness = {
  channel: string;
  kinds: ChannelKind[];
  live: boolean; // a real publisher AND its config is present
  reason: string | null; // when not live, the exact fix
};

export function channelReadiness(): ChannelReadiness[] {
  const channels: ChannelReadiness[] = [];

  // Instagram — the one wired publisher. Live only when the Meta creds AND the
  // public media host are both set (an image is fetched by URL, not uploaded).
  let igLive = false;
  let igReason: string | null = "Instagram not configured — connect the Meta token and set MEDIA_PUBLIC_BASE_URL.";
  if (instagramConfigured() && isMediaHostConfigured()) {
    igLive = true;
    igReason = null;
  } else if (instagramConfigured()) {
    igReason = "Instagram token set but MEDIA_PUBLIC_BASE_URL is not — Meta fetches images by URL, so publishing needs a media host.";
  }
  channels.push({ channel: "instagram", kinds: ["image"], live: igLive, reason: igReason });

  // TikTok — video. Dormant until its own token (Content Posting API + review).
  channels.push({
    channel: "tiktok",
    kinds: ["video"],
    live: false,
    reason: process.env.TIKTOK_ACCESS_TOKEN?.trim()
      ? "TikTok token present, but the reel publisher isn't wired yet — a deliberate next build, not a silent gap."
      : "TikTok is dormant — needs TIKTOK_ACCESS_TOKEN (Content Posting API) and app approval.",
  });

  // YouTube — video (Shorts). Dormant until its own OAuth token.
  channels.push({
    channel: "youtube",
    kinds: ["video"],
    live: false,
    reason: process.env.YOUTUBE_ACCESS_TOKEN?.trim()
      ? "YouTube token present, but the upload publisher isn't wired yet — a deliberate next build."
      : "YouTube is dormant — needs YOUTUBE_ACCESS_TOKEN (Data API v3 OAuth).",
  });

  return channels;
}

/** One-line summary + the live channel list, for the tool and the doctor. */
export function multiChannelSummary(): { live: string[]; dormant: string[]; note: string } {
  const all = channelReadiness();
  const live = all.filter((c) => c.live).map((c) => c.channel);
  const dormant = all.filter((c) => !c.live).map((c) => c.channel);
  const note =
    live.length === 0
      ? "No publish channel is live yet — Instagram lights up with a Meta token + media host; TikTok/YouTube need their own tokens. Nothing posts on its own regardless."
      : `Live: ${live.join(", ")}. Dormant (need tokens): ${dormant.join(", ")}. Publishing anywhere still stops for your confirm.`;
  return { live, dormant, note };
}
