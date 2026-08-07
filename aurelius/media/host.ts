// aurelius/media/host.ts
//
// THE MEDIA HOST SEAM.
//
// Instagram's Graph API will not accept an upload. It requires a PUBLIC url and
// fetches the bytes itself. Aurelius had no way to produce one, so the outward
// content lane was unreachable even once Instagram was fully configured — the
// publish call could only ever succeed if Cole had already hosted the image
// somewhere by hand. That is the gap this closes.
//
// Cole's call (2026-08-05): serve media off the Mac Mini rather than renting
// object storage. So the DEFAULT provider is local disk behind a public base
// URL. But the provider is a seam, not a hardcode — moving to R2/S3/Cloudinary
// later should be a new `MediaHost` implementation and an env var, never a
// rewrite of the publish path.
//
// Dormant until configured (hard rule 4): with no MEDIA_PUBLIC_BASE_URL the
// host reports itself unconfigured and every caller fails loudly with the fix,
// rather than inventing a URL Meta will fail to fetch.
//
// SECURITY NOTE. Anything written here becomes world-readable to anyone with
// the URL — Meta must be able to fetch it unauthenticated. Filenames are
// therefore random, never derived from user input, and nothing but media
// intended for publication should ever be placed here.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type HostedMedia = {
  url: string; // publicly reachable — this is what Meta fetches
  key: string; // provider-relative identifier, for later deletion
  bytes: number;
  contentType: string;
};

export type MediaHost = {
  name: string;
  configured(): boolean;
  /** Why it isn't usable, in Cole's terms, with the fix. Null when it is. */
  unconfiguredReason(): string | null;
  put(input: { data: Buffer; contentType: string; extension: string }): Promise<HostedMedia>;
  remove(key: string): Promise<void>;
};

/** Where local media lives on disk. Served by Express (see index.ts). */
export const MEDIA_DIR = process.env.MEDIA_DIR?.trim() || path.resolve(process.cwd(), "vault", "public-media");

/** The URL prefix Express serves MEDIA_DIR under. */
export const MEDIA_ROUTE = "/media";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "video/mp4": "mp4",
};

/** Instagram accepts JPEG for images; PNG is converted upstream if needed. */
export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

/**
 * Local disk + a public base URL. This is the Mac Mini shape: the Mini serves
 * Aurelius on a reachable hostname anyway, so media rides the same origin and
 * costs nothing.
 */
export const localDiskHost: MediaHost = {
  name: "local-disk",

  configured() {
    return !!process.env.MEDIA_PUBLIC_BASE_URL?.trim();
  },

  unconfiguredReason() {
    if (this.configured()) return null;
    return (
      "No media host configured. Instagram fetches images by URL — it cannot accept an upload — so publishing " +
      "needs a public address for the file. Set MEDIA_PUBLIC_BASE_URL to the origin Aurelius is reachable at " +
      `(e.g. https://aurelius.yourdomain.com), and files written to ${MEDIA_DIR} will be served under ${MEDIA_ROUTE}.`
    );
  },

  async put({ data, contentType, extension }) {
    const base = process.env.MEDIA_PUBLIC_BASE_URL?.trim();
    if (!base) throw new Error(this.unconfiguredReason()!);
    if (!data?.length) throw new Error("Refusing to host an empty file.");

    await fs.mkdir(MEDIA_DIR, { recursive: true });
    // Random name, never derived from caller input: this directory is public,
    // and a guessable or traversal-shaped name would be a real hole.
    const ext = (extension || EXT_BY_TYPE[contentType] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5);
    const key = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
    await fs.writeFile(path.join(MEDIA_DIR, key), data);

    return {
      url: `${base.replace(/\/+$/, "")}${MEDIA_ROUTE}/${key}`,
      key,
      bytes: data.length,
      contentType,
    };
  },

  async remove(key: string) {
    // Defend the join: a key containing ".." must never escape MEDIA_DIR.
    const safe = path.basename(key);
    await fs.unlink(path.join(MEDIA_DIR, safe)).catch(() => {});
  },
};

/**
 * The active host. One switch, so adding object storage later means writing a
 * second MediaHost and extending this map — the publish path never changes.
 */
export function mediaHost(): MediaHost {
  switch ((process.env.MEDIA_HOST_PROVIDER ?? "local").trim().toLowerCase()) {
    case "local":
    default:
      return localDiskHost;
  }
}

export function isMediaHostConfigured(): boolean {
  return mediaHost().configured();
}

/** One line for the doctor / integration status. */
export function mediaHostStatus(): { configured: boolean; provider: string; reason: string | null } {
  const host = mediaHost();
  return { configured: host.configured(), provider: host.name, reason: host.unconfiguredReason() };
}

/**
 * Host a local file (the normal path: Cole attaches an image, it lands in the
 * vault, publishing needs it reachable).
 */
export async function hostLocalFile(filePath: string): Promise<HostedMedia> {
  const host = mediaHost();
  const reason = host.unconfiguredReason();
  if (reason) throw new Error(reason);

  const data = await fs.readFile(filePath);
  const ext = path.extname(filePath).replace(".", "").toLowerCase();
  const contentType =
    Object.entries(EXT_BY_TYPE).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  return host.put({ data, contentType, extension: ext });
}

/** Host raw bytes (a generated or fetched image). */
export async function hostBytes(data: Buffer, contentType: string): Promise<HostedMedia> {
  const host = mediaHost();
  const reason = host.unconfiguredReason();
  if (reason) throw new Error(reason);
  return host.put({ data, contentType, extension: EXT_BY_TYPE[contentType] ?? "bin" });
}

/**
 * Resolve whatever the caller has into a URL Meta can fetch.
 *
 * Accepts an already-public http(s) URL (passed straight through — Cole may
 * have hosted it himself) or a local path (hosted first). A localhost or
 * private-network URL is REJECTED rather than passed on: Meta cannot reach it,
 * and the Graph error for that is opaque enough to cost an hour.
 */
export async function resolvePublicMediaUrl(input: string): Promise<string> {
  const value = (input ?? "").trim();
  if (!value) throw new Error("No image given to publish.");

  if (/^https?:\/\//i.test(value)) {
    const host = new URL(value).hostname.toLowerCase();
    const unreachable =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (unreachable) {
      throw new Error(
        `${value} is only reachable from inside your network — Instagram fetches the image from its own servers and will fail. ` +
          "Set MEDIA_PUBLIC_BASE_URL to a publicly reachable origin."
      );
    }
    return value;
  }

  const hosted = await hostLocalFile(value);
  return hosted.url;
}
