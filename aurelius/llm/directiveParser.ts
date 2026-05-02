// aurelius/llm/directiveParser.ts
//
// Centralizes parsing of directives that the LLM embeds in its responses.
// Currently handles:
//   [SAVE: category=<cat> value="<text>"]
//   [TOOL: tool=<name> action=<name> data={...JSON...}]
//
// Adding new directive types: extend ParsedDirectives and add a parser block here.
// The chat endpoint calls extractDirectives(text) once and acts on whatever it returns.

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type SaveDirective = {
  category: string;
  value: string;
};

export type ToolDirective = {
  tool: string;
  action: string;
  data: Record<string, any>;
};

export type ParsedDirectives = {
  saves: SaveDirective[];
  tools: ToolDirective[];
  cleanedText: string;        // response text with all directives stripped
};

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════

export function extractDirectives(text: string): ParsedDirectives {
  const saves = extractSaveDirectives(text);
  const tools = extractToolDirectives(text);
  const cleanedText = stripAllDirectives(text);

  return { saves, tools, cleanedText };
}

// ═══════════════════════════════════════════════════════════════════
// SAVE DIRECTIVE PARSING
// Format: [SAVE: category=<cat> value="<the fact>"]
// ═══════════════════════════════════════════════════════════════════

const SAVE_REGEX = /\[SAVE:\s*category=([a-z_]+)\s+value="([^"]*)"\s*\]/gi;

export function extractSaveDirectives(text: string): SaveDirective[] {
  const directives: SaveDirective[] = [];
  let match;

  // Reset regex state because /g regexes are stateful
  SAVE_REGEX.lastIndex = 0;

  while ((match = SAVE_REGEX.exec(text)) !== null) {
    const [, category, value] = match;
    if (category && value) {
      directives.push({
        category: category.toLowerCase().trim(),
        value: value.trim(),
      });
    }
  }

  return directives;
}

// ═══════════════════════════════════════════════════════════════════
// TOOL DIRECTIVE PARSING
// Format: [TOOL: tool=<name> action=<name> data={...JSON...}]
//
// JSON parsing is the tricky bit — we have to find the matching closing
// brace because the JSON itself can contain braces. We use a simple
// brace-matching walker rather than regex for the data field.
// ═══════════════════════════════════════════════════════════════════

export function extractToolDirectives(text: string): ToolDirective[] {
  const directives: ToolDirective[] = [];
  const TOOL_START = /\[TOOL:\s*tool=([a-z_]+)\s+action=([a-z_]+)\s+data=/gi;

  TOOL_START.lastIndex = 0;
  let match;

  while ((match = TOOL_START.exec(text)) !== null) {
    const [fullMatch, tool, action] = match;
    const dataStart = match.index + fullMatch.length;

    // Find the matching closing brace for the JSON object
    const jsonResult = extractJSONFromPosition(text, dataStart);
    if (!jsonResult) {
      console.warn(`[directiveParser] couldn't parse JSON for tool=${tool} action=${action}`);
      continue;
    }

    // After the JSON, expect optional whitespace then `]` to close the directive
    const afterJSON = text.slice(jsonResult.endIndex);
    if (!/^\s*\]/.test(afterJSON)) {
      console.warn(`[directiveParser] no closing ] after JSON for tool=${tool} action=${action}`);
      continue;
    }

    let parsedData: Record<string, any>;
    try {
      parsedData = JSON.parse(jsonResult.json);
    } catch (err) {
      console.warn(`[directiveParser] invalid JSON for tool=${tool} action=${action}:`, err);
      continue;
    }

    directives.push({
      tool: tool.toLowerCase().trim(),
      action: action.toLowerCase().trim(),
      data: parsedData,
    });
  }

  return directives;
}

// Walk the text from `start` finding the matching closing `}` for a JSON object.
// Handles nested braces and string literals (so `}` inside a string doesn't fool us).
function extractJSONFromPosition(text: string, start: number): { json: string; endIndex: number } | null {
  // Skip whitespace to find the opening brace
  let i = start;
  while (i < text.length && /\s/.test(text[i]!)) i++;
  if (text[i] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  const jsonStart = i;

  for (; i < text.length; i++) {
    const ch = text[i]!;

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return {
          json: text.slice(jsonStart, i + 1),
          endIndex: i + 1,
        };
      }
    }
  }

  return null; // unmatched braces
}

// ═══════════════════════════════════════════════════════════════════
// STRIP DIRECTIVES FROM TEXT
// Remove all directives so the response Cole sees doesn't include them.
// ═══════════════════════════════════════════════════════════════════

function stripAllDirectives(text: string): string {
  let cleaned = text;

  // Strip SAVE directives (regex-safe — no nested braces)
  cleaned = cleaned.replace(/\[SAVE:\s*category=[a-z_]+\s+value="[^"]*"\s*\]/gi, "");

  // Strip TOOL directives — needs the same brace-walking approach as parsing
  cleaned = stripToolDirectives(cleaned);

  // Clean up any extra blank lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

function stripToolDirectives(text: string): string {
  const TOOL_START = /\[TOOL:\s*tool=[a-z_]+\s+action=[a-z_]+\s+data=/gi;
  let result = "";
  let lastEnd = 0;

  TOOL_START.lastIndex = 0;
  let match;

  while ((match = TOOL_START.exec(text)) !== null) {
    result += text.slice(lastEnd, match.index);

    const dataStart = match.index + match[0].length;
    const jsonResult = extractJSONFromPosition(text, dataStart);

    if (!jsonResult) {
      // Couldn't parse — skip past `[TOOL:` and continue
      lastEnd = match.index + match[0].length;
      continue;
    }

    // Find the closing `]`
    const afterJSON = text.slice(jsonResult.endIndex);
    const closeMatch = afterJSON.match(/^\s*\]/);
    if (closeMatch) {
      lastEnd = jsonResult.endIndex + closeMatch[0].length;
    } else {
      lastEnd = jsonResult.endIndex;
    }
  }

  result += text.slice(lastEnd);
  return result;
}