// aurelius/autonomy/workflows/contentPublish.ts
//
// The OUTWARD publish workflow (NORTH_STAR §2.5). content.publish is outward by
// construction, so executeAction always GATES it: it files a pending Bridge
// proposal and this finalizer runs ONLY when Cole taps Confirm. There is no
// grant that can make publishing automatic — that's the whole point.
//
// The finalizer commits from the stored payload (caption + public image URL), so
// it works even after a restart. Dormant-honest without an Instagram token.

import { publishToInstagram } from "../../outward/instagram.ts";

export type ContentPublishPayload = {
  channel?: string; // "instagram" (only channel for now)
  caption: string;
  imageUrl: string;
};

/** Commit step — registered as the content.publish finalizer. Runs on Cole's confirm. */
export async function finalizeContentPublish(payload: ContentPublishPayload): Promise<any> {
  const channel = (payload?.channel ?? "instagram").toLowerCase();
  if (channel !== "instagram") {
    throw new Error(`no publisher wired for channel "${channel}" (only instagram today)`);
  }
  const result = await publishToInstagram({ caption: payload.caption, imageUrl: payload.imageUrl });
  return { channel, ...result };
}
