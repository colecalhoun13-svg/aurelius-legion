// aurelius/research/researchRouter.ts

import { runResearch } from "./researchEngine";
import { ResearchTask } from "./researchTypes";

export async function researchRouter(task: ResearchTask) {
  return await runResearch(task);
}
