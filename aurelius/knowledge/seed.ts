// aurelius/knowledge/seed.ts
//
// Phase 4.5a — One-time seeder for founding training knowledge.
//
// Loads FOUNDING_DEFAULTS into the DB on first run. Idempotent:
// if an entry already exists, it's left alone (the DB is the source
// of truth post-bootstrap). Pass { force: true } to overwrite, but
// that resets Cole's evolved knowledge to founding values — destructive.

// Load env regardless of where this script is invoked from. The server
// loads dotenv itself; CLI entrypoints have to fend for themselves.
// Checks repo root .env first, then aurelius/.env. dotenv never overrides
// vars already set in the shell.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const _seedDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(_seedDir, "../../.env") });
dotenv.config({ path: path.resolve(_seedDir, "../.env") });

import { setKnowledge, getKnowledge, resolveOperatorId } from "./store.ts";
import { FOUNDING_DEFAULTS } from "./foundationalTrainingKnowledge.ts";

export type SeedResult = {
  operatorName: string;
  inserted: number;
  skipped: number;
  forced: number;
  errors: Array<{ scope: string; key: string; error: string }>;
};

/**
 * Ensure the reserved "global" operator exists. Not a conversational
 * operator — a namespace for cross-domain knowledge any operator can
 * fall back to. domain "reserved", priority 0, never routed to.
 */
export async function ensureGlobalOperator(): Promise<string> {
  const { prisma } = await import("../core/db/prisma.ts");
  const existing = await prisma.operator.findUnique({
    where: { name: "global" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.operator.create({
    data: {
      name: "global",
      domain: "reserved",
      priority: 0,
    },
  });
  console.log(`[seed] created reserved "global" operator: ${created.id}`);
  return created.id;
}

/**
 * Seed founding training knowledge for the training operator.
 * Idempotent by default. Pass { force: true } to overwrite existing entries.
 */
export async function seedTrainingKnowledge(
  options: { force?: boolean } = {}
): Promise<SeedResult> {
  await ensureGlobalOperator();

  const operatorName = "training";
  const operatorId = await resolveOperatorId(operatorName);

  if (!operatorId) {
    throw new Error(
      `Operator "${operatorName}" not found in DB. Run operator seeding first (scripts/seedOperators.ts).`
    );
  }

  const result: SeedResult = {
    operatorName,
    inserted: 0,
    skipped: 0,
    forced: 0,
    errors: [],
  };

  for (const bundle of FOUNDING_DEFAULTS) {
    for (const [key, entry] of Object.entries(bundle.entries)) {
      try {
        const existing = await getKnowledge(operatorId, bundle.scope, key, {
          includeInactive: true,
        });

        if (existing && !options.force) {
          result.skipped++;
          continue;
        }

        await setKnowledge({
          operatorId,
          scope: bundle.scope,
          key,
          value: entry,
          sourceType: "founding_default",
          rationale:
            (entry as any).rationale ??
            `Founding default for ${bundle.scope}.${key}`,
          updatedBy: "system",
        });

        if (existing) {
          result.forced++;
        } else {
          result.inserted++;
        }
      } catch (err: any) {
        result.errors.push({
          scope: bundle.scope,
          key,
          error: err?.message ?? String(err),
        });
      }
    }
  }

  return result;
}

/**
 * Run from CLI: `npx tsx aurelius/knowledge/seed.ts [--force]`
 */
async function main() {
  const force = process.argv.includes("--force");
  console.log(`[seed] training knowledge (force=${force})`);

  const result = await seedTrainingKnowledge({ force });

  console.log("=== Seed result ===");
  console.log(`  Operator:  ${result.operatorName}`);
  console.log(`  Inserted:  ${result.inserted}`);
  console.log(`  Skipped:   ${result.skipped} (already existed)`);
  console.log(`  Forced:    ${result.forced} (overwritten)`);
  console.log(`  Errors:    ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of result.errors) {
      console.log(`  ${e.scope}.${e.key}: ${e.error}`);
    }
    process.exit(1);
  }
}

// Only run main() if this file is invoked directly, not imported
const isDirectInvocation = import.meta.url === `file://${process.argv[1]}`;
if (isDirectInvocation) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed] fatal:", err);
      process.exit(1);
    });
}