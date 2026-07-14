// aurelius/outward/instagram.ts
//
// THE FIRST OUTWARD CHANNEL (NORTH_STAR §2.5). Publishing is OUTWARD by
// construction — it can never be granted; every publish stops for Cole's confirm
// on the Bridge, and only his tap runs this. This module is just the hands: given
// a caption + a public image URL, it posts to Instagram via the Meta Graph API.
//
// Dormant-honest without config (hard rule 4): no token → it fails loudly, once,
// with the fix, and never fabricates a "posted!" it didn't do (hard rule 3).
//
// Instagram content publishing needs a Meta app + a Facebook Page linked to an
// IG BUSINESS/CREATOR account + a long-lived token with instagram_content_publish.
// The Graph flow is two calls: create a media container, then publish it. IG
// requires a PUBLIC image_url (it fetches the bytes itself) — raw uploads aren't
// supported, so hosting the image is the caller's job (comes with the Mac Mini
// deploy; until then pass an already-hosted URL). See docs/SETUP.md.

const GRAPH = "https://graph.facebook.com/v21.0";

function cfg(): { token: string; igUserId: string } | null {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const igUserId = process.env.INSTAGRAM_BUSINESS_ID?.trim();
  return token && igUserId ? { token, igUserId } : null;
}

export function instagramConfigured(): boolean {
  return !!cfg();
}

export type InstagramPublishInput = {
  caption: string;
  imageUrl: string; // must be a PUBLICLY reachable URL (Meta fetches it)
};

export type InstagramPublishResult = {
  ok: boolean;
  postId?: string;
  permalink?: string;
  error?: string;
};

async function graphPost(path: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Publish a single image post to Instagram. Two-step Graph flow: create a media
 * container, then publish it. Throws honestly on any failure — the caller
 * (confirmAction) reverts the Bridge proposal to pending so Cole can retry.
 */
export async function publishToInstagram(input: InstagramPublishInput): Promise<InstagramPublishResult> {
  const c = cfg();
  if (!c) {
    throw new Error(
      "Instagram is not configured — set INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ID (Meta app + IG business account). See docs/SETUP.md."
    );
  }
  if (!input.imageUrl?.trim()) {
    throw new Error("Instagram publish needs a public image_url (Meta fetches the bytes itself).");
  }

  // 1) create media container
  const container = await graphPost(`${c.igUserId}/media`, {
    image_url: input.imageUrl,
    caption: input.caption ?? "",
    access_token: c.token,
  });
  const creationId = container?.id;
  if (!creationId) throw new Error("Instagram did not return a media container id");

  // 2) publish the container
  const published = await graphPost(`${c.igUserId}/media_publish`, {
    creation_id: String(creationId),
    access_token: c.token,
  });
  const postId = published?.id;
  if (!postId) throw new Error("Instagram did not confirm the publish");

  // best-effort permalink (non-fatal)
  let permalink: string | undefined;
  try {
    const meta = await fetch(`${GRAPH}/${postId}?fields=permalink&access_token=${c.token}`);
    const mj: any = await meta.json().catch(() => ({}));
    permalink = mj?.permalink;
  } catch {
    /* permalink is a nicety, not required */
  }

  return { ok: true, postId: String(postId), permalink };
}
