// aurelius/core/backup.ts
//
// THE BACKUP LAYER (check-in council PR2). The second brain lives in exactly
// one database; before this file there was no copy anywhere. Nightly pg_dump
// (custom format, compressed — restore with pg_restore) into a gitignored
// dir, pruned to a retention window. Runs at 02:00 via the spine + catch-up,
// and boot warns loudly when the newest dump is stale (hard rule 3: honest
// failure, once, with the fix).
//
// Deploy notes: the Codespace ships pg_dump; the Railway/Mini runbooks
// install postgresql-client. On the Mini, point AURELIUS_BACKUP_DIR at the
// UGREEN NAS mount and this same file becomes the NAS backup — no rework.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const pexec = promisify(execFile);

const BACKUP_DIR = process.env.AURELIUS_BACKUP_DIR ?? path.resolve(process.cwd(), "backups");
const KEEP = Math.max(2, Number(process.env.AURELIUS_BACKUP_KEEP ?? 14));
const STALE_HOURS = 48;

function listDumps(): { file: string; mtime: number }[] {
  try {
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("aurelius-") && f.endsWith(".dump"))
      .map((f) => ({ file: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

export async function runDbBackup(): Promise<{ ok: boolean; file?: string; bytes?: number; error?: string }> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, error: "DATABASE_URL not set — nothing to back up" };
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(BACKUP_DIR, `aurelius-${stamp}.dump`);
  try {
    // Mount marker (6.2): prove BACKUP_DIR is actually writable before trusting
    // it. On the Mini this points at a NAS mount — if the mount drops, mkdirSync
    // can succeed against the empty mountpoint while the real target is gone. A
    // marker write-then-read catches a silently-unmounted target.
    const marker = path.join(BACKUP_DIR, ".backup-writable");
    fs.writeFileSync(marker, String(Date.now()));
    if (!fs.existsSync(marker)) throw new Error(`backup dir ${BACKUP_DIR} is not writable (mount dropped?)`);

    await pexec("pg_dump", ["--no-owner", "--no-privileges", "-Fc", "-f", file, url], {
      maxBuffer: 64 * 1024 * 1024,
    });
    const bytes = fs.statSync(file).size;
    if (bytes < 1024) throw new Error(`dump suspiciously small (${bytes} bytes)`);
    // VERIFY the archive is READABLE, not merely the right size (6.2). A
    // truncated or corrupt dump passes a byte count but fails here — pg_restore
    // --list parses the archive's table of contents. Count the entries as a
    // floor: a real Aurelius dump has dozens of tables and indexes, so a handful
    // means the dump is broken however many bytes it is.
    const toc = await pexec("pg_restore", ["--list", file], { maxBuffer: 32 * 1024 * 1024 });
    const entries = (toc.stdout ?? "").split("\n").filter((l) => /\b(TABLE DATA|TABLE|INDEX|SEQUENCE)\b/.test(l)).length;
    if (entries < 10) throw new Error(`dump verification failed — only ${entries} restorable entries (corrupt or truncated?)`);
    // Prune beyond retention — newest first, keep KEEP.
    for (const old of listDumps().slice(KEEP)) {
      try { fs.unlinkSync(old.file); } catch {}
    }
    console.log(`[backup] ${path.basename(file)} written (${(bytes / 1024).toFixed(0)} KB), keeping ${KEEP}`);
    return { ok: true, file, bytes };
  } catch (err: any) {
    try { fs.unlinkSync(file); } catch {}
    const msg = err?.message ?? String(err);
    console.error(
      `[backup] FAILED: ${msg}` +
        (/ENOENT/.test(msg) ? " — pg_dump not installed; apt-get install postgresql-client" : "")
    );
    // Always-on has no boot warning to catch this (go-live council): a failed
    // nightly must reach Cole's queue, once per day, not just a log line.
    try {
      const { prisma } = await import("./db/prisma.ts");
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const already = await prisma.bridgeSignal.findFirst({
        where: { sourceType: "backup_failure", createdAt: { gte: today } },
        select: { id: true },
      });
      if (!already) {
        // Was a raw create at severity "attention" — so it never went through
        // salience (never buzzed), carried no action (so the queue sweep
        // classified it a notice) and EXPIRED at 14 days. "The brain has no
        // fresh copy" would silently age out of the only place it appeared.
        //
        // Now: critical, through surfaceSignal so it pushes, and carrying an
        // acknowledge action so the sweep treats it as a decision rather than
        // a notice to garbage-collect.
        const { surfaceSignal } = await import("./bridge.ts");
        await surfaceSignal({
          kind: "risk",
          domain: "personal",
          sourceType: "backup_failure",
          sourceId: `backup_failure:${new Date().toLocaleDateString("en-CA")}`,
          severity: "critical",
          title: "Nightly backup FAILED — the brain has no fresh copy",
          body: `pg_dump error: ${msg.slice(0, 300)}\n\nUntil this is fixed, the newest dump is whatever last succeeded. ${/ENOENT/.test(msg) ? "Fix: install postgresql-client in the image/host." : "Check DATABASE_URL reachability and pg_dump/server version compatibility."}`,
          actions: [{ label: "Acknowledged", action: "acknowledge", payload: {} }],
        });
      }
    } catch {
      // signal is best-effort — the log line above already fired
    }
    return { ok: false, error: msg };
  }
}

/** Boot honesty: one loud line when the brain has no fresh copy. */
export function warnIfBackupStale(): void {
  const dumps = listDumps();
  if (dumps.length === 0) {
    console.warn(`[backup] NO BACKUPS EXIST in ${BACKUP_DIR} — the second brain has one copy. First dump runs tonight at 02:00 (or run: npx tsx -e "import('./core/backup.ts').then(m=>m.runDbBackup())")`);
    return;
  }
  const ageH = (Date.now() - dumps[0]!.mtime) / 3600_000;
  if (ageH > STALE_HOURS) {
    console.warn(`[backup] newest dump is ${Math.round(ageH)}h old (> ${STALE_HOURS}h) — the 02:00 job hasn't run; check the process was awake overnight.`);
  }
}
