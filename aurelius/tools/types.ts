// aurelius/tools/types.ts
//
// Shared types for the Tool Engine.
// Every tool adapter implements this contract.

export type ToolCall = {
  tool: string;                       // "google_sheets"
  action: string;                     // "log_session"
  data: Record<string, any>;          // tool-specific payload
  operator: string;                   // primary operator at call time
  context?: {
    clientId?: string;                // for client-scoped operations
    chainId?: string;                 // Phase 9 — autonomy chains
  };
};

export type ToolResult = {
  ok: boolean;
  output: Record<string, any> | null;
  error?: string;
  retries?: number;
  durationMs: number;
};

// ═══════════════════════════════════════════════════════════════════
// TOOL ADAPTER CONTRACT
// Every tool adapter implements this interface.
// ═══════════════════════════════════════════════════════════════════

export type ToolAction = {
  name: string;                       // action name within the tool
  description: string;                // for the LLM tool catalog
  dataSchema: string;                 // human-readable schema description
  example?: string;                   // optional usage example for the LLM
};

export type ToolAdapter = {
  name: string;                       // tool name (e.g., "google_sheets")
  description: string;                // for the LLM tool catalog
  actions: ToolAction[];              // what this tool can do
  
  // Execute an action. Adapter handles its own auth, retries (where adapter-specific),
  // and tool-specific error mapping.
  run(action: string, data: Record<string, any>, context?: ToolCall["context"]): Promise<ToolAdapterResult>;
};

// What an adapter returns internally — Tool Engine wraps this with retry/timing into ToolResult.
export type ToolAdapterResult = {
  ok: boolean;
  output: Record<string, any> | null;
  error?: string;
};