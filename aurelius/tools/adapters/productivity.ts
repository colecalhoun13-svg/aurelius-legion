// aurelius/tools/adapters/productivity.ts
//
// Cole's lane as a REGISTERED TOOL — so "add a goal", "task due Friday", "what's
// on today", "focus is the launch" work in the normal chat, not only the
// dashboard. Pure delegation to productivity/service.ts. Everything here is
// INWARD and reversible (create/edit tasks, goals, the daily focus); nothing
// sends, publishes, or spends. Aurelius-created tasks still land in the inbox as
// Cole's own (origin "cole") since he asked for them explicitly in conversation.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
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
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    switch (action) {
      case "get_today": {
        const t = await getToday();
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
        // No due/scheduled given → put it on today's deck rather than the inbox,
        // since Cole asked for it in the moment.
        const hasWhen = !!(data.due || data.scheduledFor);
        const task = await createTask({
          title: String(data.title),
          description: data.description ? String(data.description) : undefined,
          priority,
          domain: data.domain ? String(data.domain) : undefined,
          dueDate: data.due ? String(data.due) : undefined,
          scheduledFor: data.scheduledFor ? String(data.scheduledFor) : undefined,
          status: hasWhen ? "next" : "today",
          origin: "cole",
        });
        return { ok: true, output: { summary: `Added "${task.title}"${task.dueDate ? ` (due ${new Date(task.dueDate).toISOString().slice(0, 10)})` : ""}.`, id: task.id } };
      }

      case "complete_task": {
        let id = data?.id ? String(data.id) : "";
        if (!id && data?.title) {
          const q = String(data.title).toLowerCase().trim();
          // Only OPEN tasks are completable — never resolve to a done/abandoned
          // one (which would report a false "Done"). Prefer an exact title; fall
          // back to substring ONLY if it's unambiguous, else list candidates so
          // we never silently complete the wrong task ("call" ⊂ "recall order").
          const open = (await listTasks({ limit: 200 })).filter(
            (t) => t.status !== "done" && t.status !== "abandoned"
          );
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
        await upsertTodayPlan({ focus: String(data.focus), generatedBy: "cole_manual" });
        return { ok: true, output: { summary: `Today's focus set: "${String(data.focus)}".` } };
      }

      default:
        return { ok: false, output: null, error: `unknown productivity action: ${action}` };
    }
  },
};
