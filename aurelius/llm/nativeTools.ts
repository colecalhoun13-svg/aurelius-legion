// aurelius/llm/nativeTools.ts
//
// NATIVE STRUCTURED TOOL CALLING — the migration off regex-only directives.
//
// The model no longer has to write a well-formed `[TOOL: ...]` string and hope
// the parser catches it: every directive-capable provider (anthropic, openai,
// gemini) is offered ONE native function — invoke_tool(tool, action, data) —
// whose calls arrive as structured API objects that cannot be malformed,
// code-fenced, or kebab-cased into a silent no-op. The tool CATALOG (Layer 6)
// stays the source of truth for what tools/actions exist; this is the wire
// format, not a second registry.
//
// The legacy text form still parses and still executes — belt and suspenders
// during the transition, and the near-miss pager keeps watching the text path.

import type { ToolDirective } from "./directiveParser.ts";

export const INVOKE_TOOL_NAME = "invoke_tool";

const DESCRIPTION =
  "Invoke one of Aurelius's tools. Pass the tool name, the action name, and the data payload EXACTLY as documented in the AVAILABLE TOOLS catalog.";

// One JSON-schema, shaped per provider dialect below.
const PARAMS_JSON_SCHEMA = {
  type: "object",
  properties: {
    tool: { type: "string", description: 'Tool name from the catalog, e.g. "google_sheets"' },
    action: { type: "string", description: 'Action on that tool, e.g. "log_session"' },
    data: { type: "object", description: "Action payload matching the catalog's data schema" },
  },
  required: ["tool", "action"],
} as const;

// Gemini's v1beta function declarations use the uppercase OpenAPI type enum.
const PARAMS_GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    tool: { type: "STRING", description: 'Tool name from the catalog, e.g. "google_sheets"' },
    action: { type: "STRING", description: 'Action on that tool, e.g. "log_session"' },
    data: { type: "OBJECT", description: "Action payload matching the catalog's data schema" },
  },
  required: ["tool", "action"],
} as const;

/** The provider-dialect tools array to attach to a request. Null = provider
 *  doesn't support native calling (prose-only tiers never get tools). */
export function nativeToolsFor(provider: string): any[] | null {
  switch (provider) {
    case "anthropic":
      return [{ name: INVOKE_TOOL_NAME, description: DESCRIPTION, input_schema: PARAMS_JSON_SCHEMA }];
    case "openai":
      return [
        {
          type: "function",
          function: { name: INVOKE_TOOL_NAME, description: DESCRIPTION, parameters: PARAMS_JSON_SCHEMA },
        },
      ];
    case "gemini":
      return [
        {
          functionDeclarations: [
            { name: INVOKE_TOOL_NAME, description: DESCRIPTION, parameters: PARAMS_GEMINI_SCHEMA },
          ],
        },
      ];
    default:
      return null;
  }
}

function normalize(args: any): ToolDirective | null {
  const tool = String(args?.tool ?? "").trim().toLowerCase();
  const action = String(args?.action ?? "").trim().toLowerCase();
  if (!tool || !action) return null;
  const data = args?.data && typeof args.data === "object" && !Array.isArray(args.data) ? args.data : {};
  return { tool, action, data };
}

/**
 * Extract invoke_tool calls from a provider's RAW response. Pure functions —
 * fixture-testable in the smoke suite with zero network. Unknown shapes and
 * malformed arguments degrade to [] (the text path still parses normally),
 * never to a throw.
 */
export function parseNativeToolCalls(provider: string, raw: any): ToolDirective[] {
  try {
    switch (provider) {
      case "anthropic": {
        const blocks = Array.isArray(raw?.content) ? raw.content : [];
        return blocks
          .filter((b: any) => b?.type === "tool_use" && b?.name === INVOKE_TOOL_NAME)
          .map((b: any) => normalize(b.input))
          .filter(Boolean) as ToolDirective[];
      }
      case "openai": {
        const calls = raw?.choices?.[0]?.message?.tool_calls ?? [];
        return calls
          .filter((c: any) => c?.function?.name === INVOKE_TOOL_NAME)
          .map((c: any) => {
            try {
              return normalize(JSON.parse(c.function.arguments ?? "{}"));
            } catch {
              return null; // malformed JSON args → drop this call, keep the rest
            }
          })
          .filter(Boolean) as ToolDirective[];
      }
      case "gemini": {
        const parts = raw?.candidates?.[0]?.content?.parts ?? [];
        return parts
          .filter((p: any) => p?.functionCall?.name === INVOKE_TOOL_NAME)
          .map((p: any) => normalize(p.functionCall.args))
          .filter(Boolean) as ToolDirective[];
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

/** Merge native calls with text-parsed directives, deduping exact repeats
 *  (a model that calls natively AND writes the bracket form must fire once). */
export function mergeToolDirectives(text: ToolDirective[], native: ToolDirective[]): ToolDirective[] {
  const key = (d: ToolDirective) => `${d.tool}|${d.action}|${JSON.stringify(d.data ?? {})}`;
  const seen = new Set(text.map(key));
  const merged = [...text];
  for (const d of native) {
    if (!seen.has(key(d))) {
      seen.add(key(d));
      merged.push(d);
    }
  }
  return merged;
}
