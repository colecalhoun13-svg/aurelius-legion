// aurelius/tools/adapters/googleSheets.ts
//
// Google Sheets tool adapter.
//
// Phase 3 actions:
//   - log_session       : append session rows to athlete sheet
//   - read_sessions     : read recent session data from athlete sheet
//   - read_dashboard    : read athlete dashboard tab (identity + metrics)
//   - list_athletes     : list all registered athletes (queries memory, not Sheets API)
//
// Phase 4 actions (training reasoning):
//   - read_block        : pull sessions from one or more day tabs (broader than read_sessions)
//   - write_feedback    : append a journalistic-with-structure block to Tab 4 (Aurelius Feedback)
//   - update_max        : write/update a row in the Maxes tab on PR detection
//   - review_recent     : meta-action for the δ batch flow (find recent sessions across athletes)
//
// Auth wiring: this file expects a configured Sheets client provided by
// googleAuth.ts. The client uses a service account; sheets must be shared
// with the service account email.
//
// IMPORTANT: action data uses `client` (the athlete's name) — Aurelius
// must NEVER pass a `sheetId` directly. The chat endpoint resolves
// `client` → real sheetId via memory before this adapter runs.
//
// Architectural note: list_athletes and review_recent query Aurelius's
// own memory rather than the Sheets API. They live on this adapter for
// pragmatism. In a future phase a dedicated "aurelius_memory" tool
// adapter may extract them.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { getSheetsClient, getDriveClient } from "./googleAuth.ts";
import { prisma } from "../../core/db/prisma.ts";
import { saveMemory } from "../../memory/memoryService.ts";

/**
 * Live name → sheet lookup against Cole's Drive (as him, via OAuth). This is what
 * makes "pull up Jake's sheet" work with NO pre-registration — Aurelius searches
 * his spreadsheets by name and picks the best match. Returns null on no/ambiguous
 * match so the caller can ask. Best match = exact (case-insensitive) name, else a
 * single "name contains" hit; multiple partial hits → null (don't guess).
 */
export async function searchDriveForSheet(
  name: string
): Promise<{ sheetId: string; title: string } | null> {
  const drive = await getDriveClient();
  if (!drive || !name?.trim()) return null;
  const q = name.trim().replace(/'/g, "\\'");
  try {
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains '${q}'`,
      fields: "files(id, name)",
      pageSize: 20,
    });
    const files = (res.data.files ?? []).filter((f) => f.id && f.name) as Array<{ id: string; name: string }>;
    if (files.length === 0) return null;
    const target = name.trim().toLowerCase();
    const exact = files.find((f) => f.name.toLowerCase() === target);
    if (exact) return { sheetId: exact.id, title: exact.name };
    // Also treat "<name>" matching a title that STARTS with the name as strong
    // (e.g. "Jake" → "Jake Powerlifting Block").
    const starts = files.filter((f) => f.name.toLowerCase().startsWith(target));
    if (starts.length === 1) return { sheetId: starts[0].id, title: starts[0].name };
    if (files.length === 1) return { sheetId: files[0].id, title: files[0].name };
    return null; // ambiguous — let the caller ask which one
  } catch (err) {
    console.warn("[googleSheets] drive name search failed:", (err as any)?.message ?? err);
    return null;
  }
}

/** All Drive matches for a name — for find_sheet and for honest ambiguity
 *  answers ("which of these did you mean?") instead of a null shrug. */
// When Drive search FAILS (not "no matches" — actually errors), remember why,
// so "0 results" can be reported honestly. The classic: Cole's stored Google
// token predates the drive.readonly scope → every search 403s and looks empty.
let lastDriveSearchError: string | null = null;

export function driveSearchProblem(): string | null {
  if (!lastDriveSearchError) return null;
  return /insufficient|permission|403|scope/i.test(lastDriveSearchError)
    ? "Google authorization predates Drive/Sheets access — re-authorize once at /api/calendar/auth (the consent screen must list Drive and Sheets), then retry"
    : `Drive search errored: ${lastDriveSearchError.slice(0, 200)}`;
}

export async function listDriveSheets(name: string, limit = 8): Promise<Array<{ sheetId: string; title: string }>> {
  const drive = await getDriveClient();
  if (!name?.trim()) return [];
  if (!drive) {
    lastDriveSearchError = "no Google client — authorize at /api/calendar/auth";
    return [];
  }
  const q = name.trim().replace(/'/g, "\\'");
  try {
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains '${q}'`,
      fields: "files(id, name)",
      pageSize: limit,
    });
    lastDriveSearchError = null;
    return ((res.data.files ?? []) as Array<{ id?: string; name?: string }>)
      .filter((f) => f.id && f.name)
      .map((f) => ({ sheetId: f.id!, title: f.name! }));
  } catch (err) {
    lastDriveSearchError = (err as any)?.message ?? String(err);
    console.warn("[googleSheets] drive list search failed:", lastDriveSearchError);
    return [];
  }
}

function looksLikeSheetId(s: string): boolean {
  return /^[A-Za-z0-9_-]{25,}$/.test(s.trim());
}

