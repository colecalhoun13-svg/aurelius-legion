// aurelius/research/researchRouter.ts

import { runResearch } from "./researchEngine.ts";
import { ResearchTask } from "./researchTypes.ts";

export async function researchRouter(task: ResearchTask) {
  return await runResearch(task);
}
