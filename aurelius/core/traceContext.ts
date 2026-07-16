// aurelius/core/traceContext.ts
//
// TRACE THREADING (master-class #7). A single chat turn fans out across layers —
// operator routing, the LLM call, tool executions, an executeAction gate — each
// leaving its own LogEntry row. Until now those rows were unrelated: you could
// see "an action happened" and "an LLM call happened" but not that THIS action
// came from THAT turn. This binds them with one correlation id.
//
// The id rides an AsyncLocalStorage store, so it threads through routeLLM → tools
// → executeAction WITHOUT changing a single function signature: set it once at
// the entry point (the request middleware, or a scheduled runTraced), and every
// nested trace write downstream reads the same ambient id. That's the whole
// point of ALS — invisible propagation across awaits.

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type TraceStore = { traceId: string; label: string; startedAt: number };

const als = new AsyncLocalStorage<TraceStore>();

export function newTraceId(): string {
  return randomUUID();
}

/** The ambient trace id, or null when running outside any traced scope. */
export function currentTraceId(): string | null {
  return als.getStore()?.traceId ?? null;
}

/** The ambient thread's human label (e.g. "request:/api/aurelius"), if any. */
export function currentTraceLabel(): string | null {
  return als.getStore()?.label ?? null;
}

/**
 * Run fn inside a trace scope. If one is ALREADY active, reuse it — nested calls
 * (a tool inside a request inside a scheduled job) all belong to the same thread.
 * Only the outermost caller opens a new thread, and its label names it.
 */
export function withTrace<T>(label: string, fn: () => T): T {
  if (als.getStore()) return fn();
  return als.run({ traceId: newTraceId(), label, startedAt: Date.now() }, fn);
}

/**
 * Force a brand-new thread even if one is active. For genuinely detached work
 * (a fire-and-forget background job spawned mid-request) that shouldn't be filed
 * under the turn that happened to launch it.
 */
export function withNewTrace<T>(label: string, fn: () => T): T {
  return als.run({ traceId: newTraceId(), label, startedAt: Date.now() }, fn);
}
