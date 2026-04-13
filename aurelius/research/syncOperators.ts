/**
 * syncOperators.ts
 * Aurelius OS v3.4 — Operator Intelligence Synchronization Engine
 *
 * Responsibilities:
 *  - Load the research corpus
 *  - Extract new principles + insights
 *  - Update operator cores with fresh intelligence
 *  - Maintain a clean, evolving knowledge base
 */

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Operator core paths — MUST include .ts for ESM
import { updatePerformanceCore } from "../operators/performanceCore.ts";
import { updateStrategyCore } from "../operators/strategyCore.ts";
import { updateFinanceCore } from "../operators/financeCore.ts";
import { updateIdentityCore } from "../operators/identityCore.ts";
import { updateTrainingCore } from "../operators/trainingCore.ts";

const CORPUS_PATH = path.join(
  __dirname,
  "../../data/research_corpus.json"
);

/**
 * Load the research corpus.
 */
function loadCorpus() {
  if (!fs.existsSync(CORPUS_PATH)) {
    console.warn("No research corpus found. Run autonomousResearch() first.");
    return null;
  }

  const raw = fs.readFileSync(CORPUS_PATH, "utf8");
  return JSON.parse(raw);
}

/**
 * Extract the latest research entry.
 */
function getLatestEntry(corpus: any) {
  if (!corpus || !corpus.entries || corpus.entries.length === 0) {
    console.warn("Corpus is empty — nothing to sync.");
    return null;
  }

  return corpus.entries[corpus.entries.length - 1];
}

/**
 * Map research topics to operator cores.
 * This keeps the system modular and scalable.
 */
function routeToOperator(topic: string) {
  const t = topic.toLowerCase();

  if (t.includes("training") || t.includes("athlete") || t.includes("strength"))
    return "training";

  if (t.includes("performance") || t.includes("movement"))
    return "performance";

  if (t.includes("strategy") || t.includes("business") || t.includes("systems"))
    return "strategy";

  if (t.includes("finance") || t.includes("wealth") || t.includes("money"))
    return "finance";

  if (t.includes("identity") || t.includes("mindset") || t.includes("philosophy"))
    return "identity";

  return "general";
}

/**
 * Sync the latest research entry into the appropriate operator core.
 */
export function syncOperators() {
  const corpus = loadCorpus();
  if (!corpus) return;

  const latest = getLatestEntry(corpus);
  if (!latest) return;

  const { topic, data } = latest;
  const operator = routeToOperator(topic);

  console.log(`Syncing research into operator: ${operator}`);

  try {
    switch (operator) {
      case "training":
        updateTrainingCore(data);
        break;

      case "performance":
        updatePerformanceCore(data);
        break;

      case "strategy":
        updateStrategyCore(data);
        break;

      case "finance":
        updateFinanceCore(data);
        break;

      case "identity":
        updateIdentityCore(data);
        break;

      default:
        console.log("General topic — no operator update required.");
        break;
    }

    console.log(`Operator sync complete for topic: ${topic}`);
  } catch (err) {
    console.error("Operator sync error:", err);
  }
}
