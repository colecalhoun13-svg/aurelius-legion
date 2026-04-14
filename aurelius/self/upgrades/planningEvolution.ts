// aurelius/self/upgrades/planningEvolution.ts
/**
 * Planning Evolution — Aurelius OS v3.4
 * Adjusts planning logic based on constraint violations + task patterns.
 */

export function evolvePlanning(memory: any): string {
  const tasks = memory.history?.tasks || [];
  const constraints = memory.constraints || {};

  const upgrades: string[] = [];

  const overloaded = tasks.filter((t: string) =>
    t.toLowerCase().includes("overloaded")
  ).length;

  if (overloaded > 3) {
    upgrades.push("Planning engine: Increase buffer time between tasks.");
  }

  const timeViolations = constraints.time?.filter((c: string) =>
    c.toLowerCase().includes("too busy")
  ).length;

  if (timeViolations > 2) {
    upgrades.push("Planning engine: Reduce daily task count by 20%.");
  }

  return upgrades.length
    ? upgrades.join("\n")
    : "No planning evolution required.";
}
