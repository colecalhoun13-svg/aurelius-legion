/**
 * weeklyLoop.ts
 * Aurelius OS v3.4 — Weekly Intelligence Orchestrator
 *
 * Responsibilities:
 *  - Run autonomous research
 *  - Update the research corpus
 *  - Sync operator cores
 *  - Generate the weekly intelligence report
 *  - Log and return the final output
 */

import { autonomousResearch } from "./autonomousResearch.ts";
import { updateCorpus } from "./updateCorpus.ts";
import { syncOperators } from "./syncOperators.ts";
import { generateWeeklyReport } from "./generateWeeklyReports.ts";

/**
 * MAIN WEEKLY LOOP
 * This is the Aurelius intelligence cycle.
 */
export async function runWeeklyLoop(topic: string) {
  console.log("==============================================");
  console.log("AURELIUS WEEKLY INTELLIGENCE LOOP STARTED");
  console.log("==============================================");

  try {
    // 1. Run autonomous research
    console.log(`Running research on topic: ${topic}`);
    const researchOutput = await autonomousResearch(topic);

    // 2. Update the corpus
    console.log("Updating corpus...");
    const corpusEntry = updateCorpus(topic, researchOutput);

    // 3. Sync operator cores
    console.log("Syncing operator cores...");
    syncOperators();

    // 4. Generate weekly intelligence report
    console.log("Generating weekly report...");
    const weeklyReport = await generateWeeklyReport();

    console.log("==============================================");
    console.log("AURELIUS WEEKLY INTELLIGENCE LOOP COMPLETE");
    console.log("==============================================");

    return {
      success: true,
      topic,
      corpusEntry,
      weeklyReport
    };
  } catch (err) {
    console.error("Weekly loop error:", err);
    return {
      success: false,
      error: err
    };
  }
}
