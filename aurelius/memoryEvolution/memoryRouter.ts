// aurelius/memoryEvolution/memoryRouter.ts

import { MemoryPacket } from "./memoryEvolutionTypes.ts";
import { runMemoryEvolution } from "../memory/memoryEvolutionEngine.ts";

export async function memoryEvolutionRouter(
  packets: MemoryPacket[]
) {
  return await runMemoryEvolution(packets);
}
