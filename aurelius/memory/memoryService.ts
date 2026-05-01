// aurelius/memory/memoryService.ts
//
// Aurelius's memory service layer.
// Multi-operator aware: memories tag to a primary operator and optionally
// list "related" operators in metadata. Retrieval surfaces a memory whenever
// EITHER its primary operator OR any related operator is the active operator.

import {
  saveMemory as repoSaveMemory,
  getMemoriesByCategory,
  searchMemories as repoSearchMemories,
  getMemoryTimeline,
} from "../repositories/memoryRepository.ts";
import { prisma } from "../core/db/prisma.ts";

// ═══════════════════════════════════════════════════════════════════
// CATEGORY VOCABULARY
// ═══════════════════════════════════════════════════════════════════

export const MEMORY_CATEGORIES = [
  "profile",
  "preferences",
  "goals",
  "clients",
  "events",
  "decisions",
  "context",
  "facts",
] as const;

export type MemoryCategory = typeof MEMORY_CATEGORIES[number];

// ═══════════════════════════════════════════════════════════════════
// Operator name → UUID cache
// ═══════════════════════════════════════════════════════════════════

const operatorIdCache = new Map<string, string>();

export async function getOperatorIdByName(name: string): Promise<string | null> {
  if (operatorIdCache.has(name)) {
    return operatorIdCache.get(name)!;
  }

  const operator = await prisma.operator.findUnique({
    where: { name },
    select: { id: true },
  });

  if (!operator) {
    console.warn(`[memoryService] Operator not found: "${name}"`);
    return null;
  }

  operatorIdCache.set(name, operator.id);
  return operator.id;
}

// ═══════════════════════════════════════════════════════════════════
// SAVE — multi-operator aware
// Primary tag goes on operatorId. Secondaries go in metadata.relatedOperators.
// ═══════════════════════════════════════════════════════════════════

export type SaveMemoryParams = {
  operator: string;             // primary operator (becomes the row's operatorId)
  category: string;
  value: string;
  relatedOperators?: string[];  // secondary operators that also "touch" this memory
  metadata?: Record<string, any>;
};

export async function saveMemory(params: SaveMemoryParams) {
  const operatorId = await getOperatorIdByName(params.operator);
  if (!operatorId) {
    console.error(`[memoryService] Cannot save — unknown primary operator: ${params.operator}`);
    return null;
  }

  // Validate related operators exist (filter out any unknowns; warn but don't fail)
  const validRelated: string[] = [];
  if (params.relatedOperators?.length) {
    for (const rel of params.relatedOperators) {
      if (rel === params.operator) continue; // skip self-reference
      const relId = await getOperatorIdByName(rel);
      if (relId) validRelated.push(rel);
    }
  }

  // Merge user-provided metadata with relatedOperators
  const metadata = {
    ...(params.metadata ?? {}),
    ...(validRelated.length > 0 ? { relatedOperators: validRelated } : {}),
  };

  return repoSaveMemory({
    operatorId,
    category: params.category,
    value: params.value,
    metadata,
  });
}

// ═══════════════════════════════════════════════════════════════════
// RETRIEVAL — relations-aware
// A memory surfaces when the active operator is either:
//   - the memory's primary operator (operatorId matches), OR
//   - listed in metadata.relatedOperators
// ═══════════════════════════════════════════════════════════════════

export type FormattedMemory = {
  id: string;
  category: string;
  value: string;
  createdAt: Date;
  primaryOperator: string;
  relatedOperators: string[];
};

function adaptiveCap(corpusSize: number): number {
  if (corpusSize < 100) return 30;
  if (corpusSize < 500) return 50;
  if (corpusSize < 2000) return 75;
  return 100;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "can", "this", "that", "these",
  "those", "i", "you", "he", "she", "it", "we", "they", "what", "which",
  "who", "when", "where", "why", "how", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "up", "out", "if", "as", "so", "my", "your", "me",
  "us", "them", "him", "her", "his", "their", "our", "any", "all", "some",
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, 8);
}

export type LoadMemoriesParams = {
  operator: string;          // the active operator (primary)
  userMessage?: string;      // for keyword-tier retrieval
};

/**
 * Load memories where either:
 *   - operatorId matches the active operator, OR
 *   - metadata.relatedOperators includes the active operator
 *
 * Tiered: profile → keyword search → recent fallback.
 */
