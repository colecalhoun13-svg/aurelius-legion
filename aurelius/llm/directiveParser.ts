// aurelius/llm/directiveParser.ts
//
// Centralizes parsing of directives the LLM embeds in responses.
// Handles:
//   [SAVE: category=<cat> value="<text>"]
//   [TOOL: tool=<name> action=<name> data={...JSON...}]
//   [KNOWLEDGE_UPDATE_PROPOSE: data={...JSON...}]  (Phase 4.5)
//   [KNOWLEDGE_UPDATE_CONFIRM: data={...JSON...}]  (Phase 4.5)

export type SaveDirective = {
  category: string;
  value: string;
};

export type ToolDirective = {
  tool: string;
  action: string;
  data: Record<string, any>;
};

export type KnowledgeProposeDirective = {
  data: Record<string, any>;
};

export type KnowledgeConfirmDirective = {
  data: Record<string, any>;
};

export type ParsedDirectives = {
  saves: SaveDirective[];
  tools: ToolDirective[];
  knowledgeProposals: KnowledgeProposeDirective[];
  knowledgeConfirmations: KnowledgeConfirmDirective[];
  cleanedText: string;
};

export function extractDirectives(text: string): ParsedDirectives {
  const saves = extractSaveDirectives(text);
  const tools = extractToolDirectives(text);
  const knowledgeProposals = extractKnowledgeProposeDirectives(text);
  const knowledgeConfirmations = extractKnowledgeConfirmDirectives(text);
  const cleanedText = stripAllDirectives(text);
  return { saves, tools, knowledgeProposals, knowledgeConfirmations, cleanedText };
}

const SAVE_REGEX = /\[SAVE:\s*category=([a-z_]+)\s+value="([^"]*)"\s*\]/gi;

export function extractSaveDirectives(text: string): SaveDirective[] {
  const directives: SaveDirective[] = [];
  let match;
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

export function extractToolDirectives(text: string): ToolDirective[] {
  const directives: ToolDirective[] = [];
  const TOOL_START = /\[TOOL:\s*tool=([a-z_]+)\s+action=([a-z_]+)\s+data=/gi;
  TOOL_START.lastIndex = 0;
  let match;
  while ((match = TOOL_START.exec(text)) !== null) {
    const [fullMatch, tool, action] = match;
    const dataStart = match.index + fullMatch.length;
    const jsonResult = extractJSONFromPosition(text, dataStart);
    if (!jsonResult) {
      console.warn(`[directiveParser] couldn't parse JSON for tool=${tool} action=${action}`);
      continue;
    }
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

export function extractKnowledgeProposeDirectives(text: string): KnowledgeProposeDirective[] {
  return extractDataOnlyDirectives(text, "KNOWLEDGE_UPDATE_PROPOSE");
}

export function extractKnowledgeConfirmDirectives(text: string): KnowledgeConfirmDirective[] {
  return extractDataOnlyDirectives(text, "KNOWLEDGE_UPDATE_CONFIRM");
}

function extractDataOnlyDirectives<T extends { data: Record<string, any> }>(
  text: string,
  directiveName: string
): T[] {
  const directives: T[] = [];
  const startPattern = new RegExp(`\\[${directiveName}:\\s*data=`, "gi");
  startPattern.lastIndex = 0;
  let match;
  while ((match = startPattern.exec(text)) !== null) {
    const dataStart = match.index + match[0].length;
    const jsonResult = extractJSONFromPosition(text, dataStart);
    if (!jsonResult) {
      console.warn(`[directiveParser] couldn't parse JSON for ${directiveName}`);
      continue;
    }
    const afterJSON = text.slice(jsonResult.endIndex);
    if (!/^\s*\]/.test(afterJSON)) {
      console.warn(`[directiveParser] no closing ] after JSON for ${directiveName}`);
      continue;
    }
    let parsedData: Record<string, any>;
    try {
      parsedData = JSON.parse(jsonResult.json);
    } catch (err) {
      console.warn(`[directiveParser] invalid JSON for ${directiveName}:`, err);
      continue;
    }
    directives.push({ data: parsedData } as T);
  }
  return directives;
}

function extractJSONFromPosition(
  text: string,
  start: number
): { json: string; endIndex: number } | null {
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
  return null;
}

function stripAllDirectives(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\[SAVE:\s*category=[a-z_]+\s+value="[^"]*"\s*\]/gi, "");
  cleaned = stripBraceContainingDirectives(cleaned, /\[TOOL:\s*tool=[a-z_]+\s+action=[a-z_]+\s+data=/gi);
  cleaned = stripBraceContainingDirectives(cleaned, /\[KNOWLEDGE_UPDATE_PROPOSE:\s*data=/gi);
  cleaned = stripBraceContainingDirectives(cleaned, /\[KNOWLEDGE_UPDATE_CONFIRM:\s*data=/gi);
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

function stripBraceContainingDirectives(text: string, startPattern: RegExp): string {
  let result = "";
  let lastEnd = 0;
  startPattern.lastIndex = 0;
  let match;
  while ((match = startPattern.exec(text)) !== null) {
    result += text.slice(lastEnd, match.index);
    const dataStart = match.index + match[0].length;
    const jsonResult = extractJSONFromPosition(text, dataStart);
    if (!jsonResult) {
      lastEnd = match.index + match[0].length;
      continue;
    }
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
