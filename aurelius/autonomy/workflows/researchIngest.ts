// aurelius/autonomy/workflows/researchIngest.ts
//
// THE THIRD ACTING WORKFLOW (NORTH_STAR §4). The initiative pulse proposes
// research missions but — until now — never ran them ("the acting layer is what
// changes that"). This closes that loop: research.ingest is an INWARD, grantable
// class (corpus growth is reversible and traced), so through the executor it
// either RUNS the mission now (if calendar-style granted) or GATES it to a Bridge
// confirm. Running a mission = plan → execute → report → four-write ingest
// (missions/engine.ts::runMission).

import { prisma } from "../../core/db/prisma.ts";
import { runMission } from "../../missions/engine.ts";
import { executeAction } from "../executor.ts";

/** Commit step — registered as the research.ingest finalizer. Runs the mission
 *  end-to-end (and ingests its report into the second brain). */
export async function finalizeResearchIngest(payload: { missionId: string }): Promise<any> {
  if (!payload?.missionId) throw new Error("research.ingest finalizer needs a missionId");
  return runMission(payload.missionId);
}

/**
 * Route a proposed mission through the acting layer. Granted → it runs now and
 * lands on the Bridge as an executed proposal; ungranted → a pending confirm.
 * The mission itself already exists (the initiative pulse created it as
 * "proposed"); this decides whether Aurelius runs it on its own.
 */
export async function runMissionThroughActingLayer(missionId: string) {
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new Error(`mission not found: ${missionId}`);
  return executeAction({
    actionClass: "research.ingest",
    sourceType: "mission",
    sourceId: missionId,
    prepare: async () => ({
      title: `Run mission: ${mission.title}`,
      body: mission.objective,
      domain: mission.domain,
      payload: { missionId },
    }),
  });
}