export async function loadMemoriesForOperator(
  params: LoadMemoriesParams
): Promise<FormattedMemory[]> {
  const operatorId = await getOperatorIdByName(params.operator);
  if (!operatorId) return [];

  // Total relevant corpus = direct + related
  const corpusSize = await prisma.memory.count({
    where: {
      OR: [
        { operatorId },
        {
          metadata: {
            path: ["relatedOperators"],
            array_contains: params.operator,
          },
        },
      ],
    },
  });

  const cap = adaptiveCap(corpusSize);
  if (corpusSize === 0) return [];

  const seen = new Set<string>();
  const collected: any[] = [];

  function addAll(rows: any[]) {
    for (const r of rows) {
      if (collected.length >= cap) break;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      collected.push(r);
    }
  }

  // Tier 1: profile-tagged (always)
  try {
    const profile = await prisma.memory.findMany({
      where: {
        category: "profile",
        OR: [
          { operatorId },
          {
            metadata: {
              path: ["relatedOperators"],
              array_contains: params.operator,
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    addAll(profile);
  } catch (err) {
    console.warn("[memoryService] profile tier failed:", err);
  }

  // Tier 2: keyword search across direct + related
  if (params.userMessage && collected.length < cap) {
    const keywords = extractKeywords(params.userMessage);
    for (const kw of keywords) {
      if (collected.length >= cap) break;
      try {
        const matches = await prisma.memory.findMany({
          where: {
            AND: [
              {
                OR: [
                  { operatorId },
                  {
                    metadata: {
                      path: ["relatedOperators"],
                      array_contains: params.operator,
                    },
                  },
                ],
              },
              {
                OR: [
                  { value: { contains: kw, mode: "insensitive" } },
                  { category: { contains: kw, mode: "insensitive" } },
                ],
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
        addAll(matches);
      } catch (err) {
        console.warn(`[memoryService] keyword search failed for "${kw}":`, err);
      }
    }
  }

  // Tier 3: recent fallback (direct + related)
  if (collected.length < cap) {
    try {
      const recent = await prisma.memory.findMany({
        where: {
          OR: [
            { operatorId },
            {
              metadata: {
                path: ["relatedOperators"],
                array_contains: params.operator,
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: cap,
      });
      addAll(recent);
    } catch (err) {
      console.warn("[memoryService] recent fallback failed:", err);
    }
  }

  // Format output. We need to know each memory's primary operator name and relations.
  // Look up primary operator names in batch.
  const operatorIdToName = new Map<string, string>();
  const allOpIds = new Set(collected.map((c) => c.operatorId));
  if (allOpIds.size > 0) {
    const ops = await prisma.operator.findMany({
      where: { id: { in: Array.from(allOpIds) } },
      select: { id: true, name: true },
    });
    for (const op of ops) {
      operatorIdToName.set(op.id, op.name);
    }
  }

  const formatted: FormattedMemory[] = collected.map((r) => ({
    id: r.id,
    category: r.category,
    value: r.value,
    createdAt: r.createdAt,
    primaryOperator: operatorIdToName.get(r.operatorId) || "unknown",
    relatedOperators: Array.isArray(r.metadata?.relatedOperators)
      ? r.metadata.relatedOperators
      : [],
  }));

  formatted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return formatted;
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-SAVE DIRECTIVE PARSING
// Looks for [SAVE: category=X value="Y"] patterns.
// Optionally [SAVE: category=X value="Y" related=op1,op2] for relations.
// ═══════════════════════════════════════════════════════════════════

export type ParsedSaveDirective = {
  category: string;
  value: string;
  relatedOperators?: string[];
};

export type ParseResult = {
  cleanedText: string;
  directives: ParsedSaveDirective[];
};

// Matches [SAVE: category=X value="Y"] OR [SAVE: category=X value="Y" related=a,b]
const SAVE_DIRECTIVE_REGEX =
  /\[SAVE:\s*category=([a-zA-Z0-9_-]+)\s+value="([^"]+)"(?:\s+related=([a-zA-Z0-9_,-]+))?\]/g;

export function parseAutoSaveDirectives(text: string): ParseResult {
  const directives: ParsedSaveDirective[] = [];

  const matches = text.matchAll(SAVE_DIRECTIVE_REGEX);
  for (const match of matches) {
    const category = match[1];
    const value = match[2];
    const relatedRaw = match[3];

    if (!MEMORY_CATEGORIES.includes(category as MemoryCategory)) {
      console.warn(`[memoryService] ignored invalid save category: "${category}"`);
      continue;
    }

    const directive: ParsedSaveDirective = { category, value };
    if (relatedRaw) {
      directive.relatedOperators = relatedRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    directives.push(directive);
  }

  const cleanedText = text.replace(SAVE_DIRECTIVE_REGEX, "").trim();
  return { cleanedText, directives };
}

// ═══════════════════════════════════════════════════════════════════
// FORMAT FOR PROMPT INJECTION
// Group by category. Note primary operator and any related ones if present.
// ═══════════════════════════════════════════════════════════════════

export function formatMemoriesForPrompt(memories: FormattedMemory[]): string {
  if (memories.length === 0) return "";

  const lines: string[] = ["═══ WHAT YOU REMEMBER ABOUT COLE ═══"];

  const byCategory = new Map<string, FormattedMemory[]>();
  for (const m of memories) {
    if (!byCategory.has(m.category)) {
      byCategory.set(m.category, []);
    }
    byCategory.get(m.category)!.push(m);
  }

  for (const [category, mems] of byCategory.entries()) {
    lines.push(`\n${category}:`);
    for (const m of mems) {
      // Show value, plus primary/related operators in parens if relevant
      const operators =
        m.relatedOperators.length > 0
          ? ` (${m.primaryOperator} + ${m.relatedOperators.join(", ")})`
          : "";
      lines.push(`  — ${m.value}${operators}`);
    }
  }

  return lines.join("\n");
}