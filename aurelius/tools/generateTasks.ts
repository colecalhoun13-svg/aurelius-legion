/**
 * generateTasks.ts
 * Aurelius OS v3.4 — Task Extraction Tool
 *
 * Converts engine output + user message → structured tasks.
 * Operator-aware, workflow-ready, and safe to call from workflowEngine.
 */

import type { OperatorType } from "../types.ts";

export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  domain: OperatorType;
  priority: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "done";
  source: "engine" | "user";
  createdAt: string;
}

interface GenerateTasksArgs {
  message: string;
  engineResponse: string;
  operator: OperatorType;
}

export async function generateTasks(
  args: GenerateTasksArgs
): Promise<GeneratedTask[]> {
  const { message, engineResponse, operator } = args;

  const now = new Date().toISOString();
  const tasks: GeneratedTask[] = [];

  // 1. Extract candidate lines from engine response
  const lines = splitIntoLines(engineResponse);

  for (const line of lines) {
    const cleaned = normalizeLine(line);
    if (!cleaned) continue;

    tasks.push({
      id: buildTaskId(cleaned, now),
      title: buildTitle(cleaned),
      description: cleaned,
      domain: operator,
      priority: inferPriority(cleaned),
      status: "pending",
      source: "engine",
      createdAt: now
    });
  }

  // 2. Fallback: if engine gave nothing actionable, derive one task from user message
  if (tasks.length === 0) {
    const fallback = message.trim();
    if (fallback) {
      tasks.push({
        id: buildTaskId(fallback, now),
        title: buildTitle(fallback),
        description: fallback,
        domain: operator,
        priority: "medium",
        status: "pending",
        source: "user",
        createdAt: now
      });
    }
  }

  return dedupeTasks(tasks);
}

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function splitIntoLines(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizeLine(line: string): string | null {
  if (!line) return null;

  // Strip bullets / numbering
  let cleaned = line.replace(/^[-*•]\s*/, "");
  cleaned = cleaned.replace(/^\d+[\).\]]\s*/, "");
  cleaned = cleaned.trim();

  // Ignore meta lines
  if (!cleaned) return null;
  if (/^note[:]/i.test(cleaned)) return null;
  if (/^insight[:]/i.test(cleaned)) return null;

  return cleaned;
}

function buildTaskId(text: string, timestamp: string): string {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const suffix = Buffer.from(timestamp).toString("base64").slice(0, 8);
  return `${base || "task"}-${suffix}`;
}

function buildTitle(text: string): string {
  if (text.length <= 80) return text;
  return text.slice(0, 77) + "...";
}

function inferPriority(text: string): "low" | "medium" | "high" {
  const lower = text.toLowerCase();

  if (
    lower.includes("today") ||
    lower.includes("tonight") ||
    lower.includes("urgent") ||
    lower.includes("asap")
  ) {
    return "high";
  }

  if (
    lower.includes("this week") ||
    lower.includes("soon") ||
    lower.includes("next few days")
  ) {
    return "medium";
  }

  return "low";
}

function dedupeTasks(tasks: GeneratedTask[]): GeneratedTask[] {
  const seen = new Set<string>();
  const result: GeneratedTask[] = [];

  for (const task of tasks) {
    const key = `${task.domain}:${task.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(task);
  }

  return result;
}
