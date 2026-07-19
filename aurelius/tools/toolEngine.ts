// aurelius/tools/toolEngine.ts
//
// Central Tool Engine. Receives a ToolCall, dispatches to the appropriate
// adapter via toolRegistry, handles retries, times the call, persists to
// memory, returns a ToolResult.
//
// Architecture: this file knows nothing about specific tools. It's a lean
// dispatcher. All tool-specific logic (auth, formatting, API quirks) lives
// in adapter files.

import type { ToolCall, ToolResult } from "./types.ts";
import { getTool } from "./toolRegistry.ts";
import { saveMemory } from "../memory/memoryService.ts";
import { traceEvent } from "../core/trace.ts";

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// Phase 3 retry policy: one retry, 1s backoff, then fail loud.
// ═══════════════════════════════════════════════════════════════════

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;
// Per-call ceiling. A hung adapter (dead API, stuck child process) must fail
// the call loudly instead of blocking the chat request forever. The underlying
// promise isn't cancelled — the engine just stops waiting on it.
const TOOL_TIMEOUT_MS = 120_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
  const startTime = Date.now();

  // Lookup adapter
  const adapter = getTool(call.tool);
  if (!adapter) {
    const result: ToolResult = {
      ok: false,
      output: null,
      error: `Tool not found: "${call.tool}". Available tools: ${(await import("./toolRegistry.ts")).listTools().map(t => t.name).join(", ") || "(none registered)"}`,
      durationMs: Date.now() - startTime,
    };
    await persistToolMemory(call, result);
    return result;
  }

  // Validate action exists on this adapter
  const validAction = adapter.actions.find((a) => a.name === call.action);
  if (!validAction) {
    const result: ToolResult = {
      ok: false,
      output: null,
      error: `Action "${call.action}" not found on tool "${call.tool}". Valid actions: ${adapter.actions.map(a => a.name).join(", ")}`,
      durationMs: Date.now() - startTime,
    };
    await persistToolMemory(call, result);
    return result;
  }

  // Execute with retry policy. Adapters can override: maxRetries 0 for
  // non-idempotent work (a failed call must never silently re-fire), timeoutMs
  // for calls that can hang.
  const maxRetries = adapter.maxRetries ?? MAX_RETRIES;
  const timeoutMs = adapter.timeoutMs ?? TOOL_TIMEOUT_MS;
  let attempt = 0;
  let lastError: string | undefined;
  let lastOutput: Record<string, any> | null = null;
  let succeeded = false;

  while (attempt <= maxRetries && !succeeded) {
    if (attempt > 0) {
      console.warn(`[toolEngine] retrying ${call.tool}.${call.action} (attempt ${attempt + 1})`);
      await sleep(RETRY_DELAY_MS);
    }

    try {
      const adapterResult = await withTimeout(
        adapter.run(call.action, call.data, call.context),
        timeoutMs,
        `${call.tool}.${call.action}`
      );
      if (adapterResult.ok) {
        succeeded = true;
        lastOutput = adapterResult.output;
        lastError = undefined;
      } else {
        lastError = adapterResult.error ?? "adapter returned ok: false with no error";
        lastOutput = adapterResult.output;
      }
    } catch (err: any) {
      lastError = err?.message ?? String(err);
      lastOutput = null;
    }

    attempt++;
  }

  const result: ToolResult = {
    ok: succeeded,
    output: lastOutput,
    error: succeeded ? undefined : lastError,
    retries: attempt - 1,
    durationMs: Date.now() - startTime,
  };

  // Thread this tool call into the request's trace (master-class #7).
  traceEvent("tool", `${call.tool}.${call.action}`, {
    status: result.ok ? "ok" : "error",
    durationMs: result.durationMs,
    retries: result.retries ?? 0,
    ...(result.ok ? {} : { error: (result.error ?? "").slice(0, 300) }),
  });

  await persistToolMemory(call, result);
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// MEMORY PERSISTENCE
// Every tool call writes a memory entry — success or failure.
// Tagged to the primary operator at call time.
// Rich metadata captures tool, action, status, timing, and the input
// data so we can diagnose failures from memory alone.
// ═══════════════════════════════════════════════════════════════════

async function persistToolMemory(call: ToolCall, result: ToolResult): Promise<void> {
  try {
    const status = result.ok ? "success" : "failed";
    const summary = buildMemorySummary(call, result);

    await saveMemory({
      operator: call.operator,
      category: "tool_result",
      value: summary,
      relatedOperators: [],
      metadata: {
        tool: call.tool,
        action: call.action,
        clientId: call.context?.clientId,
        status,
        durationMs: result.durationMs,
        retries: result.retries ?? 0,
        error: result.error,
        inputData: call.data,
        outputSummary: result.output?.summary ?? null,
      },
    });
  } catch (err) {
    console.error("[toolEngine] failed to persist tool memory:", err);
    // Don't throw — memory persistence failure shouldn't kill the tool result.
  }
}

function buildMemorySummary(call: ToolCall, result: ToolResult): string {
  if (!result.ok) {
    return `Tool ${call.tool}.${call.action} failed: ${result.error ?? "unknown error"}`;
  }

  // Success: build a human-readable summary
  // Tool-specific summary builders can be added later if needed; for now,
  // generic summary based on the call structure.
  const clientPart = call.context?.clientId ? ` for client ${call.context.clientId}` : "";
  const outputSummary = result.output ? summarizeOutput(result.output) : "completed";
  return `Tool ${call.tool}.${call.action}${clientPart}: ${outputSummary}`;
}

function summarizeOutput(output: Record<string, any>): string {
  // If adapter provided a summary string, use it
  if (typeof output.summary === "string") {
    return output.summary;
  }

  // Otherwise, list keys and small primitive values
  const parts: string[] = [];
  for (const [key, value] of Object.entries(output)) {
    if (typeof value === "string" && value.length < 60) {
      parts.push(`${key}=${value}`);
    } else if (typeof value === "number" || typeof value === "boolean") {
      parts.push(`${key}=${value}`);
    } else if (Array.isArray(value)) {
      parts.push(`${key} (${value.length} items)`);
    }
  }

  return parts.length > 0 ? parts.join(", ") : "completed";
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}