/** Name-or-id → concrete sheet. Ambiguity returns the candidates so the
 *  model can ask Cole instead of guessing. (Flat shape — this tsconfig
 *  doesn't narrow discriminated unions.) */
type SheetRef = { ok: boolean; sheetId?: string; title?: string; error?: string; candidates: Array<{ sheetId: string; title: string }> };

async function resolveSheetRef(ref: string): Promise<SheetRef> {
  const r = (ref ?? "").trim();
  if (!r) return { ok: false, error: "empty sheet reference", candidates: [] };
  if (looksLikeSheetId(r)) return { ok: true, sheetId: r, title: r, candidates: [] };
  const hit = await searchDriveForSheet(r);
  if (hit) return { ok: true, ...hit, candidates: [] };
  const candidates = await listDriveSheets(r);
  return {
    ok: false,
    error:
      candidates.length === 0
        ? driveSearchProblem() ?? `no spreadsheet named anything like "${r}" in Cole's Drive — try a shorter name fragment`
        : `"${r}" is ambiguous — candidates: ${candidates.map((c) => c.title).join(" · ")}`,
    candidates,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ACTION DEFINITIONS (for the tool catalog injected into LLM prompt)
// ═══════════════════════════════════════════════════════════════════

const ACTIONS = [
  {
    name: "find_sheet",
    description:
      "Search Cole's Drive for ANY spreadsheet by (partial) name — not just athlete sheets. Use when Cole names a sheet ('go into my Devo/Prep Cycle sheet') to locate it before reading.",
    dataSchema: '{ "name": string (partial name is fine) }',
    example: '[TOOL: tool=google_sheets action=find_sheet data={"name":"Devo/Prep Cycle"}]',
  },
  {
    name: "list_tabs",
    description:
      "List the tab names inside any spreadsheet, so exact tab names can be read next. Use after find_sheet, or directly when Cole names the sheet.",
    dataSchema: '{ "sheet": string (spreadsheet name or id) }',
    example: '[TOOL: tool=google_sheets action=list_tabs data={"sheet":"Devo/Prep Cycle 1/12/26"}]',
  },
  {
    name: "read_tabs",
    description:
      "Read the contents of one or more tabs from ANY spreadsheet Cole names — his own programs, planning docs, anything (not just athlete sheets). Returns the cell data as text. Use list_tabs first if tab names are uncertain. Set ingest:true only when Cole says to remember/learn it.",
    dataSchema: '{ "sheet": string (name or id), "tabs": string[] (exact tab names, up to 8), "ingest"?: boolean (store into the second brain) }',
    example: '[TOOL: tool=google_sheets action=read_tabs data={"sheet":"Devo/Prep Cycle 1/12/26","tabs":["WEEK 2 11/24/25","WEEK 3 12/1/25"]}]',
  },
  {
    name: "log_session",
    description: "Append a training session to an athlete's program tab. Use when Cole logs what an athlete did in a session. Reference the athlete by name only — sheet IDs are resolved automatically.",
    dataSchema: '{ client: string (athlete name as Cole says it), dayTab: string (e.g. "Day 1"), date: string (YYYY-MM-DD), exercises: [{ name: string, sets: string, reps: string, load: string, tempo?: string, rpe?: number, notes?: string }] }',
    example: '[TOOL: tool=google_sheets action=log_session data={"client":"Mike","dayTab":"Day 1","date":"2026-04-30","exercises":[{"name":"Hack Squat","sets":"3","reps":"8,6,6","load":"155/185/185","rpe":8}]}]',
  },
  {
    name: "read_sessions",
    description: "Read recent session rows from an athlete's program tab. Use when Cole asks what an athlete has done recently. Reference the athlete by name only.",
    dataSchema: '{ client: string (athlete name), dayTab: string, limit?: number (default 20) }',
    example: '[TOOL: tool=google_sheets action=read_sessions data={"client":"Mike","dayTab":"Day 1","limit":10}]',
  },
  {
    name: "read_dashboard",
    description: "Read an athlete's dashboard tab — identity, sport, season, performance metrics. Use when Cole asks about an athlete profile or metrics. Reference the athlete by name only.",
    dataSchema: '{ client: string (athlete name) }',
    example: '[TOOL: tool=google_sheets action=read_dashboard data={"client":"Mike"}]',
  },
  {
    name: "list_athletes",
    description: "List all athletes Cole has registered with Aurelius. Use when Cole asks 'who are my athletes', 'roster', 'list my clients', etc. No parameters — returns all registered athletes from memory.",
    dataSchema: '{} (no parameters required)',
    example: '[TOOL: tool=google_sheets action=list_athletes data={}]',
  },
  {
    name: "read_block",
    description: "Pull all session rows across one or more day tabs for an athlete. Used by training reasoning for block-level analysis (volume trends, week-over-week deltas). Returns more comprehensive data than read_sessions.",
    dataSchema: '{ client: string (athlete name), dayTabs?: string[] (default: ["Day 1","Day 2","Day 3","Day 4"]), limit?: number (default 80 total rows) }',
    example: '[TOOL: tool=google_sheets action=read_block data={"client":"Mike","dayTabs":["Day 1","Day 2"]}]',
  },
  {
    name: "write_feedback",
    description: "Append a coaching feedback block to an athlete's 'Aurelius Feedback' tab. Used after training reasoning has analyzed a session. Each call appends one dated block; never rewrites prior entries. Cole's eyes only — athletes never see this tab.",
    dataSchema: '{ client: string (athlete name), date: string (YYYY-MM-DD), header: string (e.g. "Mike · Day 1"), session: string (paragraph), volume: string (paragraph), prs?: string (paragraph, omit if no PRs), observation: string (closing paragraph) }',
    example: '[TOOL: tool=google_sheets action=write_feedback data={"client":"Mike","date":"2026-05-01","header":"Mike · Day 1","session":"Solid lower-body session.","volume":"6,340 lb across 9 working sets, +8% week-over-week.","observation":"Watch RPE next session."}]',
  },
  {
    name: "update_max",
    description: "Write or update a row in the athlete's 'Maxes' tab when a new estimated 1RM PR is detected. Appends a new row tagged with the date. The Maxes tab serves as the canonical PR record over time.",
    dataSchema: '{ client: string (athlete name), exercise: string, estimated1RM: number, fromLoad: number, fromReps: number, date: string (YYYY-MM-DD), previousBest?: number, improvementPct?: number }',
    example: '[TOOL: tool=google_sheets action=update_max data={"client":"Mike","exercise":"Hack Squat","estimated1RM":215,"fromLoad":185,"fromReps":6,"date":"2026-05-01","previousBest":210,"improvementPct":2}]',
  },
  {
    name: "review_recent",
    description: "Find recent training sessions across all registered athletes that warrant Aurelius review. Used for end-of-day batch reasoning (the δ flow). Returns sessions logged in the last N days that meet the analysis threshold (≥3 exercises with ≥1 working set). Does NOT do reasoning itself — just surfaces what's worth reasoning about.",
    dataSchema: '{ days?: number (default 1, look back N days), minExercises?: number (default 3), minWorkingSets?: number (default 1) }',
    example: '[TOOL: tool=google_sheets action=review_recent data={"days":2}]',
  },
  {
    name: "sync_roster",
    description:
      "Discover and register athlete sheets automatically. Lists every spreadsheet shared with Aurelius's service account (share ONE Drive folder once — everything inside inherits) and registers any not-yet-registered sheet as an athlete, deriving the name from the file title. Use when Cole says 'sync my roster' / 'find my athlete sheets' / after sharing new sheets.",
    dataSchema: "{} (no fields)",
  },
];

// ═══════════════════════════════════════════════════════════════════
// SHEET ID VALIDATION
// Real Google sheet IDs are at least 20 chars long and contain a mix
// of upper/lowercase letters, digits, hyphens, and underscores.
// "abc123" or any short fake-looking string fails this check.
// ═══════════════════════════════════════════════════════════════════

function looksLikeRealSheetId(id: any): boolean {
  if (typeof id !== "string") return false;
  if (id.length < 20) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// ═══════════════════════════════════════════════════════════════════
// ACTION IMPLEMENTATIONS — PHASE 3 (unchanged)
// ═══════════════════════════════════════════════════════════════════

async function logSession(data: Record<string, any>): Promise<ToolAdapterResult> {
  const { sheetId, dayTab, date, exercises } = data;

  if (!sheetId || !dayTab || !date || !Array.isArray(exercises) || exercises.length === 0) {
    return {
      ok: false,
      output: null,
      error: "log_session requires sheetId (resolved from client name), dayTab, date, and a non-empty exercises array",
    };
  }

  if (!looksLikeRealSheetId(sheetId)) {
    return {
      ok: false,
      output: null,
      error: `Suspicious sheetId "${sheetId}" — looks fabricated. The chat endpoint should resolve client name → real sheetId from memory before calling this adapter.`,
    };
  }

  const sheets = await getSheetsClient();
  if (!sheets) {
    return {
      ok: false,
      output: null,
      error: "Google Sheets auth not configured. Check service account credentials in .env.",
    };
  }

  const rows: any[][] = exercises.map((ex: any, idx: number) => [
    date,
    idx + 1,
    ex.name ?? "",
    ex.sets ?? "",
    ex.reps ?? "",
    ex.load ?? "",
    ex.tempo ?? "",
    ex.rpe ?? "",
    ex.notes ?? "",
  ]);

  try {
    const range = `${dayTab}!A:I`;
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [],
          ...rows,
        ],
      },
    });

    return {
      ok: true,
      output: {
        summary: `appended ${rows.length} exercise rows for ${date} on tab ${dayTab}`,
        rowsAppended: rows.length,
        updatedRange: response.data.updates?.updatedRange ?? null,
        sheetId,
        dayTab,
        date,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      output: null,
      error: `Sheets append failed: ${err?.message ?? String(err)}`,
    };
  }
}

