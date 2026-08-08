// aurelius/training/sessionFeedback.ts
//
// SESSION FEEDBACK FROM THE TAB. The chat flow already does read → reason →
// write-feedback (index.ts pass-2); this is the same engine made reachable
// from the Athletes page: one button on an athlete → find their sheet's most
// recent session → reason over it → return the feedback AND write it to the
// sheet's Feedback tab (same artifact the chat flow produces). Dormant-honest
// at every step: no sheet, no Google, no engine → a named reason, never a
// fabricated review. Training domain, both athlete kinds. Never writes
// programs — feedback is observation, the coaching call is Cole's.

import { prisma } from "../core/db/prisma.ts";
import { executeToolCall } from "../tools/toolEngine.ts";
import { reasonOverRecent } from "./reasoner.ts";

const NON_SESSION_TAB = /feedback|maxes|dashboard|overview|notes|template/i;

export type SessionFeedbackOut = {
  ok: boolean;
  error?: string;
  feedback?: { header: string; date: string; session: string; volume: string; prs?: string; observation: string };
  wroteToSheet: boolean;
  dayTab?: string;
};

export async function sessionFeedbackForAthlete(clientId: string): Promise<SessionFeedbackOut> {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, sheetUrl: true } });
  if (!client) return { ok: false, error: "No such athlete.", wroteToSheet: false };

  // Their sheet: stored link wins, Drive search fills in when Google is live.
  let sheetUrl = client.sheetUrl;
  if (!sheetUrl) {
    const { resolveAthleteSheet } = await import("../crm/performance.ts");
    const r = await resolveAthleteSheet(clientId);
    if (!r.url) return { ok: false, error: r.reason ?? "No sheet linked for this athlete.", wroteToSheet: false };
    sheetUrl = r.url;
  }
  const sheetId = sheetUrl.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!sheetId) return { ok: false, error: "The stored sheet link doesn't look like a Google Sheets URL — re-link it.", wroteToSheet: false };

  // Find the day tab with the most recent session. list_tabs → filter the
  // bookkeeping tabs → probe each candidate's latest date.
  const tabsRes = await executeToolCall({
    tool: "google_sheets",
    action: "list_tabs",
    data: { sheet: sheetId },
    operator: "training",
    context: { clientId: client.name },
  });
  if (!tabsRes.ok) return { ok: false, error: tabsRes.error ?? "Couldn't list the sheet's tabs (is Google authorized?).", wroteToSheet: false };
  const candidates: string[] = ((tabsRes.output?.tabs as string[]) ?? []).filter((t) => !NON_SESSION_TAB.test(t)).slice(0, 8);
  if (candidates.length === 0) return { ok: false, error: "No session tabs found in the sheet (everything looked like bookkeeping tabs).", wroteToSheet: false };

  let bestTab: string | null = null;
  let bestDate = "";
  for (const tab of candidates) {
    const read = await executeToolCall({
      tool: "google_sheets",
      action: "read_sessions",
      data: { sheetId, dayTab: tab, limit: 10 },
      operator: "training",
      context: { clientId: client.name },
    });
    if (!read.ok) continue;
    const dates = ((read.output?.rows as Array<{ date?: string }>) ?? []).map((r) => r.date).filter(Boolean) as string[];
    const latest = dates.sort().slice(-1)[0];
    if (latest && latest > bestDate) {
      bestDate = latest;
      bestTab = tab;
    }
  }
  if (!bestTab) return { ok: false, error: "No dated sessions found in any tab — is the sheet filled in?", wroteToSheet: false };

  const reasoning = await reasonOverRecent({ client: client.name, sheetId, dayTab: bestTab });
  if (!reasoning.ok || !reasoning.feedback) {
    return { ok: false, error: reasoning.error ?? "Reasoning produced no feedback (engine may be unconfigured).", wroteToSheet: false, dayTab: bestTab };
  }

  // Same artifact the chat pass-2 writes — the sheet's Feedback tab. Best-
  // effort: the review still returns to the page if the write fails.
  const f = reasoning.feedback;
  let wroteToSheet = false;
  try {
    const w = await executeToolCall({
      tool: "google_sheets",
      action: "write_feedback",
      data: { sheetId, client: client.name, date: f.date, header: f.header, session: f.session, volume: f.volume, prs: f.prs, observation: f.observation },
      operator: "training",
      context: { clientId: client.name },
    });
    wroteToSheet = !!w.ok;
  } catch {
    /* feedback still returns to the page */
  }

  return {
    ok: true,
    feedback: { header: f.header, date: f.date, session: f.session, volume: f.volume, prs: f.prs, observation: f.observation },
    wroteToSheet,
    dayTab: bestTab,
  };
}
