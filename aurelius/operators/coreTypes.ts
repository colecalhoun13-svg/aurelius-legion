// aurelius/operators/coreTypes.ts
// Core schema for Aurelius OS v3.4 operator intelligence

export type CorePlaybook = {
  name: string;
  steps: string[];
};

export type CoreExample = {
  situation: string;
  response: string;
};

export type OperatorCore = {
  operator: string;
  version: string;
  principles: string[];
  playbooks: CorePlaybook[];
  constraints: string[];
  examples: CoreExample[];
};
