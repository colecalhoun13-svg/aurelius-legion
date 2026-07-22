// aurelius/corpus/upload.ts
//
// RESEARCH DROP — browser-side uploads into the second brain. The same
// hardened pipeline as the inbox folder (extension allowlist, size cap,
// defused filename + body, content-hash dedup, empty-extraction honest
// failure), fed from the Library page instead of the filesystem. One
// shared extractor keeps the two entrances identical.

import crypto from "node:crypto";
import { ingestDocument } from "./ingest.ts";

export const UPLOAD_ALLOWED_EXT = new Set([".md", ".txt", ".pdf"]);
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const MAX_CONTENT_CHARS = 60_000;

export function extOf(filename: string): string {
  const m = /\.[^.]+$/.exec(filename.trim().toLowerCase());
  return m ? m[0] : "";
}

/** Extract plain text from a raw file buffer. Shared by the inbox watcher
 *  and the Research Drop so both entrances behave identically. */
export async function extractTextFromBuffer(buf: Buffer, ext: string): Promise<string> {
  if (ext === ".pdf") {
    // pdf-parse's package entry runs debug code when imported without a parent
    // module — import the library file directly (known ESM quirk, pinned 1.1.1).
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js" as any);
    const parsed = await pdfParse(buf);
    return (parsed?.text ?? "").trim();
  }
  return buf.toString("utf8").trim();
}

export type UploadResult = {
  ok: boolean;
  error?: string;
  doc?: { id: string; title: string; domain: string };
  chunkCount?: number;
  deduped?: boolean;
};

/** Ingest one browser-uploaded file (base64 payload). Honest failures name
 *  the fix; a re-upload of identical content dedups instead of duplicating. */
export async function uploadDocument(input: {
  filename: string;
  contentBase64: string;
  domain?: string;
}): Promise<UploadResult> {
  const filename = (input.filename ?? "").trim();
  if (!filename) return { ok: false, error: "missing filename" };

  const ext = extOf(filename);
  if (!UPLOAD_ALLOWED_EXT.has(ext)) {
    return { ok: false, error: `${ext || "that file type"} isn't ingestible — drop .md, .txt, or .pdf` };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(input.contentBase64 ?? "", "base64");
  } catch {
    return { ok: false, error: "unreadable upload payload" };
  }
  if (buf.length === 0) return { ok: false, error: "empty file" };
  if (buf.length > UPLOAD_MAX_BYTES) {
    return { ok: false, error: `${Math.round(buf.length / 1e6)}MB exceeds the 20MB cap — split it (by chapter works best)` };
  }

  let raw: string;
  try {
    raw = await extractTextFromBuffer(buf, ext);
  } catch (err: any) {
    return { ok: false, error: `could not read ${filename}: ${err?.message ?? err}` };
  }
  if (raw.length < 100) {
    return {
      ok: false,
      error:
        ext === ".pdf"
          ? "no extractable text — a scanned/image PDF needs OCR, which is Paperless's job at the Mini"
          : "no extractable text in that file",
    };
  }

  const { defuseDirectives } = await import("../llm/directiveParser.ts");
  const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);
  const content = defuseDirectives(raw.slice(0, MAX_CONTENT_CHARS));
  const title = defuseDirectives(filename.replace(/\.[^.]+$/, "")).slice(0, 200) || "Uploaded file";

  const r = await ingestDocument({
    title,
    content,
    sourceType: "upload",
    domain: (input.domain ?? "documents").trim() || "documents",
    triggeredBy: "cole",
    dedupKey: `upload:${filename}#${hash}`,
  });
  return {
    ok: true,
    doc: { id: r.doc.id, title: r.doc.title, domain: r.doc.domain },
    chunkCount: r.chunkCount,
    deduped: "deduped" in r ? !!(r as any).deduped : false,
  };
}
