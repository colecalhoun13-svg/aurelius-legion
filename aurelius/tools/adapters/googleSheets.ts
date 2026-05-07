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
// ADAPTER EXPORT
// ═══════════════════════════════════════════════════════════════════

export const googleSheetsAdapter: ToolAdapter = {
  name: "google_sheets",
  description: "Read and write to athlete training sheets in Google Sheets. Each athlete has their own sheet with Dashboard, Day program, Maxes, and Aurelius Feedback tabs. Always reference athletes by name (e.g. \"Mike\") — sheet IDs are resolved automatically from memory. Supports logging, reading, athlete lookup, block-level analysis, feedback writing, PR tracking, and batch session review.",
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
      case "read_block":
        return readBlock(data);
      case "write_feedback":
        return writeFeedback(data);
      case "update_max":
        return updateMax(data);
      case "review_recent":
        return reviewRecent(data);
      default:
        return {
          ok: false,
          output: null,
          error: `Unknown action: ${action}`,
        };
    }
  },
};