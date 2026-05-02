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
// Auth wiring: this file expects a configured Sheets client provided by
// googleAuth.ts. The client uses a service account; sheets must be shared
// with the service account email.
//
// IMPORTANT: action data uses `client` (the athlete's name) — Aurelius
// must NEVER pass a `sheetId` directly. The chat endpoint resolves
// `client` → real sheetId via memory before this adapter runs.
//
// Architectural note: list_athletes queries Aurelius's own memory rather
// than the Sheets API. It lives on this adapter for Phase 3 pragmatism.
// In a future phase (probably 6 or 9) it may move to a dedicated
// "aurelius_memory" tool adapter when more memory-query actions exist.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { getSheetsClient } from "./googleAuth.ts";
import { prisma } from "../../core/db/prisma.ts";

// ═══════════════════════════════════════════════════════════════════
// ACTION DEFINITIONS (for the tool catalog injected into LLM prompt)
// ═══════════════════════════════════════════════════════════════════

const ACTIONS = [
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
  // Real sheet IDs are typically 40-50 chars and use the URL-safe Base64 alphabet
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// ═══════════════════════════════════════════════════════════════════
// ACTION IMPLEMENTATIONS
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

  // Build rows to append. Each exercise becomes one row.
  // Column order matches the template: Date | # | Exercise | Sets | Reps | Load | Tempo | RPE | Notes
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

  // Add a session-divider row above (blank row) so sessions are visually separated.
  // Sheets API appends to the next empty row, which is what we want for chronological logging.
  try {
    const range = `${dayTab}!A:I`;
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [], // blank divider row
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

    // Filter out empty rows + header row (row 1)
    const dataRows = allRows.slice(1).filter((r) => r.length > 0 && r.some((cell) => cell !== ""));

    // Take the most recent `limit` rows (end of the list)
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
    // Pull all data from the Dashboard tab — it's small enough that one read is fine.
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
    // Query memory for all sheet_registration entries.
    // Most recent registration per client wins (in case Cole re-registered).
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

    // De-dupe by clientName (keep most recent registration only)
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

    // Sort alphabetically by name for consistent display
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
// ADAPTER EXPORT
// ═══════════════════════════════════════════════════════════════════

export const googleSheetsAdapter: ToolAdapter = {
  name: "google_sheets",
  description: "Read and write to athlete training sheets in Google Sheets. Each athlete has their own sheet with Dashboard, Day program, Maxes, and Aurelius Feedback tabs. Always reference athletes by name (e.g. \"Mike\") — sheet IDs are resolved automatically from memory. Also supports list_athletes which queries Aurelius's memory to enumerate all registered athletes.",
  actions: ACTIONS,

  async run(action, data, _context) {
    switch (action) {
      case "log_session":
        return logSession(data);
      case "read_sessions":
        return readSessions(data);
      case "read_dashboard":
        return readDashboard(data);
      case "list_athletes":
        return listAthletes(data);
      default:
        return {
          ok: false,
          output: null,
          error: `Unknown action: ${action}`,
        };
    }
  },
};