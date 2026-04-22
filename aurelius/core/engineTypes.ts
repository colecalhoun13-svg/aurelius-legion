/**
 * Aurelius OS v3.4 — Unified Engine Types
 */

export type EngineStatus = "success" | "error" | "partial";

export interface EngineMetrics {
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface EngineResult {
  status: EngineStatus;
  summary: string;
  text?: string;
  data: Record<string, any>;
  logs: string[];
  metrics: EngineMetrics;
  tokensUsed?: number;
}

export interface EngineInput {
  type: string;
  payload: any;
  systemPrompt?: string;
}

export interface Logger {
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}

export interface MemoryAdapter {
  read(query: any): Promise<any>;
  write(entry: any): Promise<any>;
  search(query: any): Promise<any>;
}

export interface ToolRegistry {
  runTool(name: string, args: any): Promise<any>;
}

export interface Config {
  environment: "dev" | "staging" | "prod";
  [key: string]: any;
}

export interface EngineContext {
  requestId: string;
  operatorId: string;
  timestamp: string;
  logger: Logger;
  memory: MemoryAdapter;
  tools: ToolRegistry;
  config: Config;
}

export interface Engine {
  name: string;
  run(input: EngineInput, ctx: EngineContext): Promise<EngineResult>;
}

export type RoutedTaskType =
  | "research"
  | "memory"
  | "autonomy"
  | "tool"
  | "operator"
  | "system"
  | "task"
  | "chat";

export interface RoutedTask {
  id: string;
  type: RoutedTaskType;
  payload: any;
  engine?: string;
  priority?: "low" | "normal" | "high";
  source?: "operator" | "system" | "autonomy";
}
