// aurelius/observability/traceThreads.ts
//
// THE TRACE-THREAD READER (master-class #7). trace.ts stamps a shared traceId on
// every LogEntry a single operation produces; this reassembles those scattered
// rows back into one ordered thread. "Every decision visible; debug from the
// cockpit alone" (NORTH_STAR DoD) only holds if you can see a whole turn at once —
// request in, operator routed, model called, tools run, action gated or acted —
// not a flat stream of unrelated rows.
//
// Grouping happens in memory (fetch recent, bucket by traceId) rather than in SQL:
// it's a personal-scale log, and a JSON-path GROUP BY buys nothing here.

import { prisma } from "../core/db/prisma.ts";

// The trace-bearing LogEntry types. "trace" = runTraced/request/tool/action rows;
// "llm_call" = model dispatches. Both now carry context.traceId.
const THREADED_TYPES = ["trace", "llm_call"] as const;

export type TraceStep = {
  id: string;
  ts: string;              // ISO
  type: string;            // "trace" | "llm_call"
  kind: string | null;     // "request" | "tool" | "action" | "llm" | "schedule" | …
  name: string;            // event name (route, tool.action, action class, engine/model)
  status: "ok" | "error" | "started" | null;
  durationMs: number | null;
  detail: Record<string, any>;
};

export type TraceThread = {
  traceId: string;
  label: string;           // what opened the thread (request path, schedule name, …)
  startedAt: string;       // ISO of first step
  endedAt: string;         // ISO of last step
  durationMs: number;      // span across the thread
  count: number;
  hadError: boolean;
  kinds: string[];         // distinct kinds present, for at-a-glance shape
  steps: TraceStep[];      // ordered oldest → newest
};

function toStep(r: { id: string; type: string; message: string; level: string; context: any; createdAt: Date }): TraceStep {
  const ctx = (r.context ?? {}) as Record<string, any>;
  // llm_call rows put "engine/model" in message and don't carry a kind.
  const kind = ctx.kind ?? (r.type === "llm_call" ? "llm" : null);
  const status = (ctx.status as any) ?? (r.level === "error" ? "error" : null);
  const { traceId, kind: _k, name: _n, status: _s, durationMs: _d, ...rest } = ctx;
  return {
    id: r.id,
    ts: r.createdAt.toISOString(),
    type: r.type,
    kind,
    name: ctx.name ?? r.message,
    status,
    durationMs: typeof ctx.durationMs === "number" ? ctx.durationMs : (typeof ctx.latencyMs === "number" ? ctx.latencyMs : null),
    detail: rest,
  };
}

function summarize(traceId: string, rows: { id: string; type: string; message: string; level: string; context: any; createdAt: Date }[]): TraceThread {
  const steps = rows
    .map(toStep)
    .sort((a, b) => a.ts.localeCompare(b.ts));
  // Label the thread by whatever opened it: prefer the request row, else the
  // earliest non-tool/non-llm frame (the scheduled job or action), else first step.
  const root =
    steps.find((s) => s.kind === "request") ??
    steps.find((s) => s.kind && !["tool", "llm"].includes(s.kind)) ??
    steps[0];
  const kinds = [...new Set(steps.map((s) => s.kind).filter((k): k is string => !!k))];
  const startedAt = steps[0]?.ts ?? new Date(0).toISOString();
  const endedAt = steps[steps.length - 1]?.ts ?? startedAt;
  return {
    traceId,
    label: root?.name ?? traceId,
    startedAt,
    endedAt,
    durationMs: Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime()),
    count: steps.length,
    hadError: steps.some((s) => s.status === "error"),
    kinds,
    steps,
  };
}

/**
 * Recent trace threads, newest first. Fetches a window of recent trace rows,
 * buckets them by traceId, and returns the most recent `limit` threads assembled.
 */
export async function listTraceThreads(limit = 25): Promise<TraceThread[]> {
  const rows = await prisma.logEntry.findMany({
    where: { type: { in: [...THREADED_TYPES] } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const byThread = new Map<string, typeof rows>();
  for (const r of rows) {
    const tid = (r.context as any)?.traceId;
    if (typeof tid !== "string" || !tid) continue;
    const bucket = byThread.get(tid);
    if (bucket) bucket.push(r);
    else byThread.set(tid, [r]);
  }

  const threads = [...byThread.entries()].map(([tid, rs]) => summarize(tid, rs));
  // Newest thread first (by its most recent step).
  threads.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  return threads.slice(0, limit);
}

/** One thread by id — every step it produced, ordered oldest → newest. */
export async function getTraceThread(traceId: string): Promise<TraceThread | null> {
  if (!traceId) return null;
  const rows = await prisma.logEntry.findMany({
    where: {
      type: { in: [...THREADED_TYPES] },
      context: { path: ["traceId"], equals: traceId },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  if (rows.length === 0) return null;
  return summarize(traceId, rows);
}
