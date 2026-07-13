// aurelius/media/ingestMedia.ts
//
// Media in the CHAT flow. When Cole attaches a photo or video to a normal
// message, Aurelius analyzes it (media/vision.ts) so the model can talk about
// it in-conversation, and — fire-and-forget — files what it saw into the second
// brain so it's remembered and searchable. Not a separate inbox; part of chat.

import { analyzeImage, analyzeVideo, visionConfigured } from "./vision.ts";

export type MediaKind = "image" | "video";

export function mediaKind(mimeType: string): MediaKind | null {
  const m = (mimeType || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  return null;
}

/** Analyze an attached photo/video → text Aurelius can reason over. */
export async function analyzeMedia(
  buffer: Buffer,
  mimeType: string,
  caption?: string
): Promise<{ kind: MediaKind; analysis: string }> {
  const kind = mediaKind(mimeType);
  if (!kind) throw new Error(`unsupported media type: ${mimeType}`);
  if (!visionConfigured()) throw new Error("Missing GEMINI_API_KEY — set it to send Aurelius photos/video");
  const analysis =
    kind === "image"
      ? await analyzeImage(buffer, mimeType, caption)
      : await analyzeVideo(buffer, mimeType, caption);
  return { kind, analysis };
}

/** Remember what was seen — a searchable note in the corpus. Fire-and-forget. */
export async function captureMediaNote(args: {
  kind: MediaKind;
  analysis: string;
  caption?: string;
  filename?: string;
}): Promise<void> {
  try {
    const { ingestDocument } = await import("../corpus/ingest.ts");
    const label = args.caption?.slice(0, 80) || args.filename || `${args.kind} in chat`;
    await ingestDocument({
      title: `[${args.kind}] ${label}`,
      content: (args.caption ? `Caption: ${args.caption}\n\n` : "") + args.analysis,
      sourceType: "upload",
      domain: "personal",
    });
  } catch (err: any) {
    console.warn("[media] capture note failed (non-fatal):", err?.message ?? err);
  }
}
