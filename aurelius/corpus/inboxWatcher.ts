// aurelius/corpus/inboxWatcher.ts
//
// DROP A FILE, THE BRAIN LEARNS IT. A deterministic poller on one folder
// (INGEST_WATCH_DIR): every 10 minutes, new .md/.txt/.pdf files flow through
// the four-write ingestion pipeline — no LLM in the loop, same shape as the
// Paperless poller. Dormant until the env var lands (hard rule 4).
//
// Council-hardened (red team, 2026-07-19):
//   • vault-overlap refusal — watching the vault mirror would self-ingest
//     Aurelius's own exhaust in a loop; refused loudly at start
//   • stability gate — a file is ingested only after a full poll cycle with
//     unchanged size+mtime, so a half-copied file is never read
//   • content-hash dedup — dedupKey inbox:<name>#<hash> makes edits re-ingest
//     as a new revision while unchanged files never duplicate
//   • extension allowlist + size cap — .md/.txt/.pdf only, ≤20MB, no archives
//   • defused filenames AND bodies — dropped content is external content
//   • empty-extraction loud skip — a scanned PDF never files a hollow doc
//   • per-file attempt cap — one poison file can't block the queue

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { runTraced } from "../core/trace.ts";
import { ingestDocument } from "./ingest.ts";

