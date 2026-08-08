// aurelius/tools/adapters/productivity.ts
//
// Cole's lane as a REGISTERED TOOL — so "add a goal", "task due Friday", "what's
// on today", "focus is the launch" work in the normal chat, not only the
// dashboard. Pure delegation to productivity/service.ts. Everything here is
// INWARD and reversible (create/edit tasks, goals, the daily focus); nothing
// sends, publishes, or spends. Aurelius-created tasks still land in the inbox as
// Cole's own (origin "cole") since he asked for them explicitly in conversation.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { prisma } from "../../core/db/prisma.ts";
import { operatorToday } from "../../core/time.ts";
import {
  createTask,
  completeTask,
  listTasks,
  createGoal,
  listGoals,
  getToday,
  upsertTodayPlan,
} from "../../productivity/service.ts";

const PRIORITIES = new Set(["critical", "high", "normal", "low"]);

export const productivityAdapter: ToolAdapter = {
  name: "productivity",
  // NON-IDEMPOTENT — never auto-retry. The engine's default retry re-runs the
  // call on failure, and its timeout does NOT cancel the in-flight promise: a
  // slow write that trips the ceiling would land AND be retried, duplicating
  // tasks and goals. Fail once, honestly, and let Cole decide.
  maxRetries: 0,
  description:
    "Cole's tasks, goals, and daily focus. Add or complete tasks, add goals, list what's open, see today's snapshot, or set today's focus — all from chat. Everything is reversible; nothing is sent or published.",
  actions: [
    {
      name: "get_today",
      description:
        "Today's snapshot: focus, tasks on deck, done, overdue, inbox count, habits, calendar. Use for 'what's on today' / 'where am I'.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "add_task",
      description:
        "Create a task. Use for 'add a task', 'remind me to X', 'X due Friday'. Lands on today's deck when no due date is given.",
      dataSchema:
        '{ title: string, priority?: "critical"|"high"|"normal"|"low", due?: string (ISO date/datetime), scheduledFor?: string (ISO), domain?: string, description?: string }',
      example: '[TOOL: productivity.add_task {"title": "Send the athlete intake form", "priority": "high", "due": "2026-07-18"}]',
    },
    {
      name: "complete_task",
      description: "Mark a task done. Provide the task id (from get_today / list_tasks) or its exact title.",
      dataSchema: '{ id?: string, title?: string }',
      example: '[TOOL: productivity.complete_task {"title": "Send the athlete intake form"}]',
    },
    {
      name: "list_tasks",
      description: "List tasks, optionally filtered by status (inbox/today/next/done) or domain.",
      dataSchema: '{ status?: string, domain?: string, limit?: number }',
    },
    {
      name: "add_goal",
      description:
        "Create a goal. Use for 'add a goal', 'new quarter goal'. horizon is life/year/quarter/week; target is a count if it's a counted goal.",
      dataSchema:
        '{ name: string, horizon?: "life"|"year"|"quarter"|"week", target?: number, unit?: string, targetDate?: string (ISO), domain?: string }',
      example: '[TOOL: productivity.add_goal {"name": "Sign 10 athletes", "horizon": "quarter", "target": 10, "unit": "athletes"}]',
    },
    {
      name: "list_goals",
      description: "List active goals with progress.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "set_focus",
      description: "Set today's single focus. Use for 'today's focus is X' / 'make the launch my focus'.",
      dataSchema: '{ focus: string }',
      example: '[TOOL: productivity.set_focus {"focus": "Ship the athlete program page"}]',
    },
    {
      name: "promise",
      description:
        "File a promise on the ledger. Use when Cole commits to someone ('I told Mara I'd send the quote Friday' → owed_by_cole) or someone commits to him ('Jake said he'll send his log' → waiting_on). Give counterpart+text directly when you can; raw text alone is extracted (honestly — nothing filed if no commitment is found).",
      dataSchema:
        '{ text: string, counterpart?: string, direction?: "owed_by_cole"|"waiting_on", due?: string (ISO date) }',
      example: '[TOOL: productivity.promise {"counterpart": "Mara", "text": "send the quote", "direction": "owed_by_cole", "due": "2026-08-14"}]',
    },
    {
      name: "promises",
      description:
        "The promise ledger: list what's open/lapsed, or resolve one. To resolve, pass resolve (id or a text/counterpart fragment) + status kept|dropped.",
      dataSchema: '{ resolve?: string, status?: "kept"|"dropped" }',
      example: '[TOOL: productivity.promises {"resolve": "quote", "status": "kept"}]',
    },
    {
      name: "quiet",
      description:
        "Quiet mode — Cole is away/sick. Pauses the pushy rituals (briefing, midday, debrief, outreach sweep), shifts lead follow-ups past the window, auto-restores when it ends. Use for '/quiet 3d sick', 'go quiet until Monday', 'end quiet'.",
      dataSchema: '{ for?: string ("3d"|"12h"|days number), until?: string (ISO), reason?: string, end?: boolean }',
      example: '[TOOL: productivity.quiet {"for": "3d", "reason": "sick"}]',
    },
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    switch (action) {
      case "get_today": {
        const t = await getToday(operatorToday()); // Cole's local day, not UTC
        return {
          ok: true,
          output: {
            summary: `${t.tasks.length} on deck · ${t.doneToday} done · ${t.overdue.length} overdue · ${t.inboxCount} in inbox${t.plan?.focus ? ` · focus: ${t.plan.focus}` : ""}`,
            focus: t.plan?.focus ?? null,
            tasks: t.tasks.map((x: any) => ({ id: x.id, title: x.title, priority: x.priority, status: x.status })),
            overdue: t.overdue.map((x: any) => ({ id: x.id, title: x.title })),
            doneToday: t.doneToday,
            inboxCount: t.inboxCount,
            habits: t.habits.map((h: any) => ({ name: h.name, doneToday: h.doneToday })),
            calendarEvents: t.calendarEvents.map((e: any) => ({ title: e.title, startAt: e.startAt })),
          },
        };
      }

      case "add_task": {
        if (!data?.title) return { ok: false, output: null, error: "title required" };
        const priority = data.priority && PRIORITIES.has(String(data.priority)) ? String(data.priority) : undefined;
        // Validate dates HERE, not in Prisma: the tool description invites "due
        // Friday", but new Date("Friday") is Invalid Date (Prisma throws a cryptic
        // error), and "07/18" silently parses to the year 2001. Require a real
        // ISO-ish date and fail with a helpful message (hard rule 3).
        const checkDate = (label: string, v: any): { iso?: string; error?: string } => {
          if (v === undefined || v === null || v === "") return {};
          const d = new Date(String(v));
          if (Number.isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getFullYear() > 2100) {
            return { error: `couldn't read "${v}" as a ${label} — use YYYY-MM-DD (e.g. 2026-07-18).` };
          }
          return { iso: d.toISOString() };
        };
        const dueChk = checkDate("due date", data.due);
        if (dueChk.error) return { ok: false, output: null, error: dueChk.error };
        const schedChk = checkDate("scheduled time", data.scheduledFor);
        if (schedChk.error) return { ok: false, output: null, error: schedChk.error };

        // On today's deck if it has no date, OR is due/scheduled today; else "next".
        const todayStr = operatorToday();
        const isToday =
          (dueChk.iso && dueChk.iso.slice(0, 10) === todayStr) ||
          (schedChk.iso && schedChk.iso.slice(0, 10) === todayStr);
        const hasFutureWhen = !!((dueChk.iso || schedChk.iso) && !isToday);

        const task = await createTask({
          title: String(data.title),
          description: data.description ? String(data.description) : undefined,
          priority,
          domain: data.domain ? String(data.domain) : undefined,
          dueDate: dueChk.iso,
          scheduledFor: schedChk.iso,
          status: hasFutureWhen ? "next" : "today",
          origin: "cole",
        });
        return { ok: true, output: { summary: `Added "${task.title}"${task.dueDate ? ` (due ${new Date(task.dueDate).toISOString().slice(0, 10)})` : ""}.`, id: task.id } };
      }

      case "complete_task": {
        let id = data?.id ? String(data.id) : "";
        if (!id && data?.title) {
          const q = String(data.title).toLowerCase().trim();
          // Only OPEN tasks are completable — never resolve to a done/abandoned
          // one (would report a false "Done"). Filter in the QUERY, not after a
          // limit: client-side filtering of listTasks({limit:200}) could drop open
          // tasks behind 200 done rows. Prefer an exact title; fall back to
          // substring only if unambiguous, else list candidates (never guess).
          const open = await prisma.task.findMany({
            where: { status: { notIn: ["done", "abandoned"] } },
            orderBy: { createdAt: "desc" },
            take: 500,
          });
          const exact = open.filter((t) => t.title.toLowerCase() === q);
          const subs = open.filter((t) => t.title.toLowerCase().includes(q));
          const pool = exact.length ? exact : subs;
          if (pool.length === 0) return { ok: false, output: null, error: `no open task matching "${data.title}"` };
          if (pool.length > 1) {
            return {
              ok: false,
              output: null,
              error: `"${data.title}" matches ${pool.length} open tasks: ${pool.slice(0, 5).map((t) => `"${t.title}"`).join(", ")}. Be more specific or pass the id.`,
            };
          }
          id = pool[0].id;
        }
        if (!id) return { ok: false, output: null, error: "id or title required" };
        const done = await completeTask(id);
        return { ok: true, output: { summary: `Done: "${done.title}".`, id: done.id } };
      }

      case "list_tasks": {
        const rows = await listTasks({
          status: data?.status ? String(data.status) : undefined,
          domain: data?.domain ? String(data.domain) : undefined,
          limit: data?.limit ? Number(data.limit) : undefined,
        });
        return {
          ok: true,
          output: {
            summary: `${rows.length} task(s)`,
            tasks: rows.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate })),
          },
        };
      }

      case "add_goal": {
        if (!data?.name) return { ok: false, output: null, error: "name required" };
        const goal = await createGoal({
          name: String(data.name),
          horizon: data.horizon ? String(data.horizon) : undefined,
          target: data.target != null ? Number(data.target) : undefined,
          unit: data.unit ? String(data.unit) : undefined,
          targetDate: data.targetDate ? String(data.targetDate) : undefined,
          domain: data.domain ? String(data.domain) : undefined,
        });
        return { ok: true, output: { summary: `Added goal "${goal.name}" (${goal.horizon}).`, id: goal.id } };
      }

      case "list_goals": {
        const goals = await listGoals();
        return {
          ok: true,
          output: {
            summary: goals.length ? goals.map((g: any) => `${g.name} (${g.progressPct}%)`).join(" · ") : "no active goals",
            goals: goals.map((g: any) => ({ id: g.id, name: g.name, horizon: g.horizon, progressPct: g.progressPct })),
          },
        };
      }

      case "set_focus": {
        if (!data?.focus) return { ok: false, output: null, error: "focus required" };
        await upsertTodayPlan({ date: operatorToday(), focus: String(data.focus), generatedBy: "cole_manual" });
        return { ok: true, output: { summary: `Today's focus set: "${String(data.focus)}".` } };
      }

      case "promise": {
        const { addPromise, extractPromisesFromText } = await import("../../productivity/promises.ts");
        const text = data?.text ? String(data.text).trim() : "";
        const counterpart = data?.counterpart ? String(data.counterpart).trim() : "";
        if (!text && !counterpart) return { ok: false, output: null, error: "text (and ideally counterpart) required" };

        if (counterpart && text) {
          // Structured — file directly.
          const dueChk = (() => {
            if (!data?.due) return { iso: undefined as string | undefined };
            const d = new Date(String(data.due));
            if (Number.isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getFullYear() > 2100) {
              return { error: `couldn't read "${data.due}" as a due date — use YYYY-MM-DD.` };
            }
            return { iso: d.toISOString() };
          })();
          if (dueChk.error) return { ok: false, output: null, error: dueChk.error };
          const p = await addPromise({
            direction: data?.direction === "waiting_on" ? "waiting_on" : "owed_by_cole",
            counterpart,
            text,
            dueAt: dueChk.iso,
            sourceType: "chat",
          });
          const who = p.direction === "owed_by_cole" ? `you → ${p.counterpart}` : `waiting on ${p.counterpart}`;
          return { ok: true, output: { summary: `On the ledger: ${who} — "${p.text}"${p.dueAt ? ` (due ${p.dueAt.toISOString().slice(0, 10)})` : ""}.`, id: p.id } };
        }

        // Raw text only — extract honestly (no engine / no commitment → nothing filed).
        const extracted = await extractPromisesFromText(text, "chat");
        if (extracted.length === 0) {
          return {
            ok: false,
            output: null,
            error:
              "couldn't extract a commitment from that (no engine configured, or nothing commitment-shaped was said) — give me counterpart + text directly and I'll file it.",
          };
        }
        const filed: string[] = [];
        for (const e of extracted) {
          const p = await addPromise({ ...e, dueAt: e.due ?? undefined, sourceType: "chat" });
          filed.push(`${p.direction === "owed_by_cole" ? `you → ${p.counterpart}` : `waiting on ${p.counterpart}`}: "${p.text}"`);
        }
        return { ok: true, output: { summary: `On the ledger: ${filed.join(" · ")}.`, count: filed.length } };
      }

      case "promises": {
        const { listOpenPromises, resolvePromise } = await import("../../productivity/promises.ts");
        const open = await listOpenPromises();

        if (data?.resolve) {
          const status = data?.status === "dropped" ? "dropped" : data?.status === "kept" ? "kept" : null;
          if (!status) return { ok: false, output: null, error: 'status must be "kept" or "dropped"' };
          const q = String(data.resolve).toLowerCase().trim();
          // Exact id first; else a unique text/counterpart substring among open —
          // never guess between two matches (same discipline as complete_task).
          const byId = open.find((p) => p.id === data.resolve);
          const pool = byId
            ? [byId]
            : open.filter((p) => p.text.toLowerCase().includes(q) || p.counterpart.toLowerCase().includes(q));
          if (pool.length === 0) return { ok: false, output: null, error: `no open promise matching "${data.resolve}"` };
          if (pool.length > 1) {
            return {
              ok: false,
              output: null,
              error: `"${data.resolve}" matches ${pool.length} open promises: ${pool.slice(0, 4).map((p) => `"${p.text}" (${p.counterpart})`).join(", ")}. Be more specific or pass the id.`,
            };
          }
          const done = await resolvePromise(pool[0].id, status);
          if (!done) return { ok: false, output: null, error: "that promise was already resolved" };
          return { ok: true, output: { summary: `${status === "kept" ? "Kept" : "Dropped"}: "${done.text}" (${done.counterpart}).`, id: done.id } };
        }

        if (open.length === 0) return { ok: true, output: { summary: "The promise ledger is clear — nothing owed, nothing waited on.", promises: [] } };
        return {
          ok: true,
          output: {
            summary: `${open.length} on the ledger`,
            promises: open.map((p) => ({
              id: p.id,
              direction: p.direction,
              counterpart: p.counterpart,
              text: p.text,
              dueAt: p.dueAt,
              status: p.status,
            })),
          },
        };
      }

      case "quiet": {
        const { quietUntil, endQuietNow, ensureQuietState, parseQuietWindow } = await import("../../planning/quiet.ts");
        if (data?.end === true || data?.end === "true") {
          const state = await endQuietNow();
          return {
            ok: true,
            output: { summary: state.restored ? `Back. ${state.summary ?? ""}`.trim() : "Quiet wasn't on — nothing to end." },
          };
        }
        let untilISO: string | null = null;
        if (data?.until) {
          const d = new Date(String(data.until));
          if (!Number.isNaN(d.getTime())) untilISO = d.toISOString();
        } else {
          const ms = parseQuietWindow(data?.for ?? data?.days);
          if (ms) untilISO = new Date(Date.now() + ms).toISOString();
        }
        if (!untilISO) {
          const state = await ensureQuietState();
          return state.active
            ? { ok: true, output: { summary: `Quiet is on until ${state.until?.slice(0, 10)}${state.reason ? ` (${state.reason})` : ""}.` } }
            : { ok: false, output: null, error: 'how long? pass for ("3d", "12h") or until (ISO date) — e.g. {"for":"3d","reason":"sick"}' };
        }
        const r = await quietUntil(untilISO, data?.reason ? String(data.reason) : "away");
        if (!r.ok) return { ok: false, output: null, error: r.error };
        return {
          ok: true,
          output: {
            summary:
              `Quiet until ${r.until!.slice(0, 10)}. Briefing, midday check, debrief and outreach sweep are holding; ` +
              `${r.leadsShifted} lead follow-up${r.leadsShifted === 1 ? "" : "s"} shifted past the window. Everything resumes itself.`,
          },
        };
      }

      default:
        return { ok: false, output: null, error: `unknown productivity action: ${action}` };
    }
  },
};
