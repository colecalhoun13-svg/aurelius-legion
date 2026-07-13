// aurelius/core/trace.ts
//
// STRUCTURED TRACING — the "every decision visible; debug from the
// cockpit alone" DoD line. Every scheduled run and every API request
// leaves a LogEntry row (type "trace") with kind, name, duration, and
// outcome. The cockpit reads these rows; nothing depends on scraping
// console output. Writes are fire-and-forget: telemetry must never
// break the thing it observes.

import { prisma } from "./db/prisma.ts";

let _opId: string | null | undefined;

async function traceOperatorId(): Promise<string | null> {
  if (_opId !== undefined) return _opId;
  try {
    const op =
      (await prisma.operator.findUnique({ where: { name: "global" }, select: { id: true } })) ??
      (await prisma.operator.findFirst({ select: { id: true } }));
    // Cache only a real resolution — a transient DB failure at boot must
    // not permanently disable telemetry for the life of the process.
    if (op?.id) _opId = op.id;
    return op?.id ?? null;
  } catch {
    return null;
  }
}

async function persist(level: "info" | "error", message: string, context: Record<string, any>): Promise<void> {
  const operatorId = await traceOperatorId();
  if (!operatorId) return;
  await prisma.logEntry.create({
    data: { operatorId, type: "trace", level, message, context },
  });
}

function write(level: "info" | "error", message: string, context: Record<string, any>) {
  persist(level, message, context).catch(() => {}); // telemetry never throws into the traced path
}

/**
 * Emit a "started" marker BEFORE a job runs and AWAIT it. Scheduled jobs
 * otherwise only leave a trace once they finish (runTraced writes on completion),
 * so a long-running live job is invisible to catch-up's ranToday — and boot's
 * catch-up sweep would double-fire it (two morning briefings, duplicate
 * scoreboards). A committed start marker makes the in-flight run visible.
 * Best-effort: if telemetry can't write, we don't block the job.
 */
export async function markStarted(kind: string, name: string): Promise<void> {
  try {
    await persist("info", `${kind}:${name}`, { kind, name, status: "started" });
  } catch {
    /* telemetry down — proceed; the completion write still records the run */
  }
}

/** One row per boot — the cockpit derives uptime from the latest marker. */
export function logBootMarker() {
  traceOperatorId()
    .then((operatorId) => {
      if (!operatorId) return;
      return prisma.logEntry.create({
        data: {
          operatorId,
          type: "boot",
          level: "info",
          message: "aurelius backend online",
          context: { pid: process.pid, node: process.version },
        },
      });
    })
    .catch(() => {});
}

/**
 * Run a unit of background work with a trace record: kind ("schedule",
 * "request", "poll"), name ("morning_briefing"), duration, ok/error.
 * Rethrows — tracing observes, it doesn't swallow.
 */
export async function runTraced<T>(
  kind: string,
  name: string,
  fn: () => Promise<T>,
  meta: Record<string, any> = {}
): Promise<T> {
  const started = Date.now();
  // Scheduled/catch-up runs claim visibility up front so a boot catch-up sweep
  // can't double-fire a job the live scheduler is mid-flight on. (Requests skip
  // this — they don't race a catch-up and don't need the extra row.)
  if (kind === "schedule" || kind === "catchup") {
    await markStarted(kind, name);
  }
  try {
    const result = await fn();
    write("info", `${kind}:${name}`, { kind, name, durationMs: Date.now() - started, status: "ok", ...meta });
    return result;
  } catch (err: any) {
    write("error", `${kind}:${name}`, {
      kind,
      name,
      durationMs: Date.now() - started,
      status: "error",
      error: (err?.message ?? String(err)).slice(0, 500),
      ...meta,
    });
    throw err;
  }
}

/**
 * Express middleware: one trace row per finished API request — except
 * fast, successful GETs, which are volume without signal. Mutations,
 * errors, and slow reads all land.
 */
export function requestTracer(scope: string) {
  return (req: any, res: any, next: any) => {
    const started = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - started;
      const boring = req.method === "GET" && res.statusCode < 400 && durationMs < 500;
      if (boring) return;
      write(res.statusCode >= 500 ? "error" : "info", `request:${scope}${req.path}`, {
        kind: "request",
        name: `${scope}${req.path}`,
        method: req.method,
        statusCode: res.statusCode,
        durationMs,
      });
    });
    next();
  };
}
