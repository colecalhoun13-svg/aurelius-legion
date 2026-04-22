// ─────────────────────────────────────────────
// Aurelius OS 3.4 — Cockpit Data Contracts
// Single Source of Truth
// ─────────────────────────────────────────────

// Core panels
export interface AutonomyEvent {
  id: string;
  timestamp: string;
  type: "decision" | "action" | "reflection" | "error";
  summary: string;
  details?: string;
  metadata?: Record<string, any>;
}

export interface ResearchInsight {
  id: string;
  timestamp: string;
  topic: string;
  insight: string;
  confidence: number;
  source?: string;
}

export interface MemoryView {
  id: string;
  category: string;
  value: string;
  lastUpdated: string;
}

export interface OperatorStatus {
  id: string;
  mode: "idle" | "thinking" | "executing" | "learning";
  uptime: number;
  load: number;
  lastAction: string;
  updatedAt: string;
}

export interface SystemStatus {
  cpuLoad: number;
  memoryUsage: number;
  activeTasks: number;
  queueDepth: number;
  uptime: number;
  updatedAt: string;
}

export interface MissionLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  context?: Record<string, any>;
}

// Advanced / “no brakes” panels

export interface RouterRouteEvent {
  id: string;
  timestamp: string;
  engine: string;
  route: string;
  latencyMs: number;
}

export interface ModelRegistryEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  status: "active" | "standby" | "disabled";
}

export interface TaskEngineStatus {
  id: string;
  name: string;
  activeTasks: number;
  queuedTasks: number;
  lastRun: string;
}

export interface MemoryTimelinePoint {
  id: string;
  timestamp: string;
  event: string;
  category: string;
}

export interface EngineLoadPoint {
  engine: string;
  load: number;
}

export interface ApiThroughputPoint {
  timestamp: string;
  requestsPerMinute: number;
}

export interface ErrorHeatmapCell {
  area: string;
  count: number;
}

export interface ModelLatencyPoint {
  model: string;
  avgLatencyMs: number;
}

export interface AutonomyLoopStep {
  id: string;
  timestamp: string;
  phase: "perception" | "planning" | "action" | "reflection";
  description: string;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface ContextWindowSnapshot {
  id: string;
  timestamp: string;
  tokensUsed: number;
  tokensAvailable: number;
}

export interface TokenFlowPoint {
  timestamp: string;
  tokensIn: number;
  tokensOut: number;
}

export interface MemoryEmbeddingPoint {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface AttentionMetric {
  timestamp: string;
  focusArea: string;
  weight: number;
}

export interface EventStreamEntry {
  id: string;
  timestamp: string;
  channel: string;
  message: string;
}

export interface CognitiveLoadSample {
  timestamp: string;
  load: number;
}
