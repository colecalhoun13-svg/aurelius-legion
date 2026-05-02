// aurelius/tools/toolRegistry.ts
//
// Tool Registry — adapters self-register here at app startup.
// Tool Engine looks up adapters by name and dispatches actions to them.
//
// Adding a new tool = create an adapter file, call registerTool() in
// registerTools.ts. No changes to Tool Engine itself.

import type { ToolAdapter } from "./types.ts";

// ═══════════════════════════════════════════════════════════════════
// REGISTRY STATE
// In-memory map. Adapters registered at startup persist for the
// lifetime of the process.
// ═══════════════════════════════════════════════════════════════════

const registry = new Map<string, ToolAdapter>();

// ═══════════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════════

export function registerTool(adapter: ToolAdapter): void {
  if (registry.has(adapter.name)) {
    console.warn(`[toolRegistry] tool "${adapter.name}" already registered, overwriting`);
  }
  registry.set(adapter.name, adapter);
  console.log(`[toolRegistry] registered tool: ${adapter.name} (${adapter.actions.length} actions)`);
}

// ═══════════════════════════════════════════════════════════════════
// LOOKUP
// ═══════════════════════════════════════════════════════════════════

export function getTool(name: string): ToolAdapter | undefined {
  return registry.get(name);
}

export function listTools(): ToolAdapter[] {
  return Array.from(registry.values());
}

export function hasTool(name: string): boolean {
  return registry.has(name);
}

// ═══════════════════════════════════════════════════════════════════
// CATALOG GENERATION
// Build a string description of all available tools for injection
// into the LLM system prompt. This is what teaches the LLM how to
// produce [TOOL: ...] directives.
// ═══════════════════════════════════════════════════════════════════

export function buildToolCatalog(): string {
  const tools = listTools();

  if (tools.length === 0) {
    return ""; // no tools registered, no catalog
  }

  const lines: string[] = [];
  lines.push("AVAILABLE TOOLS:");
  lines.push("");
  lines.push("You can invoke tools by appending a directive at the end of your");
  lines.push("response in this exact format:");
  lines.push("");
  lines.push('  [TOOL: tool=<tool_name> action=<action_name> data={...JSON...}]');
  lines.push("");
  lines.push("Tool calls execute synchronously. Use them when Cole's request");
  lines.push("requires real action (logging data, creating events, etc.) — not");
  lines.push("for casual chat.");
  lines.push("");

  for (const tool of tools) {
    lines.push(`TOOL: ${tool.name}`);
    lines.push(`  ${tool.description}`);
    lines.push("  Actions:");
    for (const action of tool.actions) {
      lines.push(`    - ${action.name}: ${action.description}`);
      lines.push(`      data shape: ${action.dataSchema}`);
      if (action.example) {
        lines.push(`      example: ${action.example}`);
      }
    }
    lines.push("");
  }

  lines.push("Rules:");
  lines.push("  — Only use tools that exist in this catalog. Never invent tool names.");
  lines.push("  — Only use actions listed for each tool.");
  lines.push("  — The data field must be valid JSON.");
  lines.push("  — Don't explain you're calling a tool. The directive is silent.");
  lines.push("  — If a tool call fails, you'll see the error in your next turn.");

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════
// CLEAR (mostly for testing)
// ═══════════════════════════════════════════════════════════════════

export function clearRegistry(): void {
  registry.clear();
}