// aurelius/engines/engineAdapter.ts

export type EngineRequest = {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  tools?: any[];
  context?: any;
};

export type EngineResponse = {
  text: string;
  tokensUsed: number;
  raw?: any;
};

export interface EngineAdapter {
  name: string;
  run(request: EngineRequest): Promise<EngineResponse>;
}