const ALLOWED_EXT = new Set([".md", ".txt", ".pdf"]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_CONTENT_CHARS = 60_000; // same ceiling as the Paperless poller
const MAX_FILE_ATTEMPTS = 3;
const POLL_MS = 10 * 60 * 1000;

function watchDir(): string | null {
  const dir = process.env.INGEST_WATCH_DIR?.trim();
  return dir ? path.resolve(dir) : null;
}

function vaultDir(): string {
  // Must match wiki/vaultMirror.ts — the one folder we must never watch.
  return path.resolve(process.env.VAULT_DIR?.trim() || path.resolve(process.cwd(), "vault"));
}

/** The self-ingest loop guard: the watch dir may not contain, equal, or live
 *  inside the vault mirror (vault/ is Aurelius's own exhaust). */
export function vaultOverlapReason(dir: string): string | null {
  const watch = path.resolve(dir);
  const vault = vaultDir();
  const inside = (a: string, b: string) => a === b || a.startsWith(b + path.sep);
  if (inside(watch, vault)) return `watch dir is inside the vault mirror (${vault})`;
  if (inside(vault, watch)) return `watch dir contains the vault mirror (${vault})`;
  return null;
}

// Stability gate state: last poll's (size, mtime) per file. In-memory is
// enough — a restart just costs one extra poll cycle before ingest.
const lastSeen = new Map<string, { size: number; mtimeMs: number }>();
// Files fully handled this process lifetime (ingested or deliberately
// skipped); cross-restart idempotency comes from ingestDocument's dedupKey.
const handled = new Set<string>();
const fileAttempts = new Map<string, number>();

async function extractText(filePath: string, ext: string): Promise<string> {
  // One extractor for both entrances (folder + Research Drop upload).
  const { extractTextFromBuffer } = await import("./upload.ts");
  return extractTextFromBuffer(await fs.readFile(filePath), ext);
}

export async function pollInboxOnce(): Promise<
  | { dormant: true }
  | { dormant: false; error: string }
  | { dormant: false; ingested: number; pendingStability: number; skipped: number }
> {
  const dir = watchDir();
  if (!dir) return { dormant: true };

  const overlap = vaultOverlapReason(dir);
  if (overlap) {
    // Fail loudly, once per poll, with the fix — never ingest (hard rule 3).
    const error = `INGEST_WATCH_DIR refused: ${overlap}. Point it at a plain drop folder, not the vault.`;
    console.error(`[inbox] ${error}`);
    return { dormant: false, error };
  }

  let names: string[];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    // Top-level plain files only — no directories, no symlinks (path tricks).
    names = entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch (err: any) {
    const error = `INGEST_WATCH_DIR unreadable (${dir}): ${err?.message ?? err}`;
    console.error(`[inbox] ${error}`);
    return { dormant: false, error };
  }

  const { defuseDirectives } = await import("../llm/directiveParser.ts");
  let ingested = 0;
  let pendingStability = 0;
  let skipped = 0;

  for (const name of names) {
    const ext = path.extname(name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) continue; // not ours (allowlist kills archives)

    const filePath = path.join(dir, name);
    // Containment: resolved path must stay under the watch root.
    if (!path.resolve(filePath).startsWith(dir + path.sep)) continue;

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      lastSeen.delete(name);
      continue; // vanished between readdir and stat
    }

    if (stat.size > MAX_FILE_BYTES) {
      if (!handled.has(name)) {
        console.warn(`[inbox] skipping ${name}: ${Math.round(stat.size / 1e6)}MB exceeds the 20MB cap`);
        handled.add(name);
      }
      skipped++;
      continue;
    }

    // Stability gate: only touch files unchanged since the PREVIOUS poll.
    const prev = lastSeen.get(name);
    lastSeen.set(name, { size: stat.size, mtimeMs: stat.mtimeMs });
    if (!prev || prev.size !== stat.size || prev.mtimeMs !== stat.mtimeMs) {
      handled.delete(`${name}`); // an edit re-arms the file (new hash → new revision)
      pendingStability++;
      continue;
    }
    if (handled.has(name)) continue; // done this lifetime; dedupKey guards restarts

    try {
      const raw = await extractText(filePath, ext);
      if (raw.length < 100) {
        console.warn(
          `[inbox] skipping ${name}: no extractable text${ext === ".pdf" ? " (scanned PDF? OCR is Paperless's job at the Mini)" : ""}`
        );
        handled.add(name);
        skipped++;
        continue;
      }

      const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);
      // Dropped files are EXTERNAL content: defuse the body and the filename
      // (both enter prompts) before anything downstream sees them.
      const content = defuseDirectives(raw.slice(0, MAX_CONTENT_CHARS));
      const title = defuseDirectives(path.basename(name, ext)).slice(0, 200) || "Dropped file";

      await ingestDocument({
        title,
        content,
        sourceType: "upload",
        domain: "documents",
        triggeredBy: "cole", // Cole dropped it — his hand, his intent
        // Provenance + idempotency in one key: filename anchors WHERE it came
        // from, the content hash makes an edited file a NEW revision while an
        // unchanged one never duplicates (restarts, cursor loss, re-polls).
        dedupKey: `inbox:${name}#${hash}`,
      });
      ingested++;
      handled.add(name);
      fileAttempts.delete(name);
    } catch (err) {
      const attempts = (fileAttempts.get(name) ?? 0) + 1;
      fileAttempts.set(name, attempts);
      if (attempts >= MAX_FILE_ATTEMPTS) {
        console.error(
          `[inbox] ${name} failed ${attempts}× — skipping it so it can't block the folder:`,
          (err as any)?.message ?? err
        );
        handled.add(name);
        fileAttempts.delete(name);
        skipped++;
      } else {
        console.warn(`[inbox] ingest failed for ${name} (attempt ${attempts}/${MAX_FILE_ATTEMPTS}, will retry):`, err);
      }
    }
  }

  if (ingested > 0) console.log(`[inbox] ingested ${ingested} dropped file(s)`);
  return { dormant: false, ingested, pendingStability, skipped };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startInboxWatcher() {
  const dir = watchDir();
  if (!dir) {
    console.log("[inbox] no INGEST_WATCH_DIR — drop-folder ingest dormant");
    return;
  }
  const overlap = vaultOverlapReason(dir);
  if (overlap) {
    console.error(`[inbox] REFUSING to start: ${overlap}. Fix INGEST_WATCH_DIR and restart.`);
    return;
  }
  if (timer) return;
  console.log(`[inbox] watching ${dir} (every 10 min; drop .md/.txt/.pdf)`);
  timer = setInterval(() => {
    runTraced("poll", "ingest_inbox", () => pollInboxOnce()).catch((err) =>
      console.warn("[inbox] poll failed:", err)
    );
  }, POLL_MS);
  runTraced("poll", "ingest_inbox", () => pollInboxOnce()).catch(() => {});
}
