// aurelius/memoryEvolution/memoryEvolutionTypes.ts

export type MemoryInsight = {
  text: string;
  source: string;
  confidence: number;
};

export type MemoryPacket = {
  domain: string;
  insights: MemoryInsight[];
  timestamp: string;
};

export type CompressedMemory = {
  summary: string;
  keyPoints: string[];
  confidence: number;
};

export type SynthesizedMemory = {
  evolvedIdentity: string[];
  evolvedOperators: string[];
  evolvedPreferences: string[];
};
