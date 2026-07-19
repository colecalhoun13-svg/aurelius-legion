// aurelius/research/sources.ts
//
// CONTENT SOURCES — the seam all future content fetchers plug into.
//
// A ContentSource turns a reference (a URL, later a file path or feed id)
// into clean text ready for the ingest pipeline. Consumers — chat actions,
// the curriculum, missions, the freshness sweep — resolve a source by
// reference and never care how the bytes arrive. When the MCP socket lands
// at the Mini deploy (docs/MCP_SPEC.md), an mcpResearchAdapter becomes one
// more implementor of THIS interface; the seam exists so that day is config,
// not surgery.
//
// Every implementor must return DEFUSED text (external content never carries
// an executable directive) and must fail loudly with the fix (hard rule 3).

export type SourcedContent = {
  title: string;
  content: string;   // defused, plain text
  url: string;       // canonical reference (also the natural dedup anchor)
  source: string;    // implementor name, e.g. "youtube_transcript"
};

export type ContentSource = {
  name: string;
  /** Can this source handle the given reference? */
  canHandle(ref: string): boolean;
  /** Fetch + clean. Throws with an honest, actionable message on failure. */
  fetch(ref: string): Promise<SourcedContent>;
};

const sources: ContentSource[] = [];

export function registerContentSource(src: ContentSource): void {
  if (sources.some((s) => s.name === src.name)) return;
  sources.push(src);
}

export function resolveContentSource(ref: string): ContentSource | null {
  return sources.find((s) => s.canHandle(ref)) ?? null;
}

export function listContentSources(): string[] {
  return sources.map((s) => s.name);
}

// ── Built-in implementors ────────────────────────────────────────────
import { youtubeTranscriptSource } from "./youtubeTranscript.ts";
registerContentSource(youtubeTranscriptSource);
