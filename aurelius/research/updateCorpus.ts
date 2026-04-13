/**
 * updateCorpus.ts
 * Aurelius OS v3.4 — Research Corpus Updater
 *
 * Responsibilities:
 *  - Append new research entries to the corpus
 *  - Maintain versioned JSON structure
 *  - Ensure safe writes and clean formatting
 */

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Path to the research corpus JSON file.
 * If it doesn't exist, we create it automatically.
 */
const CORPUS_PATH = path.join(
  __dirname,
  "../../data/research_corpus.json"
);

/**
 * Ensure the corpus file exists.
 */
function ensureCorpusFile() {
  if (!fs.existsSync(CORPUS_PATH)) {
    fs.writeFileSync(
      CORPUS_PATH,
      JSON.stringify({ entries: [] }, null, 2),
      "utf8"
    );
  }
}

/**
 * Load the existing corpus.
 */
function loadCorpus() {
  ensureCorpusFile();
  const raw = fs.readFileSync(CORPUS_PATH, "utf8");
  return JSON.parse(raw);
}

/**
 * Save the updated corpus.
 */
function saveCorpus(corpus: any) {
  fs.writeFileSync(CORPUS_PATH, JSON.stringify(corpus, null, 2), "utf8");
}

/**
 * Append a new research entry to the corpus.
 *
 * @param topic - The research topic
 * @param researchJSON - The structured JSON output from autonomousResearch()
 */
export function updateCorpus(topic: string, researchJSON: any) {
  try {
    const corpus = loadCorpus();

    const entry = {
      id: corpus.entries.length + 1,
      topic,
      timestamp: new Date().toISOString(),
      data: researchJSON
    };

    corpus.entries.push(entry);
    saveCorpus(corpus);

    console.log(`Corpus updated with new research entry on: ${topic}`);
    return entry;
  } catch (err) {
    console.error("Error updating research corpus:", err);
    return null;
  }
}
