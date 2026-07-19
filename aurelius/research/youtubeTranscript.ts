// aurelius/research/youtubeTranscript.ts
//
// YOUTUBE → TEXT. The first ContentSource implementor: fetches a video's
// caption track keylessly (watch page → player response → timedtext) so the
// best coaching/business content on YouTube can flow into the corpus.
//
// HONEST LIMITS (council, 2026-07-19): there is no official transcript API,
// and YouTube actively blocks datacenter IPs — from a Codespace this WILL
// fail some or most of the time. It is a best-effort chat action, never a
// scheduled dependency; it graduates to reliable on the Mac Mini's home IP.
// Failures are loud, actionable, and never filed as content (hard rule 3).

import type { ContentSource, SourcedContent } from "./sources.ts";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAX_TRANSCRIPT_CHARS = 60_000;

/** Extract a video id from any of the usual URL shapes (or a bare id). */
export function parseYouTubeId(ref: string): string | null {
  const trimmed = ref.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[2];
  }
  return null;
}

function fail(msg: string): never {
  throw new Error(
    `${msg} — YouTube blocks many datacenter IPs and has no official transcript API; this works reliably from the Mac Mini's home connection.`
  );
}

async function fetchTranscript(videoId: string): Promise<{ title: string; text: string }> {
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
  });
  if (!watchRes.ok) fail(`YouTube watch page returned ${watchRes.status}`);
  const html = await watchRes.text();

  const title =
    html.match(/<meta name="title" content="([^"]*)"/)?.[1]?.trim() || `YouTube video ${videoId}`;

  // The caption track list lives in the inline player response.
  const tracksJson = html.match(/"captionTracks":(\[.*?\])/)?.[1];
  if (!tracksJson) fail("no caption tracks found (captions disabled, or YouTube served a consent/block page)");
  let tracks: any[];
  try {
    tracks = JSON.parse(tracksJson);
  } catch {
    fail("could not parse the caption track list");
  }
  const track =
    tracks.find((t) => t?.languageCode?.startsWith("en") && !t?.kind) ??
    tracks.find((t) => t?.languageCode?.startsWith("en")) ??
    tracks[0];
  if (!track?.baseUrl) fail("caption track has no fetchable URL");

  const ttRes = await fetch(`${track.baseUrl}&fmt=json3`, { headers: { "User-Agent": UA } });
  if (!ttRes.ok) fail(`transcript fetch returned ${ttRes.status}`);
  const tt: any = await ttRes.json().catch(() => fail("transcript response was not JSON"));

  const text = (tt?.events ?? [])
    .flatMap((e: any) => (e?.segs ?? []).map((s: any) => s?.utf8 ?? ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 100) fail("transcript came back empty");
  return { title, text };
}

export const youtubeTranscriptSource: ContentSource = {
  name: "youtube_transcript",
  canHandle: (ref) => parseYouTubeId(ref) !== null,
  async fetch(ref): Promise<SourcedContent> {
    const id = parseYouTubeId(ref);
    if (!id) throw new Error(`not a YouTube URL or video id: ${ref}`);
    const { title, text } = await fetchTranscript(id);
    const { defuseDirectives } = await import("../llm/directiveParser.ts");
    return {
      title: defuseDirectives(title).slice(0, 200),
      content: defuseDirectives(text.slice(0, MAX_TRANSCRIPT_CHARS)),
      url: `https://www.youtube.com/watch?v=${id}`,
      source: "youtube_transcript",
    };
  },
};