async function readSessions(data: Record<string, any>): Promise<ToolAdapterResult> {
  const { sheetId, dayTab, limit = 20 } = data;

  if (!sheetId || !dayTab) {
    return {
      ok: false,
      output: null,
      error: "read_sessions requires sheetId (resolved from client name) and dayTab",
    };
  }

  if (!looksLikeRealSheetId(sheetId)) {
    return {
      ok: false,
      output: null,
      error: `Suspicious sheetId "${sheetId}" — looks fabricated.`,
    };
  }

  const sheets = await getSheetsClient();
  if (!sheets) {
    return {
      ok: false,
      output: null,
      error: "Google Sheets auth not configured. Check service account credentials in .env.",
    };
  }

  try {
    const range = `${dayTab}!A:I`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const allRows = response.data.values ?? [];
    const dataRows = allRows.slice(1).filter((r) => r.length > 0 && r.some((cell) => cell !== ""));
    const recent = dataRows.slice(-limit);

    return {
      ok: true,
      output: {
        summary: `read ${recent.length} session rows from ${dayTab}`,
        rows: recent.map((r) => ({
          date: r[0] ?? "",
          number: r[1] ?? "",
          exercise: r[2] ?? "",
          sets: r[3] ?? "",
          reps: r[4] ?? "",
          load: r[5] ?? "",
          tempo: r[6] ?? "",
          rpe: r[7] ?? "",
          notes: r[8] ?? "",
        })),
        rowCount: recent.length,
        sheetId,
        dayTab,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      output: null,
      error: `Sheets read failed: ${err?.message ?? String(err)}`,
    };
  }
}

async function readDashboard(data: Record<string, any>): Promise<ToolAdapterResult> {
  const { sheetId } = data;

  if (!sheetId) {
    return {
      ok: false,
      output: null,
      error: "read_dashboard requires sheetId (resolved from client name)",
    };
  }

  if (!looksLikeRealSheetId(sheetId)) {
    return {
      ok: false,
      output: null,
      error: `Suspicious sheetId "${sheetId}" — looks fabricated.`,
    };
  }

  const sheets = await getSheetsClient();
  if (!sheets) {
    return {
      ok: false,
      output: null,
      error: "Google Sheets auth not configured. Check service account credentials in .env.",
    };
  }

  try {
    const range = "Dashboard!A:Z";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = response.data.values ?? [];

    return {
      ok: true,
      output: {
        summary: `read dashboard tab (${rows.length} rows)`,
        rows,
        sheetId,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      output: null,
      error: `Sheets read failed: ${err?.message ?? String(err)}`,
    };
  }
}

async function listAthletes(_data: Record<string, any>): Promise<ToolAdapterResult> {
  try {
    const registrations = await prisma.memory.findMany({
      where: {
        category: "clients",
        metadata: {
          path: ["kind"],
          equals: "sheet_registration",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const seen = new Set<string>();
    const athletes: Array<{
      name: string;
      sport: string | null;
      position: string | null;
      registeredAt: string;
    }> = [];

    for (const m of registrations) {
      const meta = m.metadata as any;
      const name = (meta?.clientName ?? "").toString().trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      athletes.push({
        name,
        sport: meta?.sport ?? null,
        position: meta?.position ?? null,
        registeredAt: meta?.registeredAt ?? m.createdAt.toISOString(),
      });
    }

    athletes.sort((a, b) => a.name.localeCompare(b.name));

    return {
      ok: true,
      output: {
        summary: `${athletes.length} registered athlete${athletes.length === 1 ? "" : "s"}`,
        athletes,
        count: athletes.length,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      output: null,
      error: `list_athletes failed: ${err?.message ?? String(err)}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SYNC ROSTER — auto-discovery. Cole shares ONE Drive folder with the
// service account; every spreadsheet inside is visible to Drive's
// files.list. Anything not yet registered becomes an athlete, name
// derived from the file title. Kills the curl-per-athlete step.
// ═══════════════════════════════════════════════════════════════════

/** Strip anything that could be a directive or break out of a memory line —
 *  a sheet title is attacker-influenceable (anyone who shares a sheet with the
 *  discoverable service account controls it), and it gets persisted into the
 *  `clients` memory that's recalled into prompts. Neutralize before storing. */
function sanitizeTitle(title: string): string {
  return String(title ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ") // control chars incl. newlines/tabs
    .replace(/\[(TOOL|SAVE|KNOWLEDGE_UPDATE_PROPOSE|KNOWLEDGE_UPDATE_CONFIRM)\b/gi, "[ ") // defang directive heads
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** "Mike Johnson — In-Season 2026 Program" -> "Mike Johnson". Cut at the first
 *  separator (incl. ':'), strip boilerplate + years. Returns "" when the result
 *  is empty/pure-boilerplate — the caller then SKIPS and asks rather than
 *  registering a garbage name ("3B", "Squat", "Training Log 2026"). */
function deriveClientName(title: string): string {
  const clean = sanitizeTitle(title);
  const cut = clean.split(/\s*[\u2014\u2013|:]\s*|\s+-\s+|[([]/)[0] ?? clean;
  const stripped = cut
    .replace(/\b(program|training|sheet|log|tracker|template|in-?season|off-?season|block|phase|day\s*\d+|20\d{2})\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped || !/[a-z]/i.test(stripped) || /^\d+[a-z]?$/i.test(stripped)) return "";
  return stripped;
}

async function syncRoster(_data: Record<string, any>): Promise<ToolAdapterResult> {
  const drive = await getDriveClient();
  if (!drive) {
    return {
      ok: false,
      output: null,
      error:
        "Google Sheets is not configured — set GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH to the service-account JSON, then share your athlete folder with its client_email.",
    };
  }

  try {
    // Everything the service account can see IS the roster — Cole only shares
    // athlete sheets (or one folder of them) with it.
    const files: Array<{ id: string; name: string }> = [];
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: "nextPageToken, files(id, name)",
        pageSize: 100,
        pageToken,
      });
      for (const f of res.data.files ?? []) {
        if (f.id && f.name) files.push({ id: f.id, name: f.name });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    if (files.length === 0) {
      return {
        ok: true,
        output: {
          summary:
            "No spreadsheets are shared with Aurelius yet. Share your athlete folder (or sheets) with the service account's client_email, then run sync again.",
          registered: [],
          skipped: [],
        },
      };
    }

    // Existing registrations — never overwrite; an already-registered sheetId is
    // skipped, and a NAME collision on a different sheet is surfaced, not guessed.
    const existing = await prisma.memory.findMany({
      where: { category: "clients", metadata: { path: ["kind"], equals: "sheet_registration" } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const knownSheetIds = new Set<string>();
    const knownNames = new Map<string, string>(); // lowercased name → sheetId
    for (const m of existing) {
      const meta = m.metadata as any;
      if (meta?.sheetId) knownSheetIds.add(meta.sheetId);
      const nm = (meta?.clientName ?? "").toString().toLowerCase().trim();
      if (nm && meta?.sheetId && !knownNames.has(nm)) knownNames.set(nm, meta.sheetId);
    }

    const registered: Array<{ name: string; title: string }> = [];
    const skipped: Array<{ title: string; reason: string }> = [];

    for (const f of files) {
      if (knownSheetIds.has(f.id)) {
        skipped.push({ title: f.name, reason: "already registered" });
        continue;
      }
      const safeTitle = sanitizeTitle(f.name);
      const name = deriveClientName(f.name);
      // Couldn't derive a clean name (title-first, label-only, or pure boilerplate)
      // → don't register a garbage name; ask Cole to name it explicitly.
      if (!name) {
        skipped.push({
          title: safeTitle,
          reason: `couldn't read an athlete name from "${safeTitle}" — register it manually with a name (POST /api/aurelius/register-sheet)`,
        });
        continue;
      }
      const nameKey = name.toLowerCase();
      if (knownNames.has(nameKey) && knownNames.get(nameKey) !== f.id) {
        skipped.push({
          title: safeTitle,
          reason: `name "${name}" is already registered to a different sheet — register this one manually with a distinct name (POST /api/aurelius/register-sheet)`,
        });
        continue;
      }

      await saveMemory({
        operator: "training",
        category: "clients",
        value: `${name} — registered training sheet (auto-discovered from "${safeTitle}")`,
        relatedOperators: ["business"],
        metadata: {
          clientName: name,
          sheetId: f.id,
          sheetTitle: safeTitle,
          sport: null,
          position: null,
          registeredAt: new Date().toISOString(),
          kind: "sheet_registration",
          registeredVia: "sync_roster",
        },
      });
      knownNames.set(nameKey, f.id);
      registered.push({ name, title: safeTitle });
    }

    const summary =
      registered.length > 0
        ? `Registered ${registered.length} athlete${registered.length === 1 ? "" : "s"}: ${registered
            .map((r) => r.name)
            .join(", ")}${skipped.length ? ` · ${skipped.length} skipped` : ""}. If any name looks wrong, tell Cole to re-register that one manually.`
        : `Nothing new — ${skipped.length} sheet${skipped.length === 1 ? "" : "s"} already registered or skipped.`;

    return { ok: true, output: { summary, registered, skipped } };
  } catch (err: any) {
    return { ok: false, output: null, error: `sync_roster failed: ${err?.message ?? String(err)}` };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACTION IMPLEMENTATIONS — PHASE 4 (training reasoning)
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_DAY_TABS = ["Day 1", "Day 2", "Day 3", "Day 4"];

async function readBlock(data: Record<string, any>): Promise<ToolAdapterResult> {
  const { sheetId, dayTabs = DEFAULT_DAY_TABS, limit = 80 } = data;

  if (!sheetId) {
    return {
      ok: false,
      output: null,
      error: "read_block requires sheetId (resolved from client name)",
    };
  }

  if (!looksLikeRealSheetId(sheetId)) {
    return {
      ok: false,
      output: null,
      error: `Suspicious sheetId "${sheetId}" — looks fabricated.`,
    };
  }

  if (!Array.isArray(dayTabs) || dayTabs.length === 0) {
    return {
      ok: false,
      output: null,
      error: "read_block requires a non-empty dayTabs array",
    };
  }

  const sheets = await getSheetsClient();
  if (!sheets) {
    return {
      ok: false,
      output: null,
      error: "Google Sheets auth not configured.",
    };
  }

  type Row = {
    date: string; number: string; exercise: string;
    sets: string; reps: string; load: string;
    tempo: string; rpe: string; notes: string;
    dayTab: string;
  };

  const allRows: Row[] = [];
  const tabResults: Array<{ dayTab: string; rowCount: number; error?: string }> = [];

  for (const tab of dayTabs as string[]) {
    try {
      const range = `${tab}!A:I`;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
      });
      const raw = response.data.values ?? [];
      const dataRows = raw.slice(1).filter((r) => r.length > 0 && r.some((c) => c !== ""));
      tabResults.push({ dayTab: tab, rowCount: dataRows.length });

      for (const r of dataRows) {
        allRows.push({
          date: r[0] ?? "",
          number: r[1] ?? "",
          exercise: r[2] ?? "",
          sets: r[3] ?? "",
          reps: r[4] ?? "",
          load: r[5] ?? "",
          tempo: r[6] ?? "",
          rpe: r[7] ?? "",
          notes: r[8] ?? "",
          dayTab: tab,
        });
      }
    } catch (err: any) {
      // Tab may not exist on this sheet — record but don't fail the whole call
      tabResults.push({ dayTab: tab, rowCount: 0, error: err?.message ?? String(err) });
    }
  }

  // Sort all rows by date ascending, take last `limit` to keep payload bounded
  allRows.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = allRows.slice(-limit);

  return {
    ok: true,
    output: {
      summary: `read ${trimmed.length} session rows across ${dayTabs.length} day tab(s)`,
      rows: trimmed,
      rowCount: trimmed.length,
      tabResults,
      sheetId,
    },
  };
}

async function writeFeedback(data: Record<string, any>): Promise<ToolAdapterResult> {
  const { sheetId, date, header, session, volume, prs, observation } = data;

  if (!sheetId || !date || !header || !session) {
    return {
      ok: false,
      output: null,
      error: "write_feedback requires sheetId, date, header, and session at minimum",
    };
  }

  if (!looksLikeRealSheetId(sheetId)) {
    return {
      ok: false,
      output: null,
      error: `Suspicious sheetId "${sheetId}" — looks fabricated.`,
    };
  }

  const sheets = await getSheetsClient();
  if (!sheets) {
    return {
      ok: false,
      output: null,
      error: "Google Sheets auth not configured.",
    };
  }

  // Build the feedback block as a sequence of rows in column A.
  // Each row is a paragraph or a header line. Empty sections are omitted.
  const rows: any[][] = [];
  rows.push([]); // visual divider before this entry
  rows.push([`─── ${date} · ${header} ───`]);
  rows.push([]);
  rows.push([`Session: ${session}`]);
  if (volume) {
    rows.push([]);
    rows.push([`Volume: ${volume}`]);
  }
  if (prs) {
    rows.push([]);
    rows.push([`PRs: ${prs}`]);
  }
  if (observation) {
    rows.push([]);
    rows.push([`Observation: ${observation}`]);
  }

  try {
    const range = "Aurelius Feedback!A:A";
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    return {
      ok: true,
      output: {
        summary: `wrote feedback block for ${date} (${header})`,
        rowsAppended: rows.length,
        updatedRange: response.data.updates?.updatedRange ?? null,
        sheetId,
        date,
        header,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      output: null,
      error: `Feedback append failed (does the sheet have an "Aurelius Feedback" tab?): ${err?.message ?? String(err)}`,
    };
  }
}

async function updateMax(data: Record<string, any>): Promise<ToolAdapterResult> {
  const {
    sheetId,
    exercise,
    estimated1RM,
    fromLoad,
    fromReps,
    date,
    previousBest,
    improvementPct,
  } = data;

  if (!sheetId || !exercise || !estimated1RM || !date) {
    return {
      ok: false,
      output: null,
      error: "update_max requires sheetId, exercise, estimated1RM, and date",
    };
  }

  if (!looksLikeRealSheetId(sheetId)) {
    return {
      ok: false,
      output: null,
      error: `Suspicious sheetId "${sheetId}" — looks fabricated.`,
    };
  }

  const sheets = await getSheetsClient();
  if (!sheets) {
    return {
      ok: false,
      output: null,
      error: "Google Sheets auth not configured.",
    };
  }

  // Maxes tab columns: Date | Exercise | Est 1RM | Best Wt | Best Reps | Previous Best | Δ%
  const row = [
    date,
    exercise,
    estimated1RM,
    fromLoad ?? "",
    fromReps ?? "",
    previousBest ?? "",
    improvementPct !== undefined && improvementPct !== null ? `${improvementPct}%` : "",
  ];

  try {
    const range = "Maxes!A:G";
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return {
      ok: true,
      output: {
        summary: `recorded ${exercise} PR (${estimated1RM} lb est 1RM) on ${date}`,
        updatedRange: response.data.updates?.updatedRange ?? null,
        sheetId,
        exercise,
        estimated1RM,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      output: null,
      error: `Maxes append failed (does the sheet have a "Maxes" tab?): ${err?.message ?? String(err)}`,
    };
  }
}

async function reviewRecent(data: Record<string, any>): Promise<ToolAdapterResult> {
  const { days = 1, minExercises = 3, minWorkingSets = 1 } = data;

  try {
    // Find all athletes with registered sheets
    const registrations = await prisma.memory.findMany({
      where: {
        category: "clients",
        metadata: {
          path: ["kind"],
          equals: "sheet_registration",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const seen = new Set<string>();
    const athletes: Array<{ name: string; sheetId: string }> = [];
    for (const m of registrations) {
      const meta = m.metadata as any;
      const name = (meta?.clientName ?? "").toString().trim();
      const sheetId = (meta?.sheetId ?? "").toString().trim();
      if (!name || !sheetId) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      athletes.push({ name, sheetId });
    }

    if (athletes.length === 0) {
      return {
        ok: true,
        output: {
          summary: "no registered athletes",
          sessionsToReview: [],
        },
      };
    }

    const sheets = await getSheetsClient();
    if (!sheets) {
      return {
        ok: false,
        output: null,
        error: "Google Sheets auth not configured.",
      };
    }

    // Compute the cutoff date (today minus `days`)
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    type SessionToReview = {
      client: string;
      sheetId: string;
      dayTab: string;
      date: string;
      exerciseCount: number;
      workingSetCount: number;
    };

    const sessionsToReview: SessionToReview[] = [];

    for (const athlete of athletes) {
      for (const tab of DEFAULT_DAY_TABS) {
        try {
          const range = `${tab}!A:I`;
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: athlete.sheetId,
            range,
          });
          const raw = response.data.values ?? [];
          const dataRows = raw.slice(1).filter((r) => r.length > 0 && r.some((c) => c !== ""));

          // Group by date within this tab
          const byDate = new Map<string, any[][]>();
          for (const row of dataRows) {
            const date = (row[0] ?? "").toString().trim();
            if (!date) continue;
            if (date < cutoffStr) continue; // older than cutoff → skip
            const list = byDate.get(date) ?? [];
            list.push(row);
            byDate.set(date, list);
          }

          for (const [date, rowsForDate] of byDate.entries()) {
            const exerciseCount = rowsForDate.length;
            // Sum sets across rows — best-effort. Treat any non-zero parse as a working set.
            let workingSetCount = 0;
            for (const r of rowsForDate) {
              const setsStr = (r[3] ?? "").toString();
              const numericMatch = setsStr.match(/(\d+)/g);
              if (numericMatch && numericMatch.length > 0) {
                // If the string contains "warmup", take the LAST number as working sets;
                // else take the largest number found.
                if (setsStr.toLowerCase().includes("warmup") || setsStr.toLowerCase().includes("w ")) {
                  workingSetCount += parseInt(numericMatch[numericMatch.length - 1]!, 10);
                } else {
                  workingSetCount += Math.max(...numericMatch.map((n) => parseInt(n, 10)));
                }
              }
            }

            if (exerciseCount >= minExercises && workingSetCount >= minWorkingSets) {
              sessionsToReview.push({
                client: athlete.name,
                sheetId: athlete.sheetId,
                dayTab: tab,
                date,
                exerciseCount,
                workingSetCount,
              });
            }
          }
        } catch {
          // Tab doesn't exist on this athlete's sheet — skip silently
        }
      }
    }

    // Sort newest first
    sessionsToReview.sort((a, b) => b.date.localeCompare(a.date));

    return {
      ok: true,
      output: {
        summary: `${sessionsToReview.length} session${sessionsToReview.length === 1 ? "" : "s"} eligible for review across ${athletes.length} athlete${athletes.length === 1 ? "" : "s"}`,
        sessionsToReview,
        athleteCount: athletes.length,
        cutoffDate: cutoffStr,
        threshold: { minExercises, minWorkingSets },
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      output: null,
      error: `review_recent failed: ${err?.message ?? String(err)}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// GENERIC SHEET ACCESS — any spreadsheet Cole names, not just athletes
// ═══════════════════════════════════════════════════════════════════

async function findSheet(data: any): Promise<ToolAdapterResult> {
  const name = (data?.name ?? "").toString().trim();
  if (!name) return { ok: false, output: null, error: "find_sheet needs a name" };
  const matches = await listDriveSheets(name);
  if (matches.length === 0) {
    const problem = driveSearchProblem();
    return {
      ok: false,
      output: null,
      error: problem ?? `no spreadsheet named anything like "${name}" — try a shorter fragment of the name (e.g. just "Devo")`,
    };
  }
  return {
    ok: true,
    output: {
      matches: matches.map((m) => ({ title: m.title, sheetId: m.sheetId })),
      summary: `${matches.length} match(es): ${matches.map((m) => m.title).join(" · ")}`,
    },
  };
}

async function listTabs(data: any): Promise<ToolAdapterResult> {
  const resolved = await resolveSheetRef((data?.sheet ?? "").toString());
  if (!resolved.ok) return { ok: false, output: { candidates: resolved.candidates }, error: resolved.error };
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, output: null, error: "Sheets client unavailable — authorize Google at /api/calendar/auth" };
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: resolved.sheetId,
      fields: "properties(title),sheets(properties(title,gridProperties(rowCount)))",
    });
    const tabs = (meta.data.sheets ?? []).map((s: any) => s?.properties?.title).filter(Boolean);
    return {
      ok: true,
      output: {
        sheet: meta.data.properties?.title ?? resolved.title,
        tabs,
        summary: `"${meta.data.properties?.title ?? resolved.title}" has ${tabs.length} tabs: ${tabs.join(" · ")}`,
      },
    };
  } catch (err: any) {
    return { ok: false, output: null, error: `list_tabs failed: ${err?.message ?? String(err)}` };
  }
}

const MAX_TABS_PER_READ = 8;
const MAX_CHARS_PER_TAB = 6000;

async function readTabs(data: any): Promise<ToolAdapterResult> {
  const resolved = await resolveSheetRef((data?.sheet ?? "").toString());
  if (!resolved.ok) return { ok: false, output: { candidates: resolved.candidates }, error: resolved.error };
  const rawTabs: string[] = Array.isArray(data?.tabs) ? data.tabs.map((t: any) => String(t).trim()).filter(Boolean) : [];
  if (rawTabs.length === 0) return { ok: false, output: null, error: "read_tabs needs tabs: [\"exact tab name\", ...] — use list_tabs to see them" };
  const tabs = rawTabs.slice(0, MAX_TABS_PER_READ);

  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, output: null, error: "Sheets client unavailable — authorize Google at /api/calendar/auth" };
  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: resolved.sheetId,
      ranges: tabs.map((t) => `'${t.replace(/'/g, "''")}'`),
      valueRenderOption: "FORMATTED_VALUE",
    });
    const { defuseDirectives } = await import("../../llm/directiveParser.ts");
    const read = (res.data.valueRanges ?? []).map((vr: any, i: number) => {
      const rows: any[][] = vr?.values ?? [];
      const text = rows
        .map((r) => r.map((c) => String(c ?? "").trim()).join(" | "))
        .filter((line) => line.replace(/[|\s]/g, "").length > 0)
        .join("\n");
      return { tab: tabs[i], rows: rows.length, text: defuseDirectives(text.slice(0, MAX_CHARS_PER_TAB)) };
    });

    // Persist only on Cole's say-so — reading is a glance, ingesting is memory.
    let ingested = 0;
    if (data?.ingest === true) {
      const { ingestDocument } = await import("../../corpus/ingest.ts");
      const crypto = await import("node:crypto");
      for (const r of read) {
        if (r.text.length < 100) continue;
        const hash = crypto.createHash("sha256").update(r.text).digest("hex").slice(0, 12);
        await ingestDocument({
          title: `${resolved.title} · ${r.tab}`,
          content: r.text,
          sourceType: "upload",
          domain: "training",
          triggeredBy: "cole",
          dedupKey: `sheet:${resolved.sheetId}:${r.tab}#${hash}`,
        });
        ingested++;
      }
    }

    const truncated = rawTabs.length > tabs.length ? ` (capped at ${MAX_TABS_PER_READ} tabs — ask again for the rest)` : "";
    return {
      ok: true,
      output: {
        sheet: resolved.title,
        tabsRead: read.map((r) => ({ tab: r.tab, rows: r.rows })),
        content: read.map((r) => `═══ ${r.tab} ═══\n${r.text || "(empty tab)"}`).join("\n\n"),
        ingested: data?.ingest === true ? ingested : undefined,
        summary: `Read ${read.length} tab(s) from "${resolved.title}"${ingested ? `, ingested ${ingested} into the corpus` : ""}${truncated}`,
      },
    };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    return {
      ok: false,
      output: null,
      error: /Unable to parse range/i.test(msg)
        ? `a tab name didn't match exactly — run list_tabs on "${resolved.title}" and use the exact names`
        : `read_tabs failed: ${msg}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ADAPTER EXPORT
// ═══════════════════════════════════════════════════════════════════

export const googleSheetsAdapter: ToolAdapter = {
  name: "google_sheets",
  description: "Google Sheets — TWO modes. (1) ANY spreadsheet Cole names: find_sheet / list_tabs / read_tabs work on every sheet in his Drive (personal programs, planning docs, anything) — when Cole says 'go into <some sheet>', use find_sheet → list_tabs → read_tabs; never claim a sheet doesn't fit a structure without searching first. (2) Athlete training sheets (Dashboard/Day/Maxes/Feedback structure): reference athletes by name (e.g. \"Mike\") for logging, session reads, block analysis, feedback writing, PR tracking, batch review.",
  actions: ACTIONS,

  async run(action, data, _context) {
    switch (action) {
      case "find_sheet":
        return findSheet(data);
      case "list_tabs":
        return listTabs(data);
      case "read_tabs":
        return readTabs(data);
      case "log_session":
        return logSession(data);
      case "read_sessions":
        return readSessions(data);
      case "read_dashboard":
        return readDashboard(data);
      case "list_athletes":
        return listAthletes(data);
      case "read_block":
        return readBlock(data);
      case "write_feedback":
        return writeFeedback(data);
      case "update_max":
        return updateMax(data);
      case "review_recent":
        return reviewRecent(data);
      case "sync_roster":
        return syncRoster(data);
      default:
        return {
          ok: false,
          output: null,
          error: `Unknown action: ${action}`,
        };
    }
  },
};