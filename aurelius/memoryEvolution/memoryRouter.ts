// aurelius/memoryEvolution/memoryRouter.ts

import { MemoryPacket } from "./memoryEvolutionTypes";
import { runMemoryEvolution } from "../memory/memoryEvolutionEngine";

export async function memoryEvolutionRouter(
  packets: MemoryPacket[]
) {
  return await runMemoryEvolution(packets);
}
