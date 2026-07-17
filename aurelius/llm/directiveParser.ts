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

// ── Near-miss detection (council fix — the silent save-loss bug) ──────
// A fallback model that writes value='...' instead of value="..." or drops a
// field produced a directive that strict parsing ignores — the memory/tool call
// silently vanished AND the junk leaked into the reply. This loose scan finds
// anything that LOOKS like it wanted to be a directive, then checks whether the
// strict rules actually consumed it. What didn't parse is a near-miss: the
// caller pages Cole and strips the fragment, instead of silence.

export type NearMiss = { kind: string; fragment: string };

/**
 * Defuse directive syntax inside EXTERNAL content (email bodies, RSS items,
 * fetched pages) before it enters a prompt — an injected "[TOOL: ...]" in an
 * inbound email must never survive verbatim echo into an executable position.
 * The red team's finding: the LLM is an unauthenticated route; this closes the
 * cheapest attack. Inserting a space breaks strict parsing AND near-miss
 * stripping leaves it visible, so a poisoned source is inspectable, not silent.
 */
export function defuseDirectives(text: string): string {
  return (text ?? "").replace(/\[(\s*)(SAVE|TOOL|KNOWLEDGE_UPDATE_PROPOSE|KNOWLEDGE_UPDATE_CONFIRM)(\s*):/gi, "[$2 (defused):");
}

const LOOSE_DIRECTIVE = /\[\s*(SAVE|TOOL|KNOWLEDGE_UPDATE_PROPOSE|KNOWLEDGE_UPDATE_CONFIRM)\b/gi;

function strictParsesAt(text: string, idx: number, kind: string): boolean {
  const slice = text.slice(idx);
  if (kind === "SAVE") {
    return /^\[SAVE:\s*category=[a-z_]+\s+value="[^"]*"\s*\]/i.test(slice);
  }
  if (kind === "TOOL") {
    const head = slice.match(/^\[TOOL:\s*([^{}\]]*?)\s*(?=[{\]])/i);
    if (!head || !parseToolHead(head[1])) return false;
    const dataStart = idx + head[0].length;
    if (text[dataStart] === "]") return true;
    const json = extractJSONFromPosition(text, dataStart);
    if (!json) return false;
    try {
      JSON.parse(json.json);
    } catch {
      return false;
    }
    return /^\s*\]/.test(text.slice(json.endIndex));
  }
  // Knowledge directives
  const head = slice.match(new RegExp(`^\\[${kind}:\\s*data=`, "i"));
  if (!head) return false;
  const json = extractJSONFromPosition(text, idx + head[0].length);
  if (!json) return false;
  try {
    JSON.parse(json.json);
  } catch {
    return false;
  }
  return /^\s*\]/.test(text.slice(json.endIndex));
}

/** Find would-be directives the strict parser did NOT consume. Code-fenced
 * examples are exempt (they're the model showing, not asking). */
export function detectNearMisses(text: string): NearMiss[] {
  const misses: NearMiss[] = [];
  const codeRanges = computeCodeRanges(text);
  LOOSE_DIRECTIVE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LOOSE_DIRECTIVE.exec(text)) !== null) {
    if (indexInCode(codeRanges, m.index)) continue;
    const kind = m[1].toUpperCase();
    if (strictParsesAt(text, m.index, kind)) continue;
    // Fragment for the page + for stripping: through the first "]" or 160 chars.
    const slice = text.slice(m.index, m.index + 160);
    const close = slice.indexOf("]");
    misses.push({ kind, fragment: close >= 0 ? slice.slice(0, close + 1) : slice });
  }
  return misses;
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
