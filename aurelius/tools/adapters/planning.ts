// aurelius/tools/adapters/planning.ts
//
// The planning cluster as a REGISTERED TOOL — Aurelius can call these
// itself via [TOOL: ...] directives in conversation ("plan my week",
// "break that goal down", "am I overloaded?"), and they appear in the
// Layer 6 tool catalog. Pure delegation to planning/tools.ts.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import {
  analyzeWeek,
  detectOverload,
  breakGoalIntoSteps,
  planWeekLite,
  planDay,
} from "../../planning/tools.ts";
import { setSchedule, listSchedules } from "../../core/schedule.ts";

export const planningAdapter: ToolAdapter = {
  name: "planning",
  description:
    "Planning & scheduling: plan the day, analyze the week, detect overload (calendar-aware when synced), decompose goals into proposed tasks, run the weekly planning session, and change the times of Aurelius's daily/weekly rituals (morning briefing, midday check, nightly debrief, etc.).",
  actions: [
    {
      name: "plan_day",
      description:
        "Plan TODAY: the one priority, attack order for open items, risk (overload/overdue/calendar), and pace. Files today's plan. Use for 'plan my day' / 'what should I do today'.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "list_schedule",
      description:
        "List the current times of all Aurelius rituals (morning briefing, midday check, nightly debrief, weekly sweeps). Use for 'what's my schedule' / 'when's my briefing'.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "set_schedule",
      description:
        "Change the time of a ritual. Takes effect immediately and persists. Use for 'move my morning brief to 6:30' / 'change the debrief to 10pm'.",
      dataSchema:
        '{ ritual: string (e.g. "morning briefing", "midday check", "nightly debrief"), time: string (e.g. "6:30", "7am", "22:00") }',
      example: '[TOOL: planning.set_schedule {"ritual": "morning briefing", "time": "6:30"}]',
    },
    {
      name: "analyze_week",
      description: "Operator Score with component breakdown, insights, done/created counts, active goals.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "detect_overload",
      description:
        "Due-task load vs daily capacity for the next 7 days, plus overdue backlog. Capacity shrinks on calendar-busy days when the sync is live.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "break_goal_into_steps",
      description:
        "Decompose a goal into 3-7 atomic steps as PROPOSED tasks in the inbox (Cole triages; nothing self-schedules).",
      dataSchema: '{ goal: string (goal name or id, e.g. "launch the athlete program") }',
      example: '[TOOL: planning.break_goal_into_steps {"goal": "launch the athlete program"}]',
    },
    {
      name: "plan_week",
      description:
        "Run the weekly planning session: goal review, workload, overload, briefing. Files a ritual instance and surfaces the plan on the Bridge.",
      dataSchema: "{} (no fields)",
    },
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    switch (action) {
      case "plan_day": {
        const r = await planDay();
        return {
          ok: true,
          output: {
            summary: `today's plan: ${r.openCount} open, ${r.overdueCount} overdue${r.overloaded ? ", OVERLOADED" : ""}`,
            plan: r.plan,
            ...r,
          },
        };
      }
      case "list_schedule": {
        const rows = listSchedules();
        return {
          ok: true,
          output: {
            summary: rows.map((r) => `${r.label} ${r.time}${r.cadence === "Sundays" ? " (Sun)" : ""}`).join(" · "),
            rituals: rows,
          },
        };
      }
      case "set_schedule": {
        if (!data?.ritual || !data?.time) {
          return { ok: false, output: null, error: 'ritual and time required, e.g. {"ritual":"morning briefing","time":"6:30"}' };
        }
        const r = await setSchedule(String(data.ritual), String(data.time));
        if (!r.ok) return { ok: false, output: null, error: r.error };
        return { ok: true, output: { summary: `${r.label} → ${r.time} (${r.cadence})`, ...r } };
      }
      case "analyze_week": {
        const r = await analyzeWeek();
        return { ok: true, output: { summary: `score ${r.score}/100, ${r.tasksDone} done last week`, ...r } };
      }
      case "detect_overload": {
        const r = await detectOverload();
        return {
          ok: true,
          output: {
            summary: r.overloadedDays.length
              ? `${r.overloadedDays.length} overloaded day(s) ahead, ${r.backlog} overdue`
              : `no overload ahead, ${r.backlog} overdue`,
            ...r,
          },
        };
      }
      case "break_goal_into_steps": {
        if (!data?.goal) return { ok: false, output: null, error: "goal (name or id) required" };
        const r = await breakGoalIntoSteps(String(data.goal));
        if (!r.ok) return { ok: false, output: null, error: r.error };
        return { ok: true, output: { summary: `${r.proposed.length} steps proposed for "${r.goal}"`, ...r } };
      }
      case "plan_week": {
        const r = await planWeekLite();
        return { ok: true, output: { summary: "weekly planning session filed", briefing: r.briefing } };
      }
      default:
        return { ok: false, output: null, error: `unknown planning action: ${action}` };
    }
  },
};
