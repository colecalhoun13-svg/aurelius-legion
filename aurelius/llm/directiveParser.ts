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

// Head of a TOOL directive = everything between "[TOOL:" and either the JSON
// "{" OR the closing "]" (zero-arg actions carry no data block). Liberal by
// design: models write the tool/action a few different ways and the parser must
// accept them all, or tool calls silently no-op. Handles:
//   [TOOL: tool=web action=search data={...}]   (canonical)
//   [TOOL: tool=web.search data={...}]           (dotted, no action=)
//   [TOOL: web.search {...}]                     (bare shorthand)
//   [TOOL: web.search data={...}]
//   [TOOL: planning.plan_week]                   (zero-arg — data defaults to {})
//   [TOOL: tool=gmail action=read_inbox]         (zero-arg, canonical)
const TOOL_HEAD = /\[TOOL:\s*([^{}\]]*?)\s*(?=[{\]])/gi;

// Directives quoted inside a ``` fenced block ``` or `inline code` are the model
// SHOWING a directive, not asking to run one — never execute (or strip) those.
// (Adversarial sweep: a quoted directive was firing for real.)
function computeCodeRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const fence = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) ranges.push([m.index, m.index + m[0].length]);
  const inline = /`[^`\n]*`/g;
  while ((m = inline.exec(text)) !== null) {
    const s = m.index;
    const e = m.index + m[0].length;
    if (!ranges.some(([rs, re]) => s >= rs && e <= re)) ranges.push([s, e]);
  }
  return ranges;
}
function indexInCode(ranges: Array<[number, number]>, idx: number): boolean {
  return ranges.some(([s, e]) => idx >= s && idx < e);
}

/** Pull tool + action out of a directive head, whatever form it took. */
export function parseToolHead(head: string): { tool: string; action: string } | null {
  let tool = head.match(/tool=([a-z0-9_.]+)/i)?.[1] ?? "";
  let action = head.match(/action=([a-z0-9_]+)/i)?.[1] ?? "";
  if (!tool) {
    const bare = head.trim().match(/^([a-z0-9_]+)(?:\.([a-z0-9_]+))?/i);
    if (bare) {
      tool = bare[1];
      if (!action && bare[2]) action = bare[2];
    }
  }
  if (tool.includes(".")) {
    const [t, a] = tool.split(".");
    tool = t;
    if (!action) action = a ?? "";
  }
  if (!tool || !action) return null;
  return { tool: tool.toLowerCase().trim(), action: action.toLowerCase().trim() };
}

export function extractToolDirectives(text: string): ToolDirective[] {
  const directives: ToolDirective[] = [];
  const codeRanges = computeCodeRanges(text);
  TOOL_HEAD.lastIndex = 0;
  let match;
  while ((match = TOOL_HEAD.exec(text)) !== null) {
    if (indexInCode(codeRanges, match.index)) continue; // quoted example — don't run
    const parsed = parseToolHead(match[1]);
    if (!parsed) {
      console.warn(`[directiveParser] couldn't parse tool head: "${match[1].trim()}"`);
      continue;
    }
    // The lookahead stopped on '{' (data block follows) or ']' (zero-arg action).
    const dataStart = match.index + match[0].length;
    if (text[dataStart] === "]") {
      directives.push({ tool: parsed.tool, action: parsed.action, data: {} });
      continue;
    }
    const jsonResult = extractJSONFromPosition(text, dataStart);
    if (!jsonResult) {
      console.warn(`[directiveParser] couldn't parse JSON for ${parsed.tool}.${parsed.action}`);
      continue;
    }
    const afterJSON = text.slice(jsonResult.endIndex);
    if (!/^\s*\]/.test(afterJSON)) {
      console.warn(`[directiveParser] no closing ] after JSON for ${parsed.tool}.${parsed.action}`);
      continue;
    }
    let parsedData: Record<string, any>;
    try {
      parsedData = JSON.parse(jsonResult.json);
    } catch (err) {
      console.warn(`[directiveParser] invalid JSON for ${parsed.tool}.${parsed.action}:`, err);
      continue;
    }
    directives.push({ tool: parsed.tool, action: parsed.action, data: parsedData });
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
  const codeRanges = computeCodeRanges(text);
  const startPattern = new RegExp(`\\[${directiveName}:\\s*data=`, "gi");
  startPattern.lastIndex = 0;
  let match;
  while ((match = startPattern.exec(text)) !== null) {
    if (indexInCode(codeRanges, match.index)) continue; // quoted example — don't act
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
  // A directive quoted in a code fence is neither executed (see extractors) nor
  // stripped — it stays visible as the example the model meant to show.
  const codeRanges = computeCodeRanges(text);
  let cleaned = text;
  cleaned = stripSimpleDirectives(cleaned, /\[SAVE:\s*category=[a-z_]+\s+value="[^"]*"\s*\]/gi, codeRanges);
  cleaned = stripBraceContainingDirectives(cleaned, /\[TOOL:\s*[^{}\]]*?(?=\{)/gi);
  // Zero-arg tool directives carry no brace block: [TOOL: planning.plan_week]
  cleaned = stripSimpleDirectives(cleaned, /\[TOOL:\s*[^{}\]]*?\]/gi, computeCodeRanges(cleaned));
  cleaned = stripBraceContainingDirectives(cleaned, /\[KNOWLEDGE_UPDATE_PROPOSE:\s*data=/gi);
  cleaned = stripBraceContainingDirectives(cleaned, /\[KNOWLEDGE_UPDATE_CONFIRM:\s*data=/gi);
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

// Strip a self-contained directive (no nested JSON) unless it sits in code.
function stripSimpleDirectives(text: string, pattern: RegExp, codeRanges: Array<[number, number]>): string {
  let result = "";
  let lastEnd = 0;
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (indexInCode(codeRanges, match.index)) continue; // leave quoted example intact
    result += text.slice(lastEnd, match.index);
    lastEnd = match.index + match[0].length;
  }
  result += text.slice(lastEnd);
  return result;
}

function stripBraceContainingDirectives(text: string, startPattern: RegExp): string {
  const codeRanges = computeCodeRanges(text);
  let result = "";
  let lastEnd = 0;
  startPattern.lastIndex = 0;
  let match;
  while ((match = startPattern.exec(text)) !== null) {
    if (indexInCode(codeRanges, match.index)) continue; // leave quoted example intact
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
