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
} from "../../planning/tools.ts";

export const planningAdapter: ToolAdapter = {
  name: "planning",
  description:
    "Planning & scheduling (calendar-less v1): analyze the week, detect overload, decompose goals into proposed tasks, run the weekly planning session.",
  actions: [
    {
      name: "analyze_week",
      description: "Operator Score with component breakdown, insights, done/created counts, active goals.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "detect_overload",
      description: "Due-task load vs daily capacity for the next 7 days, plus overdue backlog.",
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